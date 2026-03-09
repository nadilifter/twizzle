-- CreateEnum
CREATE TYPE "CertificationEvaluationMethod" AS ENUM ('PASS_FAIL', 'POINT_SCALE');

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteria" TEXT,
    "evaluationMethod" "CertificationEvaluationMethod" NOT NULL DEFAULT 'PASS_FAIL',
    "pointScaleMin" INTEGER NOT NULL DEFAULT 1,
    "pointScaleMax" INTEGER NOT NULL DEFAULT 10,
    "passThreshold" INTEGER NOT NULL DEFAULT 7,
    "renewalPeriodMonths" INTEGER,
    "requiredForPrograms" BOOLEAN NOT NULL DEFAULT false,
    "requiredForEvents" BOOLEAN NOT NULL DEFAULT false,
    "requiredForCompetitions" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberCertification" (
    "id" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "grantedById" TEXT,
    "passed" BOOLEAN NOT NULL,
    "score" INTEGER,
    "notes" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCertification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Certification_organizationId_idx" ON "Certification"("organizationId");

-- CreateIndex
CREATE INDEX "MemberCertification_certificationId_idx" ON "MemberCertification"("certificationId");

-- CreateIndex
CREATE INDEX "MemberCertification_memberId_idx" ON "MemberCertification"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberCertification_certificationId_memberId_key" ON "MemberCertification"("certificationId", "memberId");

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCertification" ADD CONSTRAINT "MemberCertification_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCertification" ADD CONSTRAINT "MemberCertification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCertification" ADD CONSTRAINT "MemberCertification_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "OrganizationMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
