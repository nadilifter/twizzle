-- Defensive backfill: any Athlete with a non-null medicalDetails JSON that has
-- not yet been migrated to AthleteMedicalInfo gets a row created here so the
-- data isn't lost when the legacy column is dropped. Pre-customer staging is
-- expected to have zero matches; the seeds already populate AthleteMedicalInfo
-- separately.
INSERT INTO "AthleteMedicalInfo" (
    "id",
    "athleteId",
    "allergies",
    "medications",
    "conditions",
    "dietaryRestrictions",
    "emergencyContactName",
    "emergencyContactPhone",
    "emergencyContactRelation",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    a."id",
    COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(a."medicalDetails"->'allergies')),
        ARRAY[]::text[]
    ),
    ARRAY[]::text[],
    COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(a."medicalDetails"->'conditions')),
        ARRAY[]::text[]
    ),
    ARRAY[]::text[],
    a."medicalDetails"->'emergencyContact'->>'name',
    a."medicalDetails"->'emergencyContact'->>'phone',
    a."medicalDetails"->'emergencyContact'->>'relation',
    NOW(),
    NOW()
FROM "Athlete" a
WHERE a."medicalDetails" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "AthleteMedicalInfo" ami WHERE ami."athleteId" = a."id"
  );

-- AlterTable
ALTER TABLE "Athlete" DROP COLUMN "medicalDetails";
