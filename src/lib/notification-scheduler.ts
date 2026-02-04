/**
 * Notification Scheduler Service
 * 
 * Automated scheduler for processing notification rules based on timing configuration.
 * This service is called by a cron job to evaluate rules and send notifications.
 * 
 * Key responsibilities:
 * - Iterate through all organizations with active notification rules
 * - Evaluate each rule's timing against current date
 * - Find entities matching trigger criteria (memberships, invoices, events, etc.)
 * - Deduplicate to prevent sending the same notification twice
 * - Execute notifications via the notification-service
 */

import { db } from "@/lib/db";
import { executeNotification } from "@/lib/notification-service";
import { logger } from "@/lib/logger";
import type {
  NotificationRule,
  NotificationTriggerType,
  NotificationTimingUnit,
  NotificationTimingDirection,
} from "@prisma/client";

// ============================================
// Types
// ============================================

export interface SchedulerResult {
  success: boolean;
  organizationsProcessed: number;
  rulesEvaluated: number;
  notificationsSent: number;
  notificationsSkipped: number;
  notificationsFailed: number;
  errors: string[];
  durationMs: number;
}

export interface OrganizationProcessResult {
  organizationId: string;
  rulesEvaluated: number;
  notificationsSent: number;
  notificationsSkipped: number;
  notificationsFailed: number;
  errors: string[];
}

export interface EntityMatch {
  entityType: string;
  entityId: string;
  familyId: string;
  athleteId?: string;
  membershipId?: string;
  invoiceId?: string;
  eventId?: string;
  programId?: string;
}

type RuleWithRelations = NotificationRule & {
  template: { subject: string | null; body: string; smsBody: string | null } | null;
  recipientConfig: { recipientType: string; filters: unknown } | null;
};

// ============================================
// Main Scheduler Functions
// ============================================

/**
 * Main entry point: Process notifications for all organizations
 */
