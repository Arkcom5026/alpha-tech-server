'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const toNumber = (value) => (value == null ? null : Number(value));

const findPublishedBySlug = async (slug, db = prisma) => {
  const stores = await db.$queryRaw(Prisma.sql`
    SELECT capability."id", capability."branchId", capability."storefrontSlug", capability."displayName",
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

  const store = stores[0];
  if (!store) return null;

  const [serviceAreas, products] = await Promise.all([
    store.deliveryEnabled && store.serviceAreaMode === 'ADMIN_AREAS'
      ? db.$queryRaw(Prisma.sql`
          SELECT area."areaType"::text AS "areaType", area."areaCode", area."areaName"
          FROM "PartnerStoreServiceArea" area
          WHERE area."capabilityId" = ${store.id} AND area."active" = TRUE
          ORDER BY area."areaType", area."areaName", area."areaCode"
        `)
      : Promise.resolve([]),
    db.$queryRaw(Prisma.sql`
      SELECT product."id", product."name", product."warrantyDays",
        price."priceOnline",
        image."secure_url" AS "coverImageUrl",
        GREATEST(COALESCE(balance."quantity", 0) - COALESCE(balance."reserved", 0), 0) AS "availableQuantity"
      FROM "BranchPrice" price
      JOIN "Product" product ON product."id" = price."productId"
      LEFT JOIN "StockBalance" balance
        ON balance."productId" = product."id" AND balance."branchId" = price."branchId"
      LEFT JOIN LATERAL (
        SELECT product_image."secure_url"
        FROM "ProductImage" product_image
        WHERE product_image."productId" = product."id" AND product_image."active" = TRUE
        ORDER BY COALESCE(product_image."isCover", FALSE) DESC, product_image."createdAt" ASC
        LIMIT 1
      ) image ON TRUE
      WHERE price."branchId" = ${store.branchId}
        AND price."isActive" = TRUE
        AND price."priceOnline" IS NOT NULL
        AND price."priceOnline" > 0
        AND product."active" = TRUE
        AND (price."effectiveDate" IS NULL OR price."effectiveDate" <= CURRENT_TIMESTAMP)
        AND (price."expiredDate" IS NULL OR price."expiredDate" > CURRENT_TIMESTAMP)
      ORDER BY product."name" ASC, product."id" ASC
    `),
  ]);

  return {
    slug: store.storefrontSlug,
    name: store.displayName || store.branchName,
    contactPhone: store.contactPhone || store.branchPhone || null,
    address: store.branchAddress || null,
    fulfillment: {
      pickup: {
        enabled: Boolean(store.pickupEnabled),
        preparationSlaMinutes: toNumber(store.preparationSlaMinutes),
        instruction: store.pickupInstruction || null,
      },
      delivery: {
        enabled: Boolean(store.deliveryEnabled),
        feeMode: store.deliveryEnabled ? store.deliveryFeeMode : null,
        fixedFee: store.deliveryEnabled ? toNumber(store.fixedDeliveryFee) : null,
        serviceAreaMode: store.deliveryEnabled ? store.serviceAreaMode : null,
        maxDistanceKm: store.deliveryEnabled ? toNumber(store.maxDeliveryDistanceKm) : null,
        instruction: store.deliveryEnabled ? store.deliveryInstruction || null : null,
        serviceAreas: serviceAreas.map((area) => ({
          type: area.areaType,
          code: area.areaCode,
          name: area.areaName || null,
        })),
      },
    },
    products: products.map((product) => {
      const availableQuantity = Number(product.availableQuantity || 0);
      return {
        id: Number(product.id),
        name: product.name,
        priceOnline: Number(product.priceOnline),
        coverImageUrl: product.coverImageUrl || null,
        warrantyDays: toNumber(product.warrantyDays),
        availability: {
          available: availableQuantity > 0,
          status: availableQuantity > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK',
        },
      };
    }),
  };
};

module.exports = Object.freeze({ findPublishedBySlug });
