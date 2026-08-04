-- CreateEnum
CREATE TYPE "StoreDeviceGatewayEnrollmentState" AS ENUM ('PENDING_ENROLLMENT', 'ENROLLED', 'REVOKED');

-- CreateEnum
CREATE TYPE "StoreDeviceGatewayRuntimeState" AS ENUM ('OFFLINE', 'ONLINE', 'DEGRADED');

-- CreateEnum
CREATE TYPE "StoreDeviceGatewaySessionState" AS ENUM ('CONNECTED', 'AUTHENTICATED', 'DISCONNECTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StoreDeviceJobType" AS ENUM ('PRINT_DOCUMENT', 'PRINT_LABEL', 'DEVICE_DIAGNOSTIC');

-- CreateEnum
CREATE TYPE "StoreDeviceJobStatus" AS ENUM ('PENDING', 'LEASED', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StoreDeviceJobLeaseStatus" AS ENUM ('OFFERED', 'ACKNOWLEDGED', 'COMPLETED', 'FAILED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "StoreDeviceJobResultStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StoreDeviceGateway" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "enrollmentState" "StoreDeviceGatewayEnrollmentState" NOT NULL DEFAULT 'PENDING_ENROLLMENT',
    "runtimeState" "StoreDeviceGatewayRuntimeState" NOT NULL DEFAULT 'OFFLINE',
    "credentialVersion" INTEGER NOT NULL,
    "capabilitiesSnapshot" JSONB,
    "platformSnapshot" JSONB,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastAuthenticatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreDeviceGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreDeviceGatewaySession" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "gatewayId" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "challengeId" TEXT,
    "state" "StoreDeviceGatewaySessionState" NOT NULL DEFAULT 'CONNECTED',
    "reconnectCursor" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authenticatedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreDeviceGatewaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreDeviceJob" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "jobType" "StoreDeviceJobType" NOT NULL,
    "source" TEXT NOT NULL,
    "status" "StoreDeviceJobStatus" NOT NULL DEFAULT 'PENDING',
    "targetDeviceId" TEXT,
    "targetProfileId" TEXT,
    "requestSnapshot" JSONB NOT NULL,
    "correlationId" TEXT,
    "causationId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreDeviceJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreDeviceJobLease" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "gatewayId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "leaseId" TEXT NOT NULL,
    "status" "StoreDeviceJobLeaseStatus" NOT NULL DEFAULT 'OFFERED',
    "attemptNumber" INTEGER NOT NULL,
    "leaseStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreDeviceJobLease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreDeviceJobResult" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "leaseId" INTEGER NOT NULL,
    "gatewayId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "resultId" TEXT NOT NULL,
    "status" "StoreDeviceJobResultStatus" NOT NULL,
    "adapterEvidence" JSONB,
    "transportEvidence" JSONB,
    "resultSnapshot" JSONB NOT NULL,
    "errorMetadata" JSONB,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreDeviceJobResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreDeviceGateway_id_branchId_key" ON "StoreDeviceGateway"("id", "branchId");
CREATE UNIQUE INDEX "StoreDeviceGateway_branchId_gatewayId_key" ON "StoreDeviceGateway"("branchId", "gatewayId");
CREATE INDEX "StoreDeviceGateway_branchId_enrollmentState_idx" ON "StoreDeviceGateway"("branchId", "enrollmentState");
CREATE INDEX "StoreDeviceGateway_branchId_runtimeState_idx" ON "StoreDeviceGateway"("branchId", "runtimeState");

CREATE UNIQUE INDEX "StoreDeviceGatewaySession_id_branchId_key" ON "StoreDeviceGatewaySession"("id", "branchId");
CREATE UNIQUE INDEX "StoreDeviceGatewaySession_branchId_sessionId_key" ON "StoreDeviceGatewaySession"("branchId", "sessionId");
CREATE UNIQUE INDEX "StoreDeviceGatewaySession_id_branchId_gatewayId_key" ON "StoreDeviceGatewaySession"("id", "branchId", "gatewayId");
CREATE INDEX "StoreDeviceGatewaySession_branchId_gatewayId_state_idx" ON "StoreDeviceGatewaySession"("branchId", "gatewayId", "state");
CREATE INDEX "StoreDeviceGatewaySession_branchId_expiresAt_idx" ON "StoreDeviceGatewaySession"("branchId", "expiresAt");

CREATE UNIQUE INDEX "StoreDeviceJob_id_branchId_key" ON "StoreDeviceJob"("id", "branchId");
CREATE UNIQUE INDEX "StoreDeviceJob_branchId_jobId_key" ON "StoreDeviceJob"("branchId", "jobId");
CREATE UNIQUE INDEX "StoreDeviceJob_branchId_idempotencyKey_key" ON "StoreDeviceJob"("branchId", "idempotencyKey");
CREATE INDEX "StoreDeviceJob_branchId_status_requestedAt_idx" ON "StoreDeviceJob"("branchId", "status", "requestedAt");
CREATE INDEX "StoreDeviceJob_branchId_correlationId_idx" ON "StoreDeviceJob"("branchId", "correlationId");

CREATE UNIQUE INDEX "StoreDeviceJobLease_id_branchId_key" ON "StoreDeviceJobLease"("id", "branchId");
CREATE UNIQUE INDEX "StoreDeviceJobLease_branchId_leaseId_key" ON "StoreDeviceJobLease"("branchId", "leaseId");
CREATE UNIQUE INDEX "StoreDeviceJobLease_jobId_attemptNumber_key" ON "StoreDeviceJobLease"("jobId", "attemptNumber");
CREATE INDEX "StoreDeviceJobLease_branchId_gatewayId_status_idx" ON "StoreDeviceJobLease"("branchId", "gatewayId", "status");
CREATE INDEX "StoreDeviceJobLease_branchId_sessionId_status_idx" ON "StoreDeviceJobLease"("branchId", "sessionId", "status");
CREATE INDEX "StoreDeviceJobLease_branchId_expiresAt_idx" ON "StoreDeviceJobLease"("branchId", "expiresAt");
CREATE UNIQUE INDEX "StoreDeviceJobLease_one_active_job_key" ON "StoreDeviceJobLease"("jobId") WHERE "status" IN ('OFFERED', 'ACKNOWLEDGED');

CREATE UNIQUE INDEX "StoreDeviceJobResult_leaseId_key" ON "StoreDeviceJobResult"("leaseId");
CREATE UNIQUE INDEX "StoreDeviceJobResult_branchId_resultId_key" ON "StoreDeviceJobResult"("branchId", "resultId");
CREATE UNIQUE INDEX "StoreDeviceJobResult_branchId_leaseId_key" ON "StoreDeviceJobResult"("branchId", "leaseId");
CREATE INDEX "StoreDeviceJobResult_branchId_jobId_recordedAt_idx" ON "StoreDeviceJobResult"("branchId", "jobId", "recordedAt");
CREATE INDEX "StoreDeviceJobResult_branchId_gatewayId_recordedAt_idx" ON "StoreDeviceJobResult"("branchId", "gatewayId", "recordedAt");

-- AddForeignKey
ALTER TABLE "StoreDeviceGateway" ADD CONSTRAINT "StoreDeviceGateway_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceGatewaySession" ADD CONSTRAINT "StoreDeviceGatewaySession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceGatewaySession" ADD CONSTRAINT "StoreDeviceGatewaySession_branchId_gatewayId_fkey" FOREIGN KEY ("branchId", "gatewayId") REFERENCES "StoreDeviceGateway"("branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceJob" ADD CONSTRAINT "StoreDeviceJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceJobLease" ADD CONSTRAINT "StoreDeviceJobLease_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceJobLease" ADD CONSTRAINT "StoreDeviceJobLease_branchId_jobId_fkey" FOREIGN KEY ("branchId", "jobId") REFERENCES "StoreDeviceJob"("branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceJobLease" ADD CONSTRAINT "StoreDeviceJobLease_branchId_gatewayId_fkey" FOREIGN KEY ("branchId", "gatewayId") REFERENCES "StoreDeviceGateway"("branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceJobLease" ADD CONSTRAINT "StoreDeviceJobLease_branchId_gatewayId_sessionId_fkey" FOREIGN KEY ("branchId", "gatewayId", "sessionId") REFERENCES "StoreDeviceGatewaySession"("branchId", "gatewayId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceJobResult" ADD CONSTRAINT "StoreDeviceJobResult_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceJobResult" ADD CONSTRAINT "StoreDeviceJobResult_branchId_jobId_fkey" FOREIGN KEY ("branchId", "jobId") REFERENCES "StoreDeviceJob"("branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceJobResult" ADD CONSTRAINT "StoreDeviceJobResult_branchId_leaseId_fkey" FOREIGN KEY ("branchId", "leaseId") REFERENCES "StoreDeviceJobLease"("branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceJobResult" ADD CONSTRAINT "StoreDeviceJobResult_branchId_gatewayId_fkey" FOREIGN KEY ("branchId", "gatewayId") REFERENCES "StoreDeviceGateway"("branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreDeviceJobResult" ADD CONSTRAINT "StoreDeviceJobResult_branchId_gatewayId_sessionId_fkey" FOREIGN KEY ("branchId", "gatewayId", "sessionId") REFERENCES "StoreDeviceGatewaySession"("branchId", "gatewayId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Store-device terminal evidence is append-only: a result can be recorded once but never edited or removed.
CREATE FUNCTION "public"."prevent_store_device_job_result_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'StoreDeviceJobResult is append-only';
END;
$$;

CREATE TRIGGER "StoreDeviceJobResult_append_only"
BEFORE UPDATE OR DELETE ON "StoreDeviceJobResult"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_store_device_job_result_mutation"();
