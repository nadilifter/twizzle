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
import { getPoolNumberForSend } from "@/lib/sms-number-pool";
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
  userId?: string;
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
  targetUserIds?: string[];
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
  targetUserIds?: string[];
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
    targetUserIds,
  } = params;

  const recipients: SmsRecipient[] = [];
  const seenPhones = new Set<string>();

  const addUser = (user: { id: string; phone: string; name: string; smsOptOut?: boolean }) => {
    if (user.smsOptOut) return;
    const normalized = normalizePhoneNumber(user.phone);
    if (normalized && isValidE164(normalized) && !seenPhones.has(normalized)) {
      seenPhones.add(normalized);
      recipients.push({
        userId: user.id,
        phone: normalized,
        name: user.name,
      });
    }
  };

  switch (targetType) {
    case "ALL_USERS": {
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
              phone: true,
              smsOptOut: true,
            },
          },
        },
      });

      members.forEach((m) => {
        if (m.user.status === "ACTIVE" && m.user.phone) {
          addUser({
            id: m.user.id,
            phone: m.user.phone,
            name: m.user.name,
            smsOptOut: m.user.smsOptOut,
          });
        }
      });
      break;
    }

    case "ALL_MEMBERS":
    case "ALL_GUARDIANS": {
      const users = await db.user.findMany({
        where: {
          smsOptOut: false,
          phone: { not: "" },
          athleteGuardians: {
            some: {
              athlete: { organizationAthletes: { some: { organizationId } } },
            },
          },
        },
        select: {
          id: true,
          phone: true,
          name: true,
          smsOptOut: true,
        },
      });

      users.forEach((u) => {
        if (u.phone) {
          addUser({ id: u.id, phone: u.phone, name: u.name, smsOptOut: u.smsOptOut });
        }
      });
      break;
    }

    case "ALL_PROGRAM_REGISTRANTS": {
      const enrollments = await db.enrollment.findMany({
        where: {
          status: "ACTIVE",
          athlete: {
            organizationAthletes: { some: { organizationId } },
          },
        },
        include: {
          athlete: {
            include: {
              guardians: {
                include: {
                  user: {
                    select: {
                      id: true,
                      phone: true,
                      name: true,
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
          if (g.user?.phone) {
            addUser({
              id: g.user.id,
              phone: g.user.phone,
              name: g.user.name,
              smsOptOut: g.user.smsOptOut,
            });
          }
        });
      });
      break;
    }

    case "PROGRAM_ANY_INSTANCE": {
      if (!targetProgramId) break;

      // Families/guardians via InstanceRegistration for ANY instance of the given program
      const registrations = await db.instanceRegistration.findMany({
        where: {
          programInstance: {
            programId: targetProgramId,
          },
          status: "REGISTERED",
        },
        include: {
          athlete: {
            include: {
              guardians: {
                include: {
                  user: {
                    select: {
                      id: true,
                      phone: true,
                      name: true,
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
          if (g.user?.phone) {
            addUser({
              id: g.user.id,
              phone: g.user.phone,
              name: g.user.name,
              smsOptOut: g.user.smsOptOut,
            });
          }
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
                  user: {
                    select: {
                      id: true,
                      phone: true,
                      name: true,
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
          if (g.user?.phone) {
            addUser({
              id: g.user.id,
              phone: g.user.phone,
              name: g.user.name,
              smsOptOut: g.user.smsOptOut,
            });
          }
        });
      });
      break;
    }

    case "PROGRAM_SPECIFIC_INSTANCE": {
      if (!targetProgramInstanceId) break;

      const registrations = await db.instanceRegistration.findMany({
        where: {
          programInstanceId: targetProgramInstanceId,
          status: "REGISTERED",
        },
        include: {
          athlete: {
            include: {
              guardians: {
                include: {
                  user: {
                    select: {
                      id: true,
                      phone: true,
                      name: true,
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
          if (g.user?.phone) {
            addUser({
              id: g.user.id,
              phone: g.user.phone,
              name: g.user.name,
              smsOptOut: g.user.smsOptOut,
            });
          }
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
                  user: {
                    select: {
                      id: true,
                      phone: true,
                      name: true,
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
          if (g.user?.phone) {
            addUser({
              id: g.user.id,
              phone: g.user.phone,
              name: g.user.name,
              smsOptOut: g.user.smsOptOut,
            });
          }
        });
      });
      break;
    }

    case "SPECIFIC_USERS": {
      if (targetUserIds?.length) {
        const users = await db.user.findMany({
          where: {
            id: { in: targetUserIds },
            status: "ACTIVE",
          },
          select: {
            id: true,
            phone: true,
            name: true,
            smsOptOut: true,
          },
        });
        users.forEach((u) => {
          if (u.phone) {
            addUser({
              id: u.id,
              phone: u.phone,
              name: u.name,
              smsOptOut: u.smsOptOut,
            });
          }
        });
      }
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
                user: {
                  select: {
                    id: true,
                    phone: true,
                    name: true,
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
        if (g.user?.phone && !g.user.smsOptOut) {
          const normalized = normalizePhoneNumber(g.user.phone);
          if (normalized && isValidE164(normalized) && !eventSeenPhones.has(normalized)) {
            eventSeenPhones.add(normalized);
            eventRecipients.push({
              userId: g.user.id,
              phone: normalized,
              name: g.user.name,
            });
          }
        }
      });
    });

    return eventRecipients;
  }

  // Additional filtering by membership status if specified
  if (targetMembershipStatus && recipients.length > 0 && targetType !== "MEMBERSHIP_HOLDERS") {
    const userIds = recipients.filter((r) => r.userId).map((r) => r.userId!);

    if (userIds.length === 0) return recipients;

    const usersWithGuardians = await db.athleteGuardian.findMany({
      where: {
        userId: { in: userIds },
      },
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
    });

    const validUserIds = new Set<string>();
    const now = new Date();

    const guardiansByUserId = new Map<string, typeof usersWithGuardians>();
    usersWithGuardians.forEach((g) => {
      if (!g.userId) return;
      const existing = guardiansByUserId.get(g.userId) || [];
      existing.push(g);
      guardiansByUserId.set(g.userId, existing);
    });

    guardiansByUserId.forEach((guardians, uId) => {
      const hasAthleteWithStatus = guardians.some((g) => {
        const membership = g.athlete.memberships[0];
        if (!membership) {
          return targetMembershipStatus === "EXPIRED";
        }
        const isActive = membership.endDate && membership.endDate > now;
        return targetMembershipStatus === "ACTIVE" ? isActive : !isActive;
      });

      if (hasAthleteWithStatus) {
        validUserIds.add(uId);
      }
    });

    return recipients.filter((r) => !r.userId || validUserIds.has(r.userId));
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
 * Build template context for a specific recipient
 */
async function buildRecipientContext(
  organizationId: string,
  userId?: string
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

  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        athleteGuardians: {
          include: {
            athlete: {
              include: {
                organizationAthletes: {
                  where: { organizationId },
                  select: { level: true },
                },
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
    if (user) {
      context.guardianName = user.name;
      context.guardianFirstName = user.name.split(" ")[0];
      context.guardianEmail = user.email;
      context.guardianPhone = user.phone || "";
      context.guardianBalance = `$${Number(user.balance).toFixed(2)}`;
      const athlete = user.athleteGuardians[0]?.athlete;
      if (athlete) {
        context.athleteName = athlete.name;
        const nameParts = athlete.name.split(" ");
        context.athleteFirstName = nameParts[0];
        if (nameParts.length > 1) context.athleteLastName = nameParts.slice(1).join(" ");
        if (athlete.email) context.athleteEmail = athlete.email;
        const oaLevel = athlete.organizationAthletes?.[0]?.level;
        if (oaLevel) context.athleteLevel = oaLevel;
        const membership = athlete.memberships?.[0];
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
        const enrollment = athlete.enrollments?.[0];
        if (enrollment) {
          context.programName = enrollment.program.name;
          if (enrollment.program.description) context.programDescription = enrollment.program.description;
        }
      }
    }
    return context;
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
    guardianName: "Sarah Johnson",
    guardianEmail: "sarah@example.com",
    guardianPhone: "(555) 123-4567",
    guardianBalance: "$150.00",
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
    targetUserIds,
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
    targetUserIds,
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
      targetUserIds: targetUserIds || [],
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
    targetUserIds: campaign.targetUserIds,
  });

  let sentCount = 0;
  let failedCount = 0;

  // Send to each recipient with per-recipient placeholder rendering
  for (const recipient of recipients) {
    const context = recipient.userId
      ? await buildRecipientContext(campaign.organizationId, recipient.userId)
      : {
          organizationName: campaign.organization.name,
          currentDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
          currentYear: new Date().getFullYear().toString(),
        };

    // Render placeholders in body
    const personalizedBody = renderPlaceholders(campaign.body, context);

    // Calculate segments
    const segments = calculateSegments(personalizedBody);

    // Resolve pool number for this recipient + org
    const fromNumber = await getPoolNumberForSend(recipient.phone, campaign.organizationId);

    // Create message record
    const smsMessage = await db.smsMessage.create({
      data: {
        organizationId: campaign.organizationId,
        userId: recipient.userId || undefined,
        campaignId,
        to: recipient.phone,
        from: fromNumber,
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
      from: fromNumber,
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
