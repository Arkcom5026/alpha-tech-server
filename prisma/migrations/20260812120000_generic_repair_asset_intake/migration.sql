ALTER TABLE "DeviceIntake" ADD COLUMN "assetDescription" TEXT;
UPDATE "DeviceIntake" intake SET "assetDescription" = COALESCE(
  (SELECT NULLIF(TRIM(CONCAT_WS(' ', snapshot."brand", snapshot."model")), '') FROM "DeviceIntakeSnapshot" snapshot WHERE snapshot."deviceIntakeId" = intake."id"),
  (SELECT NULLIF(TRIM(job."deviceModel"), '') FROM "RepairJob" job WHERE job."id" = intake."repairJobId"),
  'Unspecified repair asset'
);
ALTER TABLE "DeviceIntake" ALTER COLUMN "assetDescription" SET NOT NULL, ALTER COLUMN "deviceId" DROP NOT NULL;
