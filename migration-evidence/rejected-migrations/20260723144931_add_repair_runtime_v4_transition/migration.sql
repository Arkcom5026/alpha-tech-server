/*
  Warnings:

  - You are about to drop the column `deviceModel` on the `RepairJob` table. All the data in the column will be lost.
  - The `status` column on the `RepairJob` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[branchId,jobNo]` on the table `RepairJob` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[repairWorkItemId]` on the table `WarrantyClaim` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `RepairPartItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ServiceCaseStatus" AS ENUM ('DRAFT', 'OPEN', 'TRIAGE', 'DIAGNOSING', 'WAITING_CUSTOMER', 'IN_SERVICE', 'WAITING_EXTERNAL', 'QUALITY_CHECK', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ServiceCasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."ServiceCaseIntakeChannel" AS ENUM ('WALK_IN', 'PHONE', 'ONLINE', 'DELIVERY', 'INTERNAL');

-- CreateEnum
CREATE TYPE "public"."ServiceCaseAssetRole" AS ENUM ('PRIMARY', 'COMPONENT', 'ACCESSORY', 'REPLACEMENT', 'LOANER');

-- CreateEnum
CREATE TYPE "public"."ServiceAssetOwnershipType" AS ENUM ('CUSTOMER_OWNED', 'STORE_SOLD', 'STORE_OWNED', 'SUPPLIER_OWNED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."ServiceCaseEventType" AS ENUM ('CASE_OPENED', 'STATUS_CHANGED', 'ASSET_ATTACHED', 'ASSET_DETACHED', 'DIAGNOSIS_RECORDED', 'ESTIMATE_OFFERED', 'CUSTOMER_DECISION_RECORDED', 'REPAIR_STARTED', 'REPAIR_COMPLETED', 'CLAIM_OPENED', 'CLAIM_UPDATED', 'CUSTODY_TRANSFERRED', 'QUALITY_CHECK_COMPLETED', 'READY_FOR_DELIVERY', 'DELIVERED', 'CASE_CLOSED', 'CASE_CANCELLED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "public"."ServiceCaseSourceType" AS ENUM ('SERVICE_CASE', 'REPAIR_JOB', 'WARRANTY_CLAIM', 'STOCK_MOVEMENT', 'PAYMENT', 'DELIVERY');

-- CreateEnum
CREATE TYPE "public"."ServiceCustodianType" AS ENUM ('CUSTOMER', 'BRANCH', 'EMPLOYEE', 'TECHNICIAN', 'CARRIER', 'SUPPLIER', 'SERVICE_PROVIDER', 'THIRD_PARTY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."ServiceCaseLinkType" AS ENUM ('FOLLOW_UP', 'REOPENED_FROM', 'REPLACEMENT_FOR', 'DUPLICATE_OF', 'RELATED');

-- CreateEnum
CREATE TYPE "public"."RepairJobStatus" AS ENUM ('DRAFT', 'RECEIVED', 'DIAGNOSING', 'WAITING_CUSTOMER_APPROVAL', 'IN_SERVICE', 'WAITING_EXTERNAL_SERVICE', 'QUALITY_CHECK', 'READY_FOR_PICKUP', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."RepairCloseOutcome" AS ENUM ('REPAIRED_AND_DELIVERED', 'CLAIM_REPLACEMENT_DELIVERED', 'RETURNED_UNREPAIRED', 'NO_FAULT_FOUND', 'CUSTOMER_DECLINED', 'RETURN_RECOMMENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."RepairFollowUpRecommendation" AS ENUM ('NONE', 'START_SALE_RETURN', 'START_NEW_REPAIR', 'REFER_EXTERNAL_SERVICE', 'CUSTOMER_MONITORING');

-- CreateEnum
CREATE TYPE "public"."RepairEvidenceType" AS ENUM ('INTAKE_PHOTO', 'INTAKE_VIDEO', 'CONDITION_PHOTO', 'DIAGNOSIS_PHOTO', 'DIAGNOSIS_DOCUMENT', 'CUSTOMER_APPROVAL', 'CLAIM_DOCUMENT', 'REPAIR_RESULT', 'QUALITY_TEST', 'DELIVERY_SIGNATURE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RepairRecommendedAction" AS ENUM ('INTERNAL_REPAIR', 'WARRANTY_CLAIM', 'PAID_EXTERNAL_REPAIR', 'REPLACE_DEVICE', 'RETURN_UNREPAIRED', 'WAIT_CUSTOMER_APPROVAL');

-- CreateEnum
CREATE TYPE "public"."RepairWarrantyEligibility" AS ENUM ('UNKNOWN', 'ELIGIBLE', 'NOT_ELIGIBLE', 'EXPIRED', 'NO_PROOF', 'PHYSICAL_DAMAGE_EXCLUDED', 'REQUIRES_PROVIDER_CONFIRMATION');

-- CreateEnum
CREATE TYPE "public"."RepairEstimateStatus" AS ENUM ('DRAFT', 'OFFERED', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."RepairEstimateItemType" AS ENUM ('LABOR', 'PART', 'DIAGNOSIS_FEE', 'EXTERNAL_SERVICE', 'DATA_SERVICE', 'SHIPPING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RepairApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'PARTIALLY_APPROVED');

-- CreateEnum
CREATE TYPE "public"."RepairApprovalMethod" AS ENUM ('IN_PERSON', 'PHONE', 'SMS', 'CHAT', 'EMAIL', 'SIGNATURE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RepairWorkItemType" AS ENUM ('DIAGNOSIS', 'INTERNAL_LABOR', 'PART_REPLACEMENT', 'WARRANTY_CLAIM', 'EXTERNAL_PAID_SERVICE', 'DATA_SERVICE', 'QUALITY_TEST', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RepairWorkItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."RepairJobEventType" AS ENUM ('CREATED', 'RECEIVED', 'ASSIGNED', 'STATUS_CHANGED', 'DIAGNOSIS_RECORDED', 'ESTIMATE_OFFERED', 'CUSTOMER_APPROVED', 'CUSTOMER_REJECTED', 'WORK_STARTED', 'PART_ISSUED', 'PART_RETURNED', 'CLAIM_OPENED', 'CLAIM_RESOLVED', 'QUALITY_CHECKED', 'READY_FOR_PICKUP', 'DELIVERED', 'CLOSED', 'CANCELLED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "public"."RepairCustodianType" AS ENUM ('CUSTOMER', 'BRANCH', 'TECHNICIAN', 'CARRIER', 'SUPPLIER', 'SERVICE_PROVIDER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."WarrantyClaimRepairLinkState" AS ENUM ('UNLINKED_LEGACY', 'LINKED_VERIFIED', 'MANUAL_REVIEW_REQUIRED');

-- DropForeignKey
ALTER TABLE "public"."RepairJob" DROP CONSTRAINT "RepairJob_stockItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RepairJob" DROP CONSTRAINT "RepairJob_technicianId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RepairPartItem" DROP CONSTRAINT "RepairPartItem_repairJobId_fkey";

-- DropIndex
DROP INDEX "public"."RepairJob_branchId_idx";

-- DropIndex
DROP INDEX "public"."RepairJob_jobNo_key";

-- AlterTable
ALTER TABLE "public"."RepairJob" DROP COLUMN "deviceModel",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "closeOutcome" "public"."RepairCloseOutcome",
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "diagnosisCompletedAt" TIMESTAMP(3),
ADD COLUMN     "finalDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "finalLaborAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "finalPartsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "finalTotalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "followUpRecommendation" "public"."RepairFollowUpRecommendation" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "intakeNote" TEXT,
ADD COLUMN     "readyForPickupAt" TIMESTAMP(3),
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedByEmployeeId" INTEGER,
ADD COLUMN     "serviceCaseId" INTEGER,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "customerId" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "public"."RepairJobStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "public"."RepairPartItem" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "issuedByEmployeeId" INTEGER,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "qtyIssued" DECIMAL(12,2) NOT NULL DEFAULT 1,
ADD COLUMN     "qtyReturned" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "repairWorkItemId" INTEGER,
ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "simpleLotId" INTEGER,
ADD COLUMN     "stockItemId" INTEGER,
ADD COLUMN     "unitCost" DECIMAL(12,2),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "qtyUsed" SET DEFAULT 1,
ALTER COLUMN "qtyUsed" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "public"."SaleReturn" ADD COLUMN     "sourceRepairJobId" INTEGER;

-- AlterTable
ALTER TABLE "public"."WarrantyClaim" ADD COLUMN     "eligibilitySnapshot" JSONB,
ADD COLUMN     "repairDiagnosisId" INTEGER,
ADD COLUMN     "repairJobId" INTEGER,
ADD COLUMN     "repairLinkState" "public"."WarrantyClaimRepairLinkState" NOT NULL DEFAULT 'UNLINKED_LEGACY',
ADD COLUMN     "repairWorkItemId" INTEGER,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "public"."RepairDevice" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "imei" TEXT,
    "serviceTag" TEXT,
    "color" TEXT,
    "customerDeclaredPurchaseAt" TIMESTAMP(3),
    "proofOfPurchaseReference" TEXT,
    "intakeCondition" TEXT,
    "dataRiskAcknowledgedAt" TIMESTAMP(3),
    "unlockSecretReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairAccessory" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairEvidence" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "evidenceType" "public"."RepairEvidenceType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "caption" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByEmployeeId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairDiagnosis" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "observedSymptoms" TEXT,
    "diagnosis" TEXT NOT NULL,
    "rootCause" TEXT,
    "recommendedAction" "public"."RepairRecommendedAction" NOT NULL,
    "warrantyEligibility" "public"."RepairWarrantyEligibility" NOT NULL DEFAULT 'UNKNOWN',
    "warrantySource" TEXT,
    "warrantyExpiresAt" TIMESTAMP(3),
    "diagnosisNote" TEXT,
    "diagnosedByEmployeeId" INTEGER,
    "diagnosedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairEstimate" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "public"."RepairEstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "laborAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "partsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "note" TEXT,
    "createdByEmployeeId" INTEGER,
    "offeredAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairEstimateItem" (
    "id" SERIAL NOT NULL,
    "estimateId" INTEGER NOT NULL,
    "itemType" "public"."RepairEstimateItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "productId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairEstimateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairApproval" (
    "id" SERIAL NOT NULL,
    "repairEstimateId" INTEGER NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "decision" "public"."RepairApprovalDecision" NOT NULL,
    "approvalMethod" "public"."RepairApprovalMethod" NOT NULL,
    "approvedAmount" DECIMAL(12,2),
    "note" TEXT,
    "evidenceReference" TEXT,
    "recordedByEmployeeId" INTEGER,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairWorkItem" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "public"."RepairWorkItemType" NOT NULL,
    "status" "public"."RepairWorkItemStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedToEmployeeId" INTEGER,
    "estimatedAmount" DECIMAL(12,2),
    "actualAmount" DECIMAL(12,2),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairJobEvent" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "eventType" "public"."RepairJobEventType" NOT NULL,
    "fromStatus" "public"."RepairJobStatus",
    "toStatus" "public"."RepairJobStatus",
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedByEmployeeId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairJobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairCustodyEvent" (
    "id" SERIAL NOT NULL,
    "serviceCaseId" INTEGER,
    "repairJobId" INTEGER NOT NULL,
    "warrantyClaimId" INTEGER,
    "fromCustodianType" "public"."RepairCustodianType",
    "fromCustodianRef" TEXT,
    "toCustodianType" "public"."RepairCustodianType" NOT NULL,
    "toCustodianRef" TEXT,
    "transferReference" TEXT,
    "trackingNumber" TEXT,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "note" TEXT,
    "performedByEmployeeId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairCustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairDeliveryConfirmation" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT,
    "recipientRelationship" TEXT,
    "resultSummary" TEXT,
    "remainingIssueNote" TEXT,
    "customerAccepted" BOOLEAN NOT NULL DEFAULT false,
    "signatureReference" TEXT,
    "confirmedByEmployeeId" INTEGER,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairDeliveryConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairCompletionCommand" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "commandKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairCompletionCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceCase" (
    "id" SERIAL NOT NULL,
    "caseNo" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "primaryStockItemId" INTEGER,
    "status" "public"."ServiceCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "public"."ServiceCasePriority" NOT NULL DEFAULT 'NORMAL',
    "intakeChannel" "public"."ServiceCaseIntakeChannel" NOT NULL DEFAULT 'WALK_IN',
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "currentCustodianType" "public"."ServiceCustodianType",
    "currentCustodianRef" TEXT,
    "currentLocationNote" TEXT,
    "openedByEmployeeId" INTEGER,
    "closedByEmployeeId" INTEGER,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceCaseAsset" (
    "id" SERIAL NOT NULL,
    "serviceCaseId" INTEGER NOT NULL,
    "stockItemId" INTEGER,
    "role" "public"."ServiceCaseAssetRole" NOT NULL DEFAULT 'PRIMARY',
    "assetType" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "imei" TEXT,
    "serviceTag" TEXT,
    "color" TEXT,
    "ownershipType" "public"."ServiceAssetOwnershipType" NOT NULL DEFAULT 'CUSTOMER_OWNED',
    "proofOfPurchaseReference" TEXT,
    "intakeCondition" TEXT,
    "identitySnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCaseAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceCaseEvent" (
    "id" SERIAL NOT NULL,
    "serviceCaseId" INTEGER NOT NULL,
    "eventType" "public"."ServiceCaseEventType" NOT NULL,
    "fromStatus" "public"."ServiceCaseStatus",
    "toStatus" "public"."ServiceCaseStatus",
    "sourceType" "public"."ServiceCaseSourceType" NOT NULL DEFAULT 'SERVICE_CASE',
    "sourceRefId" INTEGER,
    "correlationKey" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedByEmployeeId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceCaseCustodyEvent" (
    "id" SERIAL NOT NULL,
    "serviceCaseId" INTEGER NOT NULL,
    "serviceCaseAssetId" INTEGER,
    "fromCustodianType" "public"."ServiceCustodianType",
    "fromCustodianRef" TEXT,
    "toCustodianType" "public"."ServiceCustodianType" NOT NULL,
    "toCustodianRef" TEXT,
    "transferReference" TEXT,
    "trackingNumber" TEXT,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "note" TEXT,
    "performedByEmployeeId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCaseCustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceCaseLink" (
    "id" SERIAL NOT NULL,
    "fromServiceCaseId" INTEGER NOT NULL,
    "toServiceCaseId" INTEGER NOT NULL,
    "linkType" "public"."ServiceCaseLinkType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCaseLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceCaseCompletionCommand" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "commandKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "serviceCaseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCaseCompletionCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepairDevice_repairJobId_key" ON "public"."RepairDevice"("repairJobId");

-- CreateIndex
CREATE INDEX "RepairDevice_serialNumber_idx" ON "public"."RepairDevice"("serialNumber");

-- CreateIndex
CREATE INDEX "RepairDevice_imei_idx" ON "public"."RepairDevice"("imei");

-- CreateIndex
CREATE INDEX "RepairDevice_serviceTag_idx" ON "public"."RepairDevice"("serviceTag");

-- CreateIndex
CREATE INDEX "RepairAccessory_repairJobId_idx" ON "public"."RepairAccessory"("repairJobId");

-- CreateIndex
CREATE INDEX "RepairEvidence_repairJobId_occurredAt_idx" ON "public"."RepairEvidence"("repairJobId", "occurredAt");

-- CreateIndex
CREATE INDEX "RepairEvidence_createdByEmployeeId_idx" ON "public"."RepairEvidence"("createdByEmployeeId");

-- CreateIndex
CREATE INDEX "RepairDiagnosis_repairJobId_diagnosedAt_idx" ON "public"."RepairDiagnosis"("repairJobId", "diagnosedAt");

-- CreateIndex
CREATE INDEX "RepairDiagnosis_diagnosedByEmployeeId_idx" ON "public"."RepairDiagnosis"("diagnosedByEmployeeId");

-- CreateIndex
CREATE INDEX "RepairDiagnosis_warrantyEligibility_idx" ON "public"."RepairDiagnosis"("warrantyEligibility");

-- CreateIndex
CREATE UNIQUE INDEX "RepairDiagnosis_repairJobId_sequence_key" ON "public"."RepairDiagnosis"("repairJobId", "sequence");

-- CreateIndex
CREATE INDEX "RepairEstimate_repairJobId_status_createdAt_idx" ON "public"."RepairEstimate"("repairJobId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RepairEstimate_createdByEmployeeId_idx" ON "public"."RepairEstimate"("createdByEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairEstimate_repairJobId_revision_key" ON "public"."RepairEstimate"("repairJobId", "revision");

-- CreateIndex
CREATE INDEX "RepairEstimateItem_estimateId_idx" ON "public"."RepairEstimateItem"("estimateId");

-- CreateIndex
CREATE INDEX "RepairEstimateItem_productId_idx" ON "public"."RepairEstimateItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairApproval_repairEstimateId_key" ON "public"."RepairApproval"("repairEstimateId");

-- CreateIndex
CREATE INDEX "RepairApproval_repairJobId_decidedAt_idx" ON "public"."RepairApproval"("repairJobId", "decidedAt");

-- CreateIndex
CREATE INDEX "RepairApproval_customerId_decidedAt_idx" ON "public"."RepairApproval"("customerId", "decidedAt");

-- CreateIndex
CREATE INDEX "RepairApproval_recordedByEmployeeId_idx" ON "public"."RepairApproval"("recordedByEmployeeId");

-- CreateIndex
CREATE INDEX "RepairWorkItem_repairJobId_status_sequence_idx" ON "public"."RepairWorkItem"("repairJobId", "status", "sequence");

-- CreateIndex
CREATE INDEX "RepairWorkItem_assignedToEmployeeId_status_idx" ON "public"."RepairWorkItem"("assignedToEmployeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RepairWorkItem_repairJobId_sequence_key" ON "public"."RepairWorkItem"("repairJobId", "sequence");

-- CreateIndex
CREATE INDEX "RepairJobEvent_repairJobId_occurredAt_idx" ON "public"."RepairJobEvent"("repairJobId", "occurredAt");

-- CreateIndex
CREATE INDEX "RepairJobEvent_performedByEmployeeId_occurredAt_idx" ON "public"."RepairJobEvent"("performedByEmployeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "RepairJobEvent_eventType_occurredAt_idx" ON "public"."RepairJobEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "RepairCustodyEvent_serviceCaseId_transferredAt_idx" ON "public"."RepairCustodyEvent"("serviceCaseId", "transferredAt");

-- CreateIndex
CREATE INDEX "RepairCustodyEvent_repairJobId_transferredAt_idx" ON "public"."RepairCustodyEvent"("repairJobId", "transferredAt");

-- CreateIndex
CREATE INDEX "RepairCustodyEvent_warrantyClaimId_transferredAt_idx" ON "public"."RepairCustodyEvent"("warrantyClaimId", "transferredAt");

-- CreateIndex
CREATE INDEX "RepairCustodyEvent_performedByEmployeeId_idx" ON "public"."RepairCustodyEvent"("performedByEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairDeliveryConfirmation_repairJobId_key" ON "public"."RepairDeliveryConfirmation"("repairJobId");

-- CreateIndex
CREATE INDEX "RepairDeliveryConfirmation_customerId_deliveredAt_idx" ON "public"."RepairDeliveryConfirmation"("customerId", "deliveredAt");

-- CreateIndex
CREATE INDEX "RepairDeliveryConfirmation_confirmedByEmployeeId_idx" ON "public"."RepairDeliveryConfirmation"("confirmedByEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairCompletionCommand_repairJobId_key" ON "public"."RepairCompletionCommand"("repairJobId");

-- CreateIndex
CREATE INDEX "RepairCompletionCommand_branchId_createdAt_idx" ON "public"."RepairCompletionCommand"("branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepairCompletionCommand_branchId_commandKey_key" ON "public"."RepairCompletionCommand"("branchId", "commandKey");

-- CreateIndex
CREATE INDEX "ServiceCase_branchId_status_openedAt_idx" ON "public"."ServiceCase"("branchId", "status", "openedAt");

-- CreateIndex
CREATE INDEX "ServiceCase_customerId_openedAt_idx" ON "public"."ServiceCase"("customerId", "openedAt");

-- CreateIndex
CREATE INDEX "ServiceCase_primaryStockItemId_openedAt_idx" ON "public"."ServiceCase"("primaryStockItemId", "openedAt");

-- CreateIndex
CREATE INDEX "ServiceCase_openedByEmployeeId_idx" ON "public"."ServiceCase"("openedByEmployeeId");

-- CreateIndex
CREATE INDEX "ServiceCase_closedByEmployeeId_idx" ON "public"."ServiceCase"("closedByEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCase_branchId_caseNo_key" ON "public"."ServiceCase"("branchId", "caseNo");

-- CreateIndex
CREATE INDEX "ServiceCaseAsset_serviceCaseId_role_idx" ON "public"."ServiceCaseAsset"("serviceCaseId", "role");

-- CreateIndex
CREATE INDEX "ServiceCaseAsset_stockItemId_idx" ON "public"."ServiceCaseAsset"("stockItemId");

-- CreateIndex
CREATE INDEX "ServiceCaseAsset_serialNumber_idx" ON "public"."ServiceCaseAsset"("serialNumber");

-- CreateIndex
CREATE INDEX "ServiceCaseAsset_imei_idx" ON "public"."ServiceCaseAsset"("imei");

-- CreateIndex
CREATE INDEX "ServiceCaseAsset_serviceTag_idx" ON "public"."ServiceCaseAsset"("serviceTag");

-- CreateIndex
CREATE INDEX "ServiceCaseEvent_serviceCaseId_occurredAt_idx" ON "public"."ServiceCaseEvent"("serviceCaseId", "occurredAt");

-- CreateIndex
CREATE INDEX "ServiceCaseEvent_sourceType_sourceRefId_occurredAt_idx" ON "public"."ServiceCaseEvent"("sourceType", "sourceRefId", "occurredAt");

-- CreateIndex
CREATE INDEX "ServiceCaseEvent_correlationKey_idx" ON "public"."ServiceCaseEvent"("correlationKey");

-- CreateIndex
CREATE INDEX "ServiceCaseEvent_performedByEmployeeId_occurredAt_idx" ON "public"."ServiceCaseEvent"("performedByEmployeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "ServiceCaseCustodyEvent_serviceCaseId_transferredAt_idx" ON "public"."ServiceCaseCustodyEvent"("serviceCaseId", "transferredAt");

-- CreateIndex
CREATE INDEX "ServiceCaseCustodyEvent_serviceCaseAssetId_transferredAt_idx" ON "public"."ServiceCaseCustodyEvent"("serviceCaseAssetId", "transferredAt");

-- CreateIndex
CREATE INDEX "ServiceCaseCustodyEvent_performedByEmployeeId_idx" ON "public"."ServiceCaseCustodyEvent"("performedByEmployeeId");

-- CreateIndex
CREATE INDEX "ServiceCaseLink_toServiceCaseId_linkType_idx" ON "public"."ServiceCaseLink"("toServiceCaseId", "linkType");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCaseLink_fromServiceCaseId_toServiceCaseId_linkType_key" ON "public"."ServiceCaseLink"("fromServiceCaseId", "toServiceCaseId", "linkType");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCaseCompletionCommand_serviceCaseId_key" ON "public"."ServiceCaseCompletionCommand"("serviceCaseId");

-- CreateIndex
CREATE INDEX "ServiceCaseCompletionCommand_branchId_createdAt_idx" ON "public"."ServiceCaseCompletionCommand"("branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCaseCompletionCommand_branchId_commandKey_key" ON "public"."ServiceCaseCompletionCommand"("branchId", "commandKey");

-- CreateIndex
CREATE INDEX "RepairJob_serviceCaseId_idx" ON "public"."RepairJob"("serviceCaseId");

-- CreateIndex
CREATE INDEX "RepairJob_branchId_status_createdAt_idx" ON "public"."RepairJob"("branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RepairJob_customerId_createdAt_idx" ON "public"."RepairJob"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "RepairJob_technicianId_status_idx" ON "public"."RepairJob"("technicianId", "status");

-- CreateIndex
CREATE INDEX "RepairJob_receivedByEmployeeId_idx" ON "public"."RepairJob"("receivedByEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairJob_branchId_jobNo_key" ON "public"."RepairJob"("branchId", "jobNo");

-- CreateIndex
CREATE INDEX "RepairPartItem_repairJobId_issuedAt_idx" ON "public"."RepairPartItem"("repairJobId", "issuedAt");

-- CreateIndex
CREATE INDEX "RepairPartItem_repairWorkItemId_idx" ON "public"."RepairPartItem"("repairWorkItemId");

-- CreateIndex
CREATE INDEX "RepairPartItem_productId_idx" ON "public"."RepairPartItem"("productId");

-- CreateIndex
CREATE INDEX "RepairPartItem_stockItemId_idx" ON "public"."RepairPartItem"("stockItemId");

-- CreateIndex
CREATE INDEX "RepairPartItem_simpleLotId_idx" ON "public"."RepairPartItem"("simpleLotId");

-- CreateIndex
CREATE INDEX "RepairPartItem_issuedByEmployeeId_idx" ON "public"."RepairPartItem"("issuedByEmployeeId");

-- CreateIndex
CREATE INDEX "SaleReturn_sourceRepairJobId_idx" ON "public"."SaleReturn"("sourceRepairJobId");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_repairWorkItemId_key" ON "public"."WarrantyClaim"("repairWorkItemId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_repairJobId_openedAt_idx" ON "public"."WarrantyClaim"("repairJobId", "openedAt");

-- CreateIndex
CREATE INDEX "WarrantyClaim_repairDiagnosisId_idx" ON "public"."WarrantyClaim"("repairDiagnosisId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_repairLinkState_openedAt_idx" ON "public"."WarrantyClaim"("repairLinkState", "openedAt");

-- AddForeignKey
ALTER TABLE "public"."SaleReturn" ADD CONSTRAINT "SaleReturn_sourceRepairJobId_fkey" FOREIGN KEY ("sourceRepairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJob" ADD CONSTRAINT "RepairJob_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "public"."ServiceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJob" ADD CONSTRAINT "RepairJob_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJob" ADD CONSTRAINT "RepairJob_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJob" ADD CONSTRAINT "RepairJob_receivedByEmployeeId_fkey" FOREIGN KEY ("receivedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairPartItem" ADD CONSTRAINT "RepairPartItem_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairPartItem" ADD CONSTRAINT "RepairPartItem_repairWorkItemId_fkey" FOREIGN KEY ("repairWorkItemId") REFERENCES "public"."RepairWorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairPartItem" ADD CONSTRAINT "RepairPartItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairPartItem" ADD CONSTRAINT "RepairPartItem_simpleLotId_fkey" FOREIGN KEY ("simpleLotId") REFERENCES "public"."SimpleLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairPartItem" ADD CONSTRAINT "RepairPartItem_issuedByEmployeeId_fkey" FOREIGN KEY ("issuedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairDevice" ADD CONSTRAINT "RepairDevice_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairAccessory" ADD CONSTRAINT "RepairAccessory_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairEvidence" ADD CONSTRAINT "RepairEvidence_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairEvidence" ADD CONSTRAINT "RepairEvidence_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairDiagnosis" ADD CONSTRAINT "RepairDiagnosis_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairDiagnosis" ADD CONSTRAINT "RepairDiagnosis_diagnosedByEmployeeId_fkey" FOREIGN KEY ("diagnosedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairEstimate" ADD CONSTRAINT "RepairEstimate_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairEstimate" ADD CONSTRAINT "RepairEstimate_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairEstimateItem" ADD CONSTRAINT "RepairEstimateItem_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "public"."RepairEstimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairEstimateItem" ADD CONSTRAINT "RepairEstimateItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairApproval" ADD CONSTRAINT "RepairApproval_repairEstimateId_fkey" FOREIGN KEY ("repairEstimateId") REFERENCES "public"."RepairEstimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairApproval" ADD CONSTRAINT "RepairApproval_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairApproval" ADD CONSTRAINT "RepairApproval_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairApproval" ADD CONSTRAINT "RepairApproval_recordedByEmployeeId_fkey" FOREIGN KEY ("recordedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairWorkItem" ADD CONSTRAINT "RepairWorkItem_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairWorkItem" ADD CONSTRAINT "RepairWorkItem_assignedToEmployeeId_fkey" FOREIGN KEY ("assignedToEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJobEvent" ADD CONSTRAINT "RepairJobEvent_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJobEvent" ADD CONSTRAINT "RepairJobEvent_performedByEmployeeId_fkey" FOREIGN KEY ("performedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairCustodyEvent" ADD CONSTRAINT "RepairCustodyEvent_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "public"."ServiceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairCustodyEvent" ADD CONSTRAINT "RepairCustodyEvent_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairCustodyEvent" ADD CONSTRAINT "RepairCustodyEvent_warrantyClaimId_fkey" FOREIGN KEY ("warrantyClaimId") REFERENCES "public"."WarrantyClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairCustodyEvent" ADD CONSTRAINT "RepairCustodyEvent_performedByEmployeeId_fkey" FOREIGN KEY ("performedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairDeliveryConfirmation" ADD CONSTRAINT "RepairDeliveryConfirmation_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairDeliveryConfirmation" ADD CONSTRAINT "RepairDeliveryConfirmation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairDeliveryConfirmation" ADD CONSTRAINT "RepairDeliveryConfirmation_confirmedByEmployeeId_fkey" FOREIGN KEY ("confirmedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairCompletionCommand" ADD CONSTRAINT "RepairCompletionCommand_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairCompletionCommand" ADD CONSTRAINT "RepairCompletionCommand_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_repairWorkItemId_fkey" FOREIGN KEY ("repairWorkItemId") REFERENCES "public"."RepairWorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_repairDiagnosisId_fkey" FOREIGN KEY ("repairDiagnosisId") REFERENCES "public"."RepairDiagnosis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCase" ADD CONSTRAINT "ServiceCase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCase" ADD CONSTRAINT "ServiceCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCase" ADD CONSTRAINT "ServiceCase_primaryStockItemId_fkey" FOREIGN KEY ("primaryStockItemId") REFERENCES "public"."StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCase" ADD CONSTRAINT "ServiceCase_openedByEmployeeId_fkey" FOREIGN KEY ("openedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCase" ADD CONSTRAINT "ServiceCase_closedByEmployeeId_fkey" FOREIGN KEY ("closedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCaseAsset" ADD CONSTRAINT "ServiceCaseAsset_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "public"."ServiceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCaseAsset" ADD CONSTRAINT "ServiceCaseAsset_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCaseEvent" ADD CONSTRAINT "ServiceCaseEvent_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "public"."ServiceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCaseEvent" ADD CONSTRAINT "ServiceCaseEvent_performedByEmployeeId_fkey" FOREIGN KEY ("performedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCaseCustodyEvent" ADD CONSTRAINT "ServiceCaseCustodyEvent_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "public"."ServiceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCaseCustodyEvent" ADD CONSTRAINT "ServiceCaseCustodyEvent_serviceCaseAssetId_fkey" FOREIGN KEY ("serviceCaseAssetId") REFERENCES "public"."ServiceCaseAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCaseCustodyEvent" ADD CONSTRAINT "ServiceCaseCustodyEvent_performedByEmployeeId_fkey" FOREIGN KEY ("performedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCaseLink" ADD CONSTRAINT "ServiceCaseLink_fromServiceCaseId_fkey" FOREIGN KEY ("fromServiceCaseId") REFERENCES "public"."ServiceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCaseLink" ADD CONSTRAINT "ServiceCaseLink_toServiceCaseId_fkey" FOREIGN KEY ("toServiceCaseId") REFERENCES "public"."ServiceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCaseCompletionCommand" ADD CONSTRAINT "ServiceCaseCompletionCommand_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceCaseCompletionCommand" ADD CONSTRAINT "ServiceCaseCompletionCommand_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "public"."ServiceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
