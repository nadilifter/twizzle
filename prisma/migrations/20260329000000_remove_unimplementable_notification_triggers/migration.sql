-- Delete any notification rules using these trigger types before removing the enum values
DELETE FROM "NotificationLog" WHERE "triggerType" IN ('CONTRACT_RENEWAL', 'MAKEUP_CLASS_EXPIRING');
DELETE FROM "NotificationDeduplication" WHERE "ruleId" IN (
  SELECT id FROM "NotificationRule" WHERE "triggerType" IN ('CONTRACT_RENEWAL', 'MAKEUP_CLASS_EXPIRING')
);
DELETE FROM "NotificationRecipientConfig" WHERE "notificationRuleId" IN (
  SELECT id FROM "NotificationRule" WHERE "triggerType" IN ('CONTRACT_RENEWAL', 'MAKEUP_CLASS_EXPIRING')
);
DELETE FROM "NotificationTemplate" WHERE "notificationRuleId" IN (
  SELECT id FROM "NotificationRule" WHERE "triggerType" IN ('CONTRACT_RENEWAL', 'MAKEUP_CLASS_EXPIRING')
);
DELETE FROM "NotificationRule" WHERE "triggerType" IN ('CONTRACT_RENEWAL', 'MAKEUP_CLASS_EXPIRING');

-- Remove the enum values
ALTER TYPE "NotificationTriggerType" RENAME TO "NotificationTriggerType_old";

CREATE TYPE "NotificationTriggerType" AS ENUM (
  'MEMBERSHIP_EXPIRY',
  'MEMBERSHIP_EXPIRED',
  'PAYMENT_DUE',
  'PAYMENT_OVERDUE',
  'PAYMENT_RECEIVED',
  'PROGRAM_REMINDER',
  'PROGRAM_ENROLLMENT',
  'PROGRAM_CANCELLATION',
  'EVENT_REMINDER',
  'EVENT_REGISTRATION_OPEN',
  'EVENT_REGISTRATION_CLOSE',
  'ATTENDANCE_MISSED',
  'SKILL_ACHIEVED',
  'EVALUATION_DUE',
  'EVALUATION_COMPLETED',
  'BIRTHDAY',
  'WAITLIST_OPENING',
  'RECURRING_CHARGE_UPCOMING',
  'RECURRING_CHARGE_SUCCEEDED',
  'RECURRING_CHARGE_FAILED',
  'RECURRING_CHARGE_SUSPENDED',
  'CUSTOM'
);

ALTER TABLE "NotificationRule" ALTER COLUMN "triggerType" TYPE "NotificationTriggerType" USING ("triggerType"::text::"NotificationTriggerType");
ALTER TABLE "NotificationLog" ALTER COLUMN "triggerType" TYPE "NotificationTriggerType" USING ("triggerType"::text::"NotificationTriggerType");

DROP TYPE "NotificationTriggerType_old";
