-- Additive lifecycle persistence authority for the canonical ProductReservation aggregate.
-- No ProductReservation table is recreated and no POS business data is modified.

CREATE TYPE "ProductReservationLifecycleCommandType" AS ENUM (
  'ACCEPT',
  'MARK_FULFILLMENT_READY',
  'CANCEL',
  'EXPIRE'
);

ALTER TABLE "ProductReservation"
  ADD COLUMN "stockReleasedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "ProductReservationLifecycleCommand" (
  "id" SERIAL NOT NULL,
  "reservationId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "commandKey" TEXT NOT NULL,
  "commandType" "ProductReservationLifecycleCommandType" NOT NULL,
  "fromStatus" "ProductReservationStatus" NOT NULL,
  "toStatus" "ProductReservationStatus" NOT NULL,
  "stockReleased" BOOLEAN NOT NULL DEFAULT FALSE,
  "actorId" INTEGER,
  "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductReservationLifecycleCommand_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductReservationLifecycleCommand_reservationId_commandKey_key"
    UNIQUE ("reservationId", "commandKey")
);

CREATE TABLE "ProductReservationLifecycleEvent" (
  "id" SERIAL NOT NULL,
  "reservationId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "commandId" INTEGER NOT NULL,
  "fromStatus" "ProductReservationStatus" NOT NULL,
  "toStatus" "ProductReservationStatus" NOT NULL,
  "actorId" INTEGER,
  "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductReservationLifecycleEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductReservationLifecycleEvent_commandId_key" UNIQUE ("commandId")
);

ALTER TABLE "ProductReservationLifecycleCommand"
  ADD CONSTRAINT "ProductReservationLifecycleCommand_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "ProductReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservationLifecycleCommand_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservationLifecycleCommand_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductReservationLifecycleEvent"
  ADD CONSTRAINT "ProductReservationLifecycleEvent_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "ProductReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservationLifecycleEvent_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservationLifecycleEvent_commandId_fkey"
    FOREIGN KEY ("commandId") REFERENCES "ProductReservationLifecycleCommand"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservationLifecycleEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProductReservationLifecycleCommand_branchId_occurredAt_idx"
  ON "ProductReservationLifecycleCommand"("branchId", "occurredAt");
CREATE INDEX "ProductReservationLifecycleCommand_actorId_occurredAt_idx"
  ON "ProductReservationLifecycleCommand"("actorId", "occurredAt");
CREATE INDEX "ProductReservationLifecycleEvent_reservationId_occurredAt_idx"
  ON "ProductReservationLifecycleEvent"("reservationId", "occurredAt");
CREATE INDEX "ProductReservationLifecycleEvent_branchId_occurredAt_idx"
  ON "ProductReservationLifecycleEvent"("branchId", "occurredAt");
CREATE INDEX "ProductReservationLifecycleEvent_actorId_occurredAt_idx"
  ON "ProductReservationLifecycleEvent"("actorId", "occurredAt");