export async function processAllOrganizations(): Promise<SchedulerResult> {
  const startTime = Date.now();
  const result: SchedulerResult = {
    success: true,
    organizationsProcessed: 0,
    rulesEvaluated: 0,
    notificationsSent: 0,
    notificationsSkipped: 0,
    notificationsFailed: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    // Get all organizations that have at least one active notification rule
    const organizations = await db.organization.findMany({
      where: {
        notificationRules: {
          some: {
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    logger.info(`[SCHEDULER] Processing ${organizations.length} organizations with active rules`);

    for (const org of organizations) {
      try {
        const orgResult = await processOrganizationNotifications(org.id);
        
        result.organizationsProcessed++;
        result.rulesEvaluated += orgResult.rulesEvaluated;
        result.notificationsSent += orgResult.notificationsSent;
        result.notificationsSkipped += orgResult.notificationsSkipped;
        result.notificationsFailed += orgResult.notificationsFailed;
        result.errors.push(...orgResult.errors);
      } catch (error: any) {
        const errorMsg = `Failed to process organization ${org.id}: ${error.message}`;
        logger.error(`[SCHEDULER] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
  } catch (error: any) {
    const errorMsg = `Scheduler failed: ${error.message}`;
    logger.error(`[SCHEDULER] ${errorMsg}`);
    result.errors.push(errorMsg);
    result.success = false;
  }

  result.durationMs = Date.now() - startTime;
  result.success = result.errors.length === 0;

  logger.info(`[SCHEDULER] Completed in ${result.durationMs}ms`, {
    organizations: result.organizationsProcessed,
    rules: result.rulesEvaluated,
    sent: result.notificationsSent,
    skipped: result.notificationsSkipped,
    failed: result.notificationsFailed,
  });

  return result;
}

/**
 * Process all notification rules for a single organization
 */
export async function processOrganizationNotifications(
  organizationId: string
): Promise<OrganizationProcessResult> {
  const result: OrganizationProcessResult = {
    organizationId,
    rulesEvaluated: 0,
    notificationsSent: 0,
    notificationsSkipped: 0,
    notificationsFailed: 0,
    errors: [],
  };

  // Get all active rules for this organization
  const rules = await db.notificationRule.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    include: {
      template: true,
      recipientConfig: true,
    },
  });

  logger.info(`[SCHEDULER] Org ${organizationId}: evaluating ${rules.length} rules`);

  for (const rule of rules) {
    result.rulesEvaluated++;

    try {
      // Check if this rule's timing matches current conditions
      if (!shouldTriggerRule(rule)) {
        continue;
      }

      // Find entities that match this rule's trigger criteria
      const entities = await findMatchingEntities(rule, organizationId);

      if (entities.length === 0) {
        continue;
      }

      logger.info(`[SCHEDULER] Rule "${rule.name}": found ${entities.length} matching entities`);

      // Process each entity
      for (const entity of entities) {
        // Check deduplication
        const alreadySent = await hasAlreadySentNotification(
          rule.id,
          entity.entityType,
          entity.entityId,
          entity.familyId
        );

        if (alreadySent) {
          result.notificationsSkipped++;
          continue;
        }

        // Execute the notification
        try {
          const execResult = await executeNotification({
            ruleId: rule.id,
            athleteId: entity.athleteId,
            familyId: entity.familyId,
            membershipId: entity.membershipId,
            invoiceId: entity.invoiceId,
            eventId: entity.eventId,
            programId: entity.programId,
          });

          if (execResult.success) {
            result.notificationsSent += execResult.sentCount;
            result.notificationsSkipped += execResult.skippedCount;
            result.notificationsFailed += execResult.failedCount;

            // Record deduplication
            await recordNotificationSent(
              rule.id,
              entity.entityType,
              entity.entityId,
              entity.familyId
            );
          } else {
            result.notificationsFailed++;
            result.errors.push(...execResult.errors);
          }
        } catch (error: any) {
          result.notificationsFailed++;
          result.errors.push(`Failed to execute notification: ${error.message}`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Rule "${rule.name}" error: ${error.message}`);
    }
  }

  return result;
}

// ============================================
// Rule Timing Evaluation
// ============================================

/**
 * Check if a rule should trigger based on its timing configuration
 * 
 * Rules define:
 * - timingValue: number (e.g., 3)
 * - timingUnit: MINUTES | HOURS | DAYS | WEEKS | MONTHS
 * - timingDirection: BEFORE | AFTER | AT
 * 
 * Example: "3 DAYS BEFORE" membership expiry
 * This means we send the notification when membership expires in exactly 3 days
 */
export function shouldTriggerRule(rule: NotificationRule): boolean {
  // For "AT" direction, we process based on the trigger type's natural timing
  // For "BEFORE" or "AFTER", we've already calculated the target date in findMatchingEntities
  // Here we just verify the rule is in a valid state to process
  
  // Rules with no template can't be processed
  if (!rule.triggerType) {
    return false;
  }

  return true;
}

/**
 * Calculate the date offset based on timing configuration
 * 
 * For minute/hour granularity: Uses current time as base with narrow windows
 * For day/week/month granularity: Uses start of day as base with full-day windows
 */
export function calculateDateOffset(
  timingValue: number,
  timingUnit: NotificationTimingUnit,
  timingDirection: NotificationTimingDirection
): { startDate: Date; endDate: Date } {
  const now = new Date();
  
  // For fine-grained timing (minutes/hours), use current time as base
  // For coarse timing (days+), use start of day as base
  const useFinePrecision = timingUnit === "MINUTES" || timingUnit === "HOURS";
  
  // Calculate offset in milliseconds
  let offsetMs = 0;
  switch (timingUnit) {
    case "MINUTES":
      offsetMs = timingValue * 60 * 1000;
      break;
    case "HOURS":
      offsetMs = timingValue * 60 * 60 * 1000;
      break;
    case "DAYS":
      offsetMs = timingValue * 24 * 60 * 60 * 1000;
      break;
    case "WEEKS":
      offsetMs = timingValue * 7 * 24 * 60 * 60 * 1000;
      break;
    case "MONTHS":
      // Approximate months as 30 days
      offsetMs = timingValue * 30 * 24 * 60 * 60 * 1000;
      break;
  }

  let targetDate: Date;
  let startDate: Date;
  let endDate: Date;
  
  if (useFinePrecision) {
    // For minutes/hours: Calculate from current time with a narrow window
    // Window size matches cron frequency (5 minutes) to ensure we catch events
    const CRON_WINDOW_MS = 5 * 60 * 1000; // 5 minutes - matches cron schedule
    
    if (timingDirection === "BEFORE") {
      // Looking for events happening in `timingValue` units from now
      // Window: [now + offset, now + offset + CRON_WINDOW)
      targetDate = new Date(now.getTime() + offsetMs);
      startDate = targetDate;
      endDate = new Date(targetDate.getTime() + CRON_WINDOW_MS - 1);
    } else if (timingDirection === "AFTER") {
      // Looking for events that happened `timingValue` units ago
      // Window: [now - offset - CRON_WINDOW, now - offset)
      targetDate = new Date(now.getTime() - offsetMs);
      startDate = new Date(targetDate.getTime() - CRON_WINDOW_MS + 1);
      endDate = targetDate;
    } else {
      // AT - right now (with small window)
      startDate = now;
      endDate = new Date(now.getTime() + CRON_WINDOW_MS - 1);
    }
  } else {
    // For days/weeks/months: Use full-day windows
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (timingDirection === "BEFORE") {
      targetDate = new Date(today.getTime() + offsetMs);
    } else if (timingDirection === "AFTER") {
      targetDate = new Date(today.getTime() - offsetMs);
    } else {
      targetDate = today;
    }

    // Return a date range for the target day (start of day to end of day)
    startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    endDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
  }

  return { startDate, endDate };
}

// ============================================
// Entity Matching by Trigger Type
// ============================================

/**
 * Find entities matching a rule's trigger criteria
 */
export async function findMatchingEntities(
  rule: RuleWithRelations,
  organizationId: string
): Promise<EntityMatch[]> {
  const { startDate, endDate } = calculateDateOffset(
    rule.timingValue,
    rule.timingUnit,
    rule.timingDirection
  );

  switch (rule.triggerType) {
    case "MEMBERSHIP_EXPIRY":
      return findExpiringMemberships(organizationId, startDate, endDate, false);
    
    case "MEMBERSHIP_EXPIRED":
      return findExpiringMemberships(organizationId, startDate, endDate, true);
    
    case "PAYMENT_DUE":
      return findDueInvoices(organizationId, startDate, endDate, false);
    
    case "PAYMENT_OVERDUE":
      return findDueInvoices(organizationId, startDate, endDate, true);
    
    case "PAYMENT_RECEIVED":
      return findRecentPayments(organizationId, startDate, endDate);
    
    case "PROGRAM_REMINDER":
      return findUpcomingProgramSessions(organizationId, startDate, endDate);
    
    case "EVENT_REMINDER":
      return findUpcomingEvents(organizationId, startDate, endDate);
    
    case "BIRTHDAY":
      return findBirthdays(organizationId);
    
    case "EVALUATION_DUE":
      return findDueEvaluations(organizationId, startDate, endDate);
    
    case "SKILL_ACHIEVED":
      return findRecentSkillAchievements(organizationId, startDate, endDate);
    
    default:
      // For unsupported or CUSTOM triggers, return empty
      return [];
  }
}

/**
 * Find memberships expiring/expired within the date range
 */
async function findExpiringMemberships(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  expired: boolean
): Promise<EntityMatch[]> {
  const memberships = await db.athleteMembership.findMany({
    where: {
      athlete: { organizationId },
      endDate: {
        gte: startDate,
        lte: endDate,
      },
      status: expired ? "EXPIRED" : "ACTIVE",
    },
    include: {
      athlete: {
        include: {
          guardians: {
            include: {
              family: {
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  const entities: EntityMatch[] = [];
  
  for (const membership of memberships) {
    for (const guardian of membership.athlete.guardians) {
      entities.push({
        entityType: "membership",
        entityId: membership.id,
        familyId: guardian.family.id,
        athleteId: membership.athleteId,
        membershipId: membership.id,
      });
    }
  }

  return entities;
}

/**
 * Find invoices due/overdue within the date range
 */
async function findDueInvoices(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  overdue: boolean
): Promise<EntityMatch[]> {
  const now = new Date();
  
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      dueDate: overdue
        ? { lte: now } // Overdue: due date in the past
        : { gte: startDate, lte: endDate }, // Due: within range
      status: { in: ["DRAFT", "SENT"] }, // DRAFT = unpaid, SENT = sent but unpaid
    },
    include: {
      family: {
        select: { id: true },
      },
    },
  });

  return invoices.map((invoice) => ({
    entityType: "invoice",
    entityId: invoice.id,
    familyId: invoice.familyId,
    invoiceId: invoice.id,
  }));
}

/**
 * Find recently received payments
 */
async function findRecentPayments(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<EntityMatch[]> {
  const payments = await db.payment.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: "COMPLETED",
    },
    include: {
      family: {
        select: { id: true },
      },
    },
  });

  return payments.map((payment) => ({
    entityType: "payment",
    entityId: payment.id,
    familyId: payment.familyId,
  }));
}

/**
 * Find upcoming program sessions (classes)
 */
async function findUpcomingProgramSessions(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<EntityMatch[]> {
  // Find events that are program sessions happening within the date range
  const events = await db.event.findMany({
    where: {
      organizationId,
      programId: { not: null },
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      program: {
        include: {
          enrollments: {
            where: { status: "ACTIVE" },
            include: {
              athlete: {
                include: {
                  guardians: {
                    include: {
                      family: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const entities: EntityMatch[] = [];
  
  for (const event of events) {
    if (!event.program) continue;
    
    for (const enrollment of event.program.enrollments) {
      for (const guardian of enrollment.athlete.guardians) {
        entities.push({
          entityType: "program_session",
          entityId: event.id,
          familyId: guardian.family.id,
          athleteId: enrollment.athleteId,
          programId: event.programId!,
          eventId: event.id,
        });
      }
    }
  }

  return entities;
}

/**
 * Find upcoming events (competitions, meets, etc.)
 */
async function findUpcomingEvents(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<EntityMatch[]> {
  const events = await db.event.findMany({
    where: {
      organizationId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      // Non-program events (standalone events like competitions)
      programId: null,
    },
    include: {
      attendances: {
        include: {
          athlete: {
            include: {
              guardians: {
                include: {
                  family: { select: { id: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const entities: EntityMatch[] = [];
  
  for (const event of events) {
    for (const attendance of event.attendances) {
      for (const guardian of attendance.athlete.guardians) {
        entities.push({
          entityType: "event",
          entityId: event.id,
          familyId: guardian.family.id,
          athleteId: attendance.athleteId,
          eventId: event.id,
        });
      }
    }
  }

  return entities;
}

/**
 * Find athletes with birthdays today
 */
async function findBirthdays(organizationId: string): Promise<EntityMatch[]> {
  const today = new Date();
  const month = today.getMonth() + 1; // JavaScript months are 0-indexed
  const day = today.getDate();

  // Find athletes whose birth month and day match today
  const athletes = await db.athlete.findMany({
    where: {
      organizationId,
      birthDate: { not: null },
      status: "ACTIVE",
    },
    include: {
      guardians: {
        include: {
          family: { select: { id: true } },
        },
      },
    },
  });

  const birthdayAthletes = athletes.filter((athlete) => {
    if (!athlete.birthDate) return false;
    const birthMonth = athlete.birthDate.getMonth() + 1;
    const birthDay = athlete.birthDate.getDate();
    return birthMonth === month && birthDay === day;
  });

  const entities: EntityMatch[] = [];
  
  for (const athlete of birthdayAthletes) {
    for (const guardian of athlete.guardians) {
      entities.push({
        entityType: "birthday",
        entityId: athlete.id,
        familyId: guardian.family.id,
        athleteId: athlete.id,
      });
    }
  }

  return entities;
}

/**
 * Find evaluations that are due
 */
async function findDueEvaluations(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<EntityMatch[]> {
  const evaluations = await db.evaluation.findMany({
    where: {
      athlete: { organizationId },
      // No completedAt means it's pending
      completedAt: null,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      athlete: {
        include: {
          guardians: {
            include: {
              family: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  const entities: EntityMatch[] = [];
  
  for (const evaluation of evaluations) {
    for (const guardian of evaluation.athlete.guardians) {
      entities.push({
        entityType: "evaluation",
        entityId: evaluation.id,
        familyId: guardian.family.id,
        athleteId: evaluation.athleteId,
      });
    }
  }

  return entities;
}

/**
 * Find recent skill achievements
 */
async function findRecentSkillAchievements(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<EntityMatch[]> {
  const achievements = await db.athleteSkillProgress.findMany({
    where: {
      athlete: { organizationId },
      status: "ACHIEVED",
      achievedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      athlete: {
        include: {
          guardians: {
            include: {
              family: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  const entities: EntityMatch[] = [];
  
  for (const achievement of achievements) {
    for (const guardian of achievement.athlete.guardians) {
      entities.push({
        entityType: "skill_achievement",
        entityId: achievement.id,
        familyId: guardian.family.id,
        athleteId: achievement.athleteId,
      });
    }
  }

  return entities;
}

// ============================================
// Deduplication Functions
// ============================================

/**
 * Check if we've already sent this notification
 */
async function hasAlreadySentNotification(
  ruleId: string,
  entityType: string,
  entityId: string,
  familyId: string
): Promise<boolean> {
  const existing = await db.notificationDeduplication.findUnique({
    where: {
      ruleId_entityType_entityId_familyId: {
        ruleId,
        entityType,
        entityId,
        familyId,
      },
    },
  });

  return existing !== null;
}

/**
 * Record that we've sent a notification
 */
async function recordNotificationSent(
  ruleId: string,
  entityType: string,
  entityId: string,
  familyId: string
): Promise<void> {
  await db.notificationDeduplication.upsert({
    where: {
      ruleId_entityType_entityId_familyId: {
        ruleId,
        entityType,
        entityId,
        familyId,
      },
    },
    update: {
      sentAt: new Date(),
    },
    create: {
      ruleId,
      entityType,
      entityId,
      familyId,
    },
  });
}

/**
 * Clean up old deduplication records (older than 90 days)
 * Call this periodically to prevent table bloat
 */
export async function cleanupOldDeduplicationRecords(): Promise<number> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 90);

  const result = await db.notificationDeduplication.deleteMany({
    where: {
      sentAt: { lt: threshold },
    },
  });

  logger.info(`[SCHEDULER] Cleaned up ${result.count} old deduplication records`);
  return result.count;
}
