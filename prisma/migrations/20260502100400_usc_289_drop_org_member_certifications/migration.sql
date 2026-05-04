-- Backfill any remaining JSON certifications into the normalized
-- Certification + MemberCertification tables before dropping the column.
-- Mirrors the logic in prisma/migrate-certifications.ts (now removed).
-- Pre-customer staging is expected to have zero matches; the seeds and the
-- staff API have already moved off the JSON field.

-- Step 1: create one Certification per (organizationId, name) pair.
INSERT INTO "Certification" (
    "id",
    "organizationId",
    "name",
    "evaluationMethod",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT DISTINCT
    gen_random_uuid()::text,
    om."organizationId",
    cert.value->>'name',
    'PASS_FAIL'::"CertificationEvaluationMethod",
    true,
    NOW(),
    NOW()
FROM "OrganizationMember" om
CROSS JOIN LATERAL jsonb_array_elements(om."certifications") AS cert(value)
WHERE om."certifications" IS NOT NULL
  AND jsonb_typeof(om."certifications") = 'array'
  AND cert.value->>'name' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Certification" c
    WHERE c."organizationId" = om."organizationId"
      AND c."name" = cert.value->>'name'
  );

-- Step 2: link each member to the certification they had via MemberCertification.
INSERT INTO "MemberCertification" (
    "id",
    "certificationId",
    "memberId",
    "passed",
    "expiresAt",
    "grantedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    c."id",
    om."id",
    COALESCE((cert.value->>'verified')::boolean, true),
    NULLIF(cert.value->>'expiresAt', '')::timestamptz,
    NOW(),
    NOW(),
    NOW()
FROM "OrganizationMember" om
CROSS JOIN LATERAL jsonb_array_elements(om."certifications") AS cert(value)
JOIN "Certification" c
  ON c."organizationId" = om."organizationId"
 AND c."name" = cert.value->>'name'
WHERE om."certifications" IS NOT NULL
  AND jsonb_typeof(om."certifications") = 'array'
  AND cert.value->>'name' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "MemberCertification" mc
    WHERE mc."certificationId" = c."id"
      AND mc."memberId" = om."id"
  );

-- AlterTable
ALTER TABLE "OrganizationMember" DROP COLUMN "certifications";
