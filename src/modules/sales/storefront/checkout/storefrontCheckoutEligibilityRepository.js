'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const findCurrentPolicy = async ({ branchId }, db = prisma) => {
  const policies = await db.$queryRaw(Prisma.sql`
    SELECT
      c."id",
      c."branchId",
      c."storefrontEnabled",
      c."storefrontSlug",
      c."pickupEnabled",
      c."deliveryEnabled",
      c."deliveryFeeMode",
      c."fixedDeliveryFee",
      c."serviceAreaMode",
      c."maxDeliveryDistanceKm",
      c."preparationSlaMinutes"
    FROM "PartnerStoreCapability" c
    WHERE c."branchId" = ${branchId}
    LIMIT 1
  `);
  const policy = policies[0];
  if (!policy) return null;

  const serviceAreas = await db.$queryRaw(Prisma.sql`
    SELECT "areaType", "areaCode"
    FROM "PartnerStoreServiceArea"
    WHERE "capabilityId" = ${policy.id} AND "active" = TRUE
  `);

  return { ...policy, serviceAreas };
};

module.exports = Object.freeze({ findCurrentPolicy });
