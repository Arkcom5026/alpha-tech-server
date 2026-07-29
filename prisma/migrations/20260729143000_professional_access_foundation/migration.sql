-- P1 Professional Access Foundation
-- Additive, nullable-first migration. Existing Branch and EmployeeProfile runtime remains valid.

CREATE TYPE "BusinessStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "BusinessMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER');
CREATE TYPE "BusinessMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "ExternalOrganizationType" AS ENUM ('ACCOUNTING_FIRM');
CREATE TYPE "ExternalOrganizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "ExternalOrganizationMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'PROFESSIONAL', 'ASSISTANT', 'VIEWER');
CREATE TYPE "ExternalOrganizationMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "BusinessAccountingFirmAssignmentStatus" AS ENUM ('PENDING_ACCEPTANCE', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'DECLINED');
CREATE TYPE "DelegatedPermissionScopeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');
CREATE TYPE "DelegatedPermissionBranchMode" AS ENUM ('ALL_BUSINESS_BRANCHES', 'SELECTED_BRANCHES', 'NO_BRANCH_CONTEXT');

CREATE TABLE "Business" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "taxId" VARCHAR(13),
  "status" "BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessMembership" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "role" "BusinessMembershipRole" NOT NULL,
  "status" "BusinessMembershipStatus" NOT NULL DEFAULT 'INVITED',
  "invitedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalOrganization" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "taxId" VARCHAR(13),
  "type" "ExternalOrganizationType" NOT NULL DEFAULT 'ACCOUNTING_FIRM',
  "status" "ExternalOrganizationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalOrganization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalOrganizationMembership" (
  "id" SERIAL NOT NULL,
  "externalOrganizationId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "role" "ExternalOrganizationMembershipRole" NOT NULL,
  "status" "ExternalOrganizationMembershipStatus" NOT NULL DEFAULT 'INVITED',
  "invitedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalOrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessAccountingFirmAssignment" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "externalOrganizationId" INTEGER NOT NULL,
  "status" "BusinessAccountingFirmAssignmentStatus" NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
  "requestedByUserId" INTEGER NOT NULL,
  "acceptedByUserId" INTEGER,
  "revokedByUserId" INTEGER,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveUntil" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessAccountingFirmAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DelegatedPermissionScope" (
  "id" SERIAL NOT NULL,
  "assignmentId" INTEGER NOT NULL,
  "status" "DelegatedPermissionScopeStatus" NOT NULL DEFAULT 'DRAFT',
  "resource" TEXT NOT NULL,
  "actions" TEXT[],
  "branchMode" "DelegatedPermissionBranchMode" NOT NULL,
  "branchIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "constraints" JSONB,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveUntil" TIMESTAMP(3),
  "grantedByUserId" INTEGER NOT NULL,
  "revokedByUserId" INTEGER,
  "activatedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DelegatedPermissionScope_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Branch" ADD COLUMN "businessId" INTEGER;

CREATE INDEX "Business_status_idx" ON "Business"("status");
CREATE INDEX "Business_taxId_idx" ON "Business"("taxId");
CREATE UNIQUE INDEX "BusinessMembership_businessId_userId_key" ON "BusinessMembership"("businessId", "userId");
CREATE INDEX "BusinessMembership_userId_status_idx" ON "BusinessMembership"("userId", "status");
CREATE INDEX "BusinessMembership_businessId_role_status_idx" ON "BusinessMembership"("businessId", "role", "status");
CREATE INDEX "ExternalOrganization_type_status_idx" ON "ExternalOrganization"("type", "status");
CREATE INDEX "ExternalOrganization_taxId_idx" ON "ExternalOrganization"("taxId");
CREATE UNIQUE INDEX "ExternalOrganizationMembership_externalOrganizationId_userId_key" ON "ExternalOrganizationMembership"("externalOrganizationId", "userId");
CREATE INDEX "ExternalOrganizationMembership_userId_status_idx" ON "ExternalOrganizationMembership"("userId", "status");
CREATE INDEX "ExternalOrganizationMembership_externalOrganizationId_role_status_idx" ON "ExternalOrganizationMembership"("externalOrganizationId", "role", "status");
CREATE INDEX "BusinessAccountingFirmAssignment_businessId_status_idx" ON "BusinessAccountingFirmAssignment"("businessId", "status");
CREATE INDEX "BusinessAccountingFirmAssignment_externalOrganizationId_status_idx" ON "BusinessAccountingFirmAssignment"("externalOrganizationId", "status");
CREATE INDEX "BusinessAccountingFirmAssignment_effectiveFrom_effectiveUntil_idx" ON "BusinessAccountingFirmAssignment"("effectiveFrom", "effectiveUntil");
CREATE INDEX "DelegatedPermissionScope_assignmentId_status_idx" ON "DelegatedPermissionScope"("assignmentId", "status");
CREATE INDEX "DelegatedPermissionScope_resource_status_idx" ON "DelegatedPermissionScope"("resource", "status");
CREATE INDEX "DelegatedPermissionScope_effectiveFrom_effectiveUntil_idx" ON "DelegatedPermissionScope"("effectiveFrom", "effectiveUntil");
CREATE INDEX "Branch_businessId_idx" ON "Branch"("businessId");

ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalOrganizationMembership" ADD CONSTRAINT "ExternalOrganizationMembership_externalOrganizationId_fkey" FOREIGN KEY ("externalOrganizationId") REFERENCES "ExternalOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalOrganizationMembership" ADD CONSTRAINT "ExternalOrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessAccountingFirmAssignment" ADD CONSTRAINT "BusinessAccountingFirmAssignment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessAccountingFirmAssignment" ADD CONSTRAINT "BusinessAccountingFirmAssignment_externalOrganizationId_fkey" FOREIGN KEY ("externalOrganizationId") REFERENCES "ExternalOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessAccountingFirmAssignment" ADD CONSTRAINT "BusinessAccountingFirmAssignment_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessAccountingFirmAssignment" ADD CONSTRAINT "BusinessAccountingFirmAssignment_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessAccountingFirmAssignment" ADD CONSTRAINT "BusinessAccountingFirmAssignment_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegatedPermissionScope" ADD CONSTRAINT "DelegatedPermissionScope_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "BusinessAccountingFirmAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegatedPermissionScope" ADD CONSTRAINT "DelegatedPermissionScope_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegatedPermissionScope" ADD CONSTRAINT "DelegatedPermissionScope_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
