'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const mapCapability = (row, areas = []) => ({
  id: Number(row.id),
  branchId: Number(row.branchId),
  storefrontEnabled: Boolean(row.storefrontEnabled),
  storefrontSlug: row.storefrontSlug || null,
  displayName: row.displayName || null,
  contactPhone: row.contactPhone || null,
  pickupEnabled: Boolean(row.pickupEnabled),
  deliveryEnabled: Boolean(row.deliveryEnabled),
  deliveryFeeMode: row.deliveryFeeMode || null,
  fixedDeliveryFee: Number(row.fixedDeliveryFee || 0),
  serviceAreaMode: row.serviceAreaMode,
  maxDeliveryDistanceKm: row.maxDeliveryDistanceKm == null ? null : Number(row.maxDeliveryDistanceKm),
  preparationSlaMinutes: Number(row.preparationSlaMinutes),
  pickupInstructions: row.pickupInstructions || null,
  deliveryInstructions: row.deliveryInstructions || null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  serviceAreas: areas.map((area) => ({
    id: Number(area.id),
    areaType: area.areaType,
    areaCode: area.areaCode,
    areaName: area.areaName || null,
  })),
});

const findByBranchId = async (branchId, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT * FROM "PartnerStoreCapability" WHERE "branchId" = ${branchId} LIMIT 1
  `);
  if (!rows[0]) return null;
  const areas = await db.$queryRaw(Prisma.sql`
    SELECT * FROM "PartnerStoreServiceArea"
    WHERE "partnerStoreCapabilityId" = ${rows[0].id}
    ORDER BY "areaType", "areaName", "areaCode"
  `);
  return mapCapability(rows[0], areas);
};

const upsert = async (command, db = prisma) => db.$transaction(async (tx) => {
  const branches = await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "Branch" WHERE "id" = ${command.branchId} FOR UPDATE
  `);
  if (!branches[0]) {
    throw Object.assign(new Error('Branch was not found'), { statusCode: 404, code: 'PARTNER_STORE_BRANCH_NOT_FOUND' });
  }

  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "PartnerStoreCapability" (
      "branchId", "storefrontEnabled", "storefrontSlug", "displayName", "contactPhone",
      "pickupEnabled", "deliveryEnabled", "deliveryFeeMode", "fixedDeliveryFee",
      "serviceAreaMode", "maxDeliveryDistanceKm", "preparationSlaMinutes",
      "pickupInstructions", "deliveryInstructions", "createdAt", "updatedAt"
    ) VALUES (
      ${command.branchId}, ${command.storefrontEnabled}, ${command.storefrontSlug}, ${command.displayName}, ${command.contactPhone},
      ${command.pickupEnabled}, ${command.deliveryEnabled}, ${command.deliveryFeeMode}::"OnlineDeliveryFeeMode", ${command.fixedDeliveryFee},
      ${command.serviceAreaMode}::"PartnerStoreServiceAreaMode", ${command.maxDeliveryDistanceKm}, ${command.preparationSlaMinutes},
      ${command.pickupInstructions}, ${command.deliveryInstructions}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("branchId") DO UPDATE SET
      "storefrontEnabled" = EXCLUDED."storefrontEnabled",
      "storefrontSlug" = EXCLUDED."storefrontSlug",
      "displayName" = EXCLUDED."displayName",
      "contactPhone" = EXCLUDED."contactPhone",
      "pickupEnabled" = EXCLUDED."pickupEnabled",
      "deliveryEnabled" = EXCLUDED."deliveryEnabled",
      "deliveryFeeMode" = EXCLUDED."deliveryFeeMode",
      "fixedDeliveryFee" = EXCLUDED."fixedDeliveryFee",
      "serviceAreaMode" = EXCLUDED."serviceAreaMode",
      "maxDeliveryDistanceKm" = EXCLUDED."maxDeliveryDistanceKm",
      "preparationSlaMinutes" = EXCLUDED."preparationSlaMinutes",
      "pickupInstructions" = EXCLUDED."pickupInstructions",
      "deliveryInstructions" = EXCLUDED."deliveryInstructions",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `);
  const capability = rows[0];

  await tx.$executeRaw(Prisma.sql`
    DELETE FROM "PartnerStoreServiceArea" WHERE "partnerStoreCapabilityId" = ${capability.id}
  `);
  for (const area of command.serviceAreas) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "PartnerStoreServiceArea" (
        "partnerStoreCapabilityId", "areaType", "areaCode", "areaName", "createdAt", "updatedAt"
      ) VALUES (
        ${capability.id}, ${area.areaType}::"PartnerStoreAdministrativeAreaType", ${area.areaCode}, ${area.areaName}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);
  }

  return findByBranchId(command.branchId, tx);
});

module.exports = Object.freeze({ findByBranchId, upsert });
