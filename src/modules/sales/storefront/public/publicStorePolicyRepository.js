'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const findPublishedStorePolicyBySlug = async (slug, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT capability."id", capability."storefrontSlug", capability."displayName",
      capability."contactPhone", capability."pickupEnabled", capability."deliveryEnabled",
      capability."deliveryFeeMode"::text AS "deliveryFeeMode",
      capability."fixedDeliveryFee", capability."serviceAreaMode"::text AS "serviceAreaMode",
      capability."maxDeliveryDistanceKm", capability."preparationSlaMinutes",
      capability."pickupInstruction", capability."deliveryInstruction",
      branch."name" AS "branchName", branch."address" AS "branchAddress", branch."phone" AS "branchPhone"
    FROM "PartnerStoreCapability" capability
    JOIN "Branch" branch ON branch."id" = capability."branchId"
    WHERE capability."storefrontEnabled" = TRUE
      AND capability."storefrontSlug" = ${slug}
    LIMIT 1
  `);

  const store = rows[0];
  if (!store) return null;

  const serviceAreas = store.deliveryEnabled && store.serviceAreaMode === 'ADMIN_AREAS'
    ? await db.$queryRaw(Prisma.sql`
        SELECT area."areaType"::text AS "areaType", area."areaCode", area."areaName"
        FROM "PartnerStoreServiceArea" area
        WHERE area."capabilityId" = ${store.id} AND area."active" = TRUE
        ORDER BY area."areaType", area."areaName", area."areaCode"
      `)
    : [];

  return {
    slug: store.storefrontSlug,
    name: store.displayName || store.branchName,
    contactPhone: store.contactPhone || store.branchPhone || null,
    address: store.branchAddress || null,
    fulfillment: {
      pickup: {
        enabled: Boolean(store.pickupEnabled),
        preparationSlaMinutes: store.preparationSlaMinutes == null ? null : Number(store.preparationSlaMinutes),
        instruction: store.pickupInstruction || null,
      },
      delivery: {
        enabled: Boolean(store.deliveryEnabled),
        feeMode: store.deliveryEnabled ? store.deliveryFeeMode : null,
        fixedFee: store.deliveryEnabled && store.fixedDeliveryFee != null ? Number(store.fixedDeliveryFee) : null,
        serviceAreaMode: store.deliveryEnabled ? store.serviceAreaMode : null,
        maxDistanceKm: store.deliveryEnabled && store.maxDeliveryDistanceKm != null ? Number(store.maxDeliveryDistanceKm) : null,
        instruction: store.deliveryEnabled ? store.deliveryInstruction || null : null,
        serviceAreas: serviceAreas.map((area) => ({
          type: area.areaType,
          code: area.areaCode,
          name: area.areaName || null,
        })),
      },
    },
  };
};

module.exports = Object.freeze({ findPublishedStorePolicyBySlug });
