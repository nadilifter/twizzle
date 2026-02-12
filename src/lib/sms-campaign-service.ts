import { db } from "@/lib/db";
import {
  sendSms,
  calculateSegments,
  normalizePhoneNumber,
  isValidE164,
  mapTwilioStatus,
  isTwilioConfigured,
} from "@/lib/twilio";
import {
  checkUsageLimits,
  recordUsage,
} from "@/lib/sms-service";
import type {
  SmsClassification,
  SmsTargetType,
  AnnouncementScope,
} from "@prisma/client";

/**
 * SMS Campaign Service
 *
 * High-level service for sending SMS campaigns with:
 * - Expanded targeting (8 target types matching email)
 * - Per-recipient placeholder rendering
 * - Preview with example data
 * - Recipient counting
 * - Usage tracking and billing
 */

// ============================================
// Types
// ============================================

export interface SmsRecipient {
  familyId: string;
  phone: string;
  name: string;
}

export interface SmsTargetingParams {
  organizationId: string;
  targetType: SmsTargetType;
  targetProgramId?: string;
  targetEventId?: string;
  targetMembershipStatus?: "ACTIVE" | "EXPIRED";
  targetProgramInstanceId?: string;
  targetMembershipGroupIds?: string[];
  targetFamilyIds?: string[];
}

export interface CreateSmsCampaignParams {
  organizationId: string;
  name: string;
  body: string;
  classification?: SmsClassification;
  targetType: SmsTargetType;
  targetProgramId?: string;
  targetEventId?: string;
  targetMembershipStatus?: "ACTIVE" | "EXPIRED";
  targetProgramInstanceId?: string;
  targetMembershipGroupIds?: string[];
  targetFamilyIds?: string[];
  createdById?: string;
  scheduledAt?: Date;
  sendImmediately?: boolean;
}

export interface CreateSmsCampaignResult {
  success: boolean;
  campaignId?: string;
  totalRecipients?: number;
  error?: string;
}

// ============================================
// Recipient Targeting
// ============================================

/**
 * Get SMS recipients using expanded targeting (8-category system matching email)
 */
