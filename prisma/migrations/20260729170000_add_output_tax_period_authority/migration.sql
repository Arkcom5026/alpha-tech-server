CREATE TYPE "OutputTaxPeriodStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED', 'REOPENED');

CREATE TYPE "OutputTaxPeriodEventType" AS ENUM ('CREATED', 'CLOSE_REQUESTED', 'CLOSED', 'REOPENED');

CREATE TABLE "OutputTaxPeriod" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "status" "OutputTaxPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "documentCount" INTEGER NOT NULL DEFAULT 0,
  "activeDocumentCount" INTEGER NOT NULL DEFAULT 0,
  "cancelledDocumentCount" INTEGER NOT NULL DEFAULT 0,
  "subtotalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "snapshot" JSONB NOT NULL DEFAULT '{}',
  "closeRequestedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "reopenedAt" TIMESTAMP(3),
  "closeReason" TEXT,
  "reopenReason" TEXT,
  "closeRequestedByEmployeeId" INTEGER,
  "closedByEmployeeId" INTEGER,
  "reopenedByEmployeeId" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutputTaxPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OutputTaxPeriod_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OutputTaxPeriod_closeRequestedByEmployeeId_fkey" FOREIGN KEY ("closeRequestedByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OutputTaxPeriod_closedByEmployeeId_fkey" FOREIGN KEY ("closedByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OutputTaxPeriod_reopenedByEmployeeId_fkey" FOREIGN KEY ("reopenedByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OutputTaxPeriod_year_check" CHECK ("year" BETWEEN 2000 AND 2200),
  CONSTRAINT "OutputTaxPeriod_month_check" CHECK ("month" BETWEEN 1 AND 12)
);

CREATE UNIQUE INDEX "OutputTaxPeriod_branchId_year_month_key" ON "OutputTaxPeriod"("branchId", "year", "month");
CREATE INDEX "OutputTaxPeriod_branchId_status_year_month_idx" ON "OutputTaxPeriod"("branchId", "status", "year", "month");

CREATE TABLE "OutputTaxPeriodEvent" (
  "id" SERIAL NOT NULL,
  "outputTaxPeriodId" INTEGER NOT NULL,
  "eventType" "OutputTaxPeriodEventType" NOT NULL,
  "fromStatus" "OutputTaxPeriodStatus",
  "toStatus" "OutputTaxPeriodStatus" NOT NULL,
  "reason" TEXT,
  "actorEmployeeId" INTEGER,
  "periodVersion" INTEGER NOT NULL,
  "snapshot" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutputTaxPeriodEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OutputTaxPeriodEvent_outputTaxPeriodId_fkey" FOREIGN KEY ("outputTaxPeriodId") REFERENCES "OutputTaxPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OutputTaxPeriodEvent_actorEmployeeId_fkey" FOREIGN KEY ("actorEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "OutputTaxPeriodEvent_outputTaxPeriodId_occurredAt_idx" ON "OutputTaxPeriodEvent"("outputTaxPeriodId", "occurredAt");
CREATE INDEX "OutputTaxPeriodEvent_actorEmployeeId_occurredAt_idx" ON "OutputTaxPeriodEvent"("actorEmployeeId", "occurredAt");