export async function getExpandedSmsCampaignRecipients(
  params: SmsTargetingParams
): Promise<SmsRecipient[]> {
  const {
    organizationId,
    targetType,
    targetProgramId,
    targetEventId,
    targetMembershipStatus,
    targetProgramInstanceId,
    targetMembershipGroupIds,
    targetFamilyIds,
  } = params;

  const recipients: SmsRecipient[] = [];
  const seenPhones = new Set<string>();

  // Helper to add a family if not already added
  const addFamily = (family: { id: string; phone: string; primaryContact: string; smsOptOut?: boolean }) => {
    if (family.smsOptOut) return;
    const normalized = normalizePhoneNumber(family.phone);
    if (normalized && isValidE164(normalized) && !seenPhones.has(normalized)) {
      seenPhones.add(normalized);
      recipients.push({
        familyId: family.id,
        phone: normalized,
        name: family.primaryContact,
      });
    }
  };

  switch (targetType) {
    case "ALL_USERS": {
      // Staff/org members - the User model doesn't have phone, so
      // we look for families linked via userId on the Family model
      const members = await db.organizationMember.findMany({
        where: {
          organizationId,
          status: "ACTIVE",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      // Look up any families linked to these users
      const userIds = members
        .filter((m) => m.user.status === "ACTIVE")
        .map((m) => m.user.id);

      if (userIds.length > 0) {
        const linkedFamilies = await db.family.findMany({
          where: {
            userId: { in: userIds },
            organizationId,
            smsOptOut: false,
            phone: { not: "" },
          },
          select: {
            id: true,
            phone: true,
            primaryContact: true,
          },
        });
        linkedFamilies.forEach(addFamily);
      }
      break;
    }

    case "ALL_MEMBERS":
    case "ALL_FAMILIES": {
      const families = await db.family.findMany({
        where: {
          organizationId,
          smsOptOut: false,
          phone: { not: "" },
        },
        select: {
          id: true,
          phone: true,
          primaryContact: true,
        },
      });

      families.forEach(addFamily);
      break;
    }

    case "ALL_PROGRAM_REGISTRANTS": {
      const enrollments = await db.enrollment.findMany({
        where: {
          status: "ACTIVE",
          athlete: {
            organizationId,
          },
        },
        include: {
          athlete: {
            include: {
              guardians: {
                include: {
                  family: {
                    select: {
                      id: true,
                      phone: true,
                      primaryContact: true,
                      smsOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      enrollments.forEach((e) => {
        e.athlete.guardians.forEach((g) => {
          addFamily(g.family);
        });
      });
      break;
    }

    case "PROGRAM_ANY_INSTANCE": {
      if (!targetProgramId) break;

      // Families via InstanceRegistration for ANY instance of the given program
      const registrations = await db.instanceRegistration.findMany({
        where: {
          programInstance: {
            programId: targetProgramId,
          },
          status: { in: ["REGISTERED", "ATTENDED"] },
        },
        include: {
          athlete: {
            include: {
              guardians: {
                include: {
                  family: {
                    select: {
                      id: true,
                      phone: true,
                      primaryContact: true,
                      smsOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      registrations.forEach((r) => {
        r.athlete.guardians.forEach((g) => {
          addFamily(g.family);
        });
      });

      // Also include legacy Enrollment-based registrations
      const enrollments = await db.enrollment.findMany({
        where: {
          programId: targetProgramId,
          status: "ACTIVE",
        },
        include: {
          athlete: {
            include: {
              guardians: {
                include: {
                  family: {
                    select: {
                      id: true,
                      phone: true,
                      primaryContact: true,
                      smsOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      enrollments.forEach((e) => {
        e.athlete.guardians.forEach((g) => {
          addFamily(g.family);
        });
      });
      break;
    }

    case "PROGRAM_SPECIFIC_INSTANCE": {
      if (!targetProgramInstanceId) break;

      const registrations = await db.instanceRegistration.findMany({
        where: {
          programInstanceId: targetProgramInstanceId,
          status: { in: ["REGISTERED", "ATTENDED"] },
        },
        include: {
          athlete: {
            include: {
              guardians: {
                include: {
                  family: {
                    select: {
                      id: true,
                      phone: true,
                      primaryContact: true,
                      smsOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      registrations.forEach((r) => {
        r.athlete.guardians.forEach((g) => {
          addFamily(g.family);
        });
      });
      break;
    }

    case "MEMBERSHIP_HOLDERS": {
      if (!targetMembershipGroupIds?.length) break;

      const memberships = await db.athleteMembership.findMany({
        where: {
          status: "ACTIVE",
          instance: {
            membershipGroupId: { in: targetMembershipGroupIds },
          },
        },
        include: {
          athlete: {
            include: {
              guardians: {
                include: {
                  family: {
                    select: {
                      id: true,
                      phone: true,
                      primaryContact: true,
                      smsOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      memberships.forEach((m) => {
        m.athlete.guardians.forEach((g) => {
          addFamily(g.family);
        });
      });
      break;
    }

    case "SPECIFIC_USERS": {
      if (!targetFamilyIds?.length) break;

      const families = await db.family.findMany({
        where: {
          id: { in: targetFamilyIds },
          organizationId,
          smsOptOut: false,
          phone: { not: "" },
        },
        select: {
          id: true,
          phone: true,
          primaryContact: true,
        },
      });

      families.forEach(addFamily);
      break;
    }
  }

  // Handle legacy event targeting
  if (targetEventId) {
    const attendances = await db.attendance.findMany({
      where: {
        eventId: targetEventId,
      },
      include: {
        athlete: {
          include: {
            guardians: {
              include: {
                family: {
                  select: {
                    id: true,
                    phone: true,
                    primaryContact: true,
                    smsOptOut: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const eventRecipients: SmsRecipient[] = [];
    const eventSeenPhones = new Set<string>();

    attendances.forEach((a) => {
      a.athlete.guardians.forEach((g) => {
        if (!g.family.smsOptOut && g.family.phone) {
          const normalized = normalizePhoneNumber(g.family.phone);
          if (normalized && isValidE164(normalized) && !eventSeenPhones.has(normalized)) {
            eventSeenPhones.add(normalized);
            eventRecipients.push({
              familyId: g.family.id,
              phone: normalized,
              name: g.family.primaryContact,
            });
          }
        }
      });
    });

    return eventRecipients;
  }

  // Additional filtering by membership status if specified
  if (targetMembershipStatus && recipients.length > 0 && targetType !== "MEMBERSHIP_HOLDERS") {
    const familyIds = recipients.filter((r) => r.familyId).map((r) => r.familyId);

    if (familyIds.length === 0) return recipients;

    const familiesWithMembership = await db.family.findMany({
      where: {
        id: { in: familyIds },
      },
      include: {
        guardians: {
          include: {
            athlete: {
              include: {
                memberships: {
                  orderBy: { endDate: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    const validFamilyIds = new Set<string>();
    const now = new Date();

    familiesWithMembership.forEach((family) => {
      const hasAthleteWithStatus = family.guardians.some((g) => {
        const membership = g.athlete.memberships[0];
        if (!membership) {
          return targetMembershipStatus === "EXPIRED";
        }
        const isActive = membership.endDate && membership.endDate > now;
        return targetMembershipStatus === "ACTIVE" ? isActive : !isActive;
      });

      if (hasAthleteWithStatus) {
        validFamilyIds.add(family.id);
      }
    });

    return recipients.filter((r) => !r.familyId || validFamilyIds.has(r.familyId));
  }

  return recipients;
}

/**
 * Get just the recipient count for a targeting configuration (for preview)
 */
export async function getSmsCampaignRecipientCount(
  params: SmsTargetingParams
): Promise<number> {
  const recipients = await getExpandedSmsCampaignRecipients(params);
  return recipients.length;
}

// ============================================
// Placeholder Rendering
// ============================================

/**
 * Build template context for a specific recipient (family-based)
 */
async function buildRecipientContext(
  organizationId: string,
  familyId: string
): Promise<Record<string, string>> {
  const context: Record<string, string> = {};

  // Organization context
  const org = await db.organization.findUnique({
    where: { id: organizationId },
  });
  if (org) {
    context.organizationName = org.name;
    if (org.email) context.organizationEmail = org.email;
    if (org.phone) context.organizationPhone = org.phone;
    const addressParts = [org.street, org.city, org.stateProvince, org.postalCode].filter(Boolean);
    if (addressParts.length > 0) context.organizationAddress = addressParts.join(", ");
  }

  // Date context
  const now = new Date();
  context.currentDate = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  context.currentYear = now.getFullYear().toString();

  // Family context
  if (!familyId) return context;

  const family = await db.family.findUnique({
    where: { id: familyId },
    include: {
      guardians: {
        include: {
          athlete: {
            include: {
              memberships: {
                where: { status: "ACTIVE" },
                include: { instance: { include: { group: true } } },
                take: 1,
              },
              enrollments: {
                where: { status: "ACTIVE" },
                include: { program: true },
                take: 1,
              },
            },
          },
        },
        take: 1,
      },
    },
  });

  if (family) {
    context.familyName = family.name;
    context.primaryContact = family.primaryContact;
    context.primaryContactFirstName = family.primaryContact.split(" ")[0];
    context.familyEmail = family.email;
    context.familyPhone = family.phone;
    context.familyBalance = `$${Number(family.balance).toFixed(2)}`;

    // Athlete context from first guardian's athlete
    const athlete = family.guardians[0]?.athlete;
    if (athlete) {
      context.athleteName = athlete.name;
      const nameParts = athlete.name.split(" ");
      context.athleteFirstName = nameParts[0];
      if (nameParts.length > 1) context.athleteLastName = nameParts.slice(1).join(" ");
      if (athlete.email) context.athleteEmail = athlete.email;
      if (athlete.level) context.athleteLevel = athlete.level;
      if (athlete.group) context.athleteGroup = athlete.group;

      // Membership context
      const membership = athlete.memberships[0];
      if (membership) {
        context.membershipName = membership.instance.name;
        context.membershipGroupName = membership.instance.group.name;
        context.membershipStartDate = membership.startDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        if (membership.endDate) {
          context.membershipEndDate = membership.endDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
          const daysRemaining = Math.ceil((membership.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          context.membershipDaysRemaining = daysRemaining.toString();
        }
        context.membershipStatus = membership.status;
        context.membershipPrice = `$${Number(membership.instance.price).toFixed(2)}`;
      }

      // Program context
      const enrollment = athlete.enrollments[0];
      if (enrollment) {
        context.programName = enrollment.program.name;
        if (enrollment.program.description) context.programDescription = enrollment.program.description;
      }
    }
  }

  return context;
}

/**
 * Render placeholders in a template string using a context map
 */
function renderPlaceholders(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return context[key] || "";
  });
}

/**
 * Render a campaign preview with example placeholder values
 */
export function renderSmsCampaignPreview(body: string): string {
  const exampleContext: Record<string, string> = {
    athleteName: "Emma Johnson",
    athleteFirstName: "Emma",
    athleteLastName: "Johnson",
    athleteEmail: "emma@example.com",
    athleteLevel: "Level 4",
    athleteGroup: "JO Team",
    familyName: "Johnson Family",
    primaryContact: "Sarah Johnson",
    primaryContactFirstName: "Sarah",
    familyEmail: "sarah@example.com",
    familyPhone: "(555) 123-4567",
    familyBalance: "$150.00",
    membershipName: "Annual Membership 2026",
    membershipGroupName: "Annual Membership",
    membershipStartDate: "January 1, 2026",
    membershipEndDate: "December 31, 2026",
    membershipDaysRemaining: "322",
    membershipStatus: "Active",
    membershipPrice: "$299.00",
    programName: "JO Team Training",
    programDescription: "Competitive training for JO athletes",
    organizationName: "Sunrise Gymnastics",
    organizationEmail: "info@sunrise-gymnastics.com",
    organizationPhone: "(555) 987-6543",
    organizationAddress: "123 Main St, Anytown, CA 12345",
    currentDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    currentYear: new Date().getFullYear().toString(),
  };

  return renderPlaceholders(body, exampleContext);
}

// ============================================
// Campaign CRUD
// ============================================

/**
 * Create and optionally send an SMS campaign
 */
export async function createSmsCampaign(
  params: CreateSmsCampaignParams
): Promise<CreateSmsCampaignResult> {
  const {
    organizationId,
    name,
    body,
    classification = "GENERAL",
    targetType,
    targetProgramId,
    targetEventId,
    targetMembershipStatus,
    targetProgramInstanceId,
    targetMembershipGroupIds,
    targetFamilyIds,
    createdById,
    scheduledAt,
    sendImmediately,
  } = params;

  // Check if Twilio is configured
  if (!isTwilioConfigured()) {
    return {
      success: false,
      error: "SMS service is not configured",
    };
  }

  // Get recipients
  const recipients = await getExpandedSmsCampaignRecipients({
    organizationId,
    targetType,
    targetProgramId,
    targetEventId,
    targetMembershipStatus,
    targetProgramInstanceId,
    targetMembershipGroupIds,
    targetFamilyIds,
  });

  if (recipients.length === 0) {
    return {
      success: false,
      error: "No valid recipients found for this campaign",
    };
  }

  // Check usage limits for all messages
  const limits = await checkUsageLimits(organizationId, recipients.length);
  if (!limits.allowed) {
    return {
      success: false,
      error: limits.error || "SMS limit reached",
    };
  }

  // Map targetType to legacy targetScope for backward compatibility
  let targetScope: AnnouncementScope = "ALL";
  if (targetProgramId) targetScope = "PROGRAM";
  if (targetEventId) targetScope = "EVENT";

  // Create campaign
  const campaign = await db.smsCampaign.create({
    data: {
      organizationId,
      name,
      body,
      classification,
      targetType,
      targetScope,
      targetProgramId,
      targetEventId,
      targetMembershipStatus,
      targetProgramInstanceId,
      targetMembershipGroupIds: targetMembershipGroupIds || [],
      targetFamilyIds: targetFamilyIds || [],
      totalRecipients: recipients.length,
      createdById,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt,
    },
  });

  // If sendImmediately, start sending
  if (sendImmediately && !scheduledAt) {
    executeSmsCampaign(campaign.id).catch(console.error);
  }

  return {
    success: true,
    campaignId: campaign.id,
    totalRecipients: recipients.length,
  };
}

/**
 * Execute an SMS campaign (send all messages with per-recipient placeholder rendering)
 */
export async function executeSmsCampaign(campaignId: string): Promise<void> {
  const campaign = await db.smsCampaign.findUnique({
    where: { id: campaignId },
    include: { organization: true },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    throw new Error(`Cannot execute campaign with status: ${campaign.status}`);
  }

  // Update status to sending
  await db.smsCampaign.update({
    where: { id: campaignId },
    data: {
      status: "SENDING",
      startedAt: new Date(),
    },
  });

  // Get recipients using expanded targeting
  const recipients = await getExpandedSmsCampaignRecipients({
    organizationId: campaign.organizationId,
    targetType: campaign.targetType,
    targetProgramId: campaign.targetProgramId ?? undefined,
    targetEventId: campaign.targetEventId ?? undefined,
    targetMembershipStatus: campaign.targetMembershipStatus as "ACTIVE" | "EXPIRED" | undefined,
    targetProgramInstanceId: campaign.targetProgramInstanceId ?? undefined,
    targetMembershipGroupIds: campaign.targetMembershipGroupIds,
    targetFamilyIds: campaign.targetFamilyIds,
  });

  let sentCount = 0;
  let failedCount = 0;

  // Send to each recipient with per-recipient placeholder rendering
  for (const recipient of recipients) {
    // Build context for this recipient
    const context = recipient.familyId
      ? await buildRecipientContext(campaign.organizationId, recipient.familyId)
      : {
          organizationName: campaign.organization.name,
          currentDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
          currentYear: new Date().getFullYear().toString(),
        };

    // Render placeholders in body
    const personalizedBody = renderPlaceholders(campaign.body, context);

    // Calculate segments
    const segments = calculateSegments(personalizedBody);

    // Create message record
    const smsMessage = await db.smsMessage.create({
      data: {
        organizationId: campaign.organizationId,
        familyId: recipient.familyId || undefined,
        campaignId,
        to: recipient.phone,
        from: process.env.TWILIO_PHONE_NUMBER || "",
        body: personalizedBody,
        segments,
        classification: campaign.classification,
        direction: "OUTBOUND",
        twilioStatus: "QUEUED",
      },
    });

    // Send via Twilio
    const result = await sendSms({
      to: recipient.phone,
      body: personalizedBody,
      organizationId: campaign.organizationId,
      campaignId,
    });

    if (result.success && result.sid) {
      await db.smsMessage.update({
        where: { id: smsMessage.id },
        data: {
          twilioSid: result.sid,
          twilioStatus: mapTwilioStatus(result.status || "queued"),
          sentAt: new Date(),
        },
      });

      await recordUsage(campaign.organizationId, segments);
      sentCount++;
    } else {
      await db.smsMessage.update({
        where: { id: smsMessage.id },
        data: {
          twilioStatus: "FAILED",
          failedAt: new Date(),
          errorCode: result.errorCode,
          errorMessage: result.error,
        },
      });
      failedCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Update campaign status
  await db.smsCampaign.update({
    where: { id: campaignId },
    data: {
      status: failedCount === recipients.length ? "FAILED" : "COMPLETED",
      sentCount,
      failedCount,
      completedAt: new Date(),
    },
  });
}

/**
 * Cancel a scheduled or draft campaign
 */
export async function cancelSmsCampaign(campaignId: string): Promise<boolean> {
  const campaign = await db.smsCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    return false;
  }

  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    return false;
  }

  await db.smsCampaign.update({
    where: { id: campaignId },
    data: { status: "CANCELLED" },
  });

  return true;
}
