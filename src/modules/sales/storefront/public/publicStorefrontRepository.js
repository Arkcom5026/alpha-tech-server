'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const toNumber = (value) => (value == null ? null : Number(value));

const publishedProductSql = (branchId) => Prisma.sql`
  FROM "BranchPrice" price
  JOIN "Product" product ON product."id" = price."productId"
  LEFT JOIN "Brand" brand ON brand."id" = product."brandId"
  LEFT JOIN "ProductType" product_type ON product_type."id" = product."productTypeId"
  LEFT JOIN "GlobalProductType" global_type ON global_type."id" = product_type."globalProductTypeId"
  LEFT JOIN "Category" category ON category."id" = global_type."categoryId"
  LEFT JOIN "Unit" unit ON unit."id" = product."unitId"
  LEFT JOIN "StockBalance" balance
    ON balance."productId" = product."id" AND balance."branchId" = price."branchId"
  WHERE price."branchId" = ${branchId}
    AND price."isActive" = TRUE
    AND price."priceOnline" IS NOT NULL
    AND price."priceOnline" > 0
    AND product."active" = TRUE
    AND (brand."id" IS NULL OR brand."active" = TRUE)
    AND (
      product_type."id" IS NULL OR (
        product_type."active" = TRUE
        AND global_type."active" = TRUE
        AND category."active" = TRUE
      )
    )
    AND (price."effectiveDate" IS NULL OR price."effectiveDate" <= CURRENT_TIMESTAMP)
    AND (price."expiredDate" IS NULL OR price."expiredDate" > CURRENT_TIMESTAMP)
`;

const findPublishedStoreBySlug = async (slug, db = prisma) => {
  const stores = await db.$queryRaw(Prisma.sql`
    SELECT capability."id", capability."branchId", capability."storefrontSlug", capability."displayName",
      capability."contactPhone", capability."pickupEnabled", capability."deliveryEnabled",
      capability."deliveryFeeMode"::text AS "deliveryFeeMode",
      capability."fixedDeliveryFee", capability."serviceAreaMode"::text AS "serviceAreaMode",
      capability."maxDeliveryDistanceKm", capability."preparationSlaMinutes",
      capability."pickupInstruction", capability."deliveryInstruction",
      branch."name" AS "branchName", branch."address" AS "branchAddress", branch."phone" AS "branchPhone",
      experience."themePreset", experience."themeTokens", experience."layoutPreset",
      experience."sectionConfiguration", experience."version", experience."publishedAt"
    FROM "PartnerStoreCapability" capability
    JOIN "Branch" branch ON branch."id" = capability."branchId"
    JOIN "StoreExperienceProfile" experience ON experience."branchId" = capability."branchId"
    WHERE capability."storefrontEnabled" = TRUE
      AND experience."status" = 'PUBLISHED'
      AND capability."storefrontSlug" = ${slug}
    LIMIT 1
  `);

  return stores[0] || null;
};

const findServiceAreas = async (store, db = prisma) => {
  if (!store.deliveryEnabled || store.serviceAreaMode !== 'ADMIN_AREAS') return [];
  return db.$queryRaw(Prisma.sql`
    SELECT area."areaType"::text AS "areaType", area."areaCode", area."areaName"
    FROM "PartnerStoreServiceArea" area
    WHERE area."capabilityId" = ${store.id} AND area."active" = TRUE
    ORDER BY area."areaType", area."areaName", area."areaCode"
  `);
};

const projectStore = (store, serviceAreas) => ({
  branchId: Number(store.branchId),
  slug: store.storefrontSlug,
  name: store.displayName || store.branchName,
  contactPhone: store.contactPhone || store.branchPhone || null,
  address: store.branchAddress || null,
  experience: {
    themePreset: store.themePreset,
    themeTokens: store.themeTokens || null,
    layoutPreset: store.layoutPreset,
    sectionConfiguration: store.sectionConfiguration || null,
    version: toNumber(store.version),
    publishedAt: store.publishedAt || null,
  },
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
});

const productRowProjection = (product) => {
  const availableQuantity = Number(product.availableQuantity || 0);
  return {
    id: Number(product.id),
    name: product.name,
    barcode: product.saleBarcode || null,
    priceOnline: Number(product.priceOnline),
    coverImageUrl: product.coverImageUrl || null,
    warrantyDays: toNumber(product.warrantyDays),
    brand: product.brandId ? { id: Number(product.brandId), name: product.brandName } : null,
    productType: product.productTypeId
      ? {
          id: Number(product.productTypeId),
          name: product.productTypeName,
          globalType: product.globalTypeId
            ? { id: Number(product.globalTypeId), name: product.globalTypeName, slug: product.globalTypeSlug }
            : null,
          category: product.categoryId
            ? { id: Number(product.categoryId), name: product.categoryName }
            : null,
        }
      : null,
    unit: product.unitId ? { id: Number(product.unitId), name: product.unitName } : null,
    availability: {
      available: availableQuantity > 0,
      status: availableQuantity > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK',
      quantity: availableQuantity,
    },
  };
};

const findPublishedBySlug = async (slug, db = prisma) => {
  const store = await findPublishedStoreBySlug(slug, db);
  if (!store) return null;
  const serviceAreas = await findServiceAreas(store, db);
  return projectStore(store, serviceAreas);
};

const listPublishedProducts = async ({ branchId, search, page, pageSize }, db = prisma) => {
  const query = String(search || '').trim();
  const offset = (page - 1) * pageSize;
  const searchSql = query
    ? Prisma.sql`AND (
        product."name" ILIKE ${`%${query}%`}
        OR product."saleBarcode" ILIKE ${`%${query}%`}
        OR brand."name" ILIKE ${`%${query}%`}
        OR product_type."name" ILIKE ${`%${query}%`}
        OR category."name" ILIKE ${`%${query}%`}
      )`
    : Prisma.empty;

  const [rows, counts] = await Promise.all([
    db.$queryRaw(Prisma.sql`
      SELECT product."id", product."name", product."saleBarcode", product."warrantyDays",
        price."priceOnline", brand."id" AS "brandId", brand."name" AS "brandName",
        product_type."id" AS "productTypeId", product_type."name" AS "productTypeName",
        global_type."id" AS "globalTypeId", global_type."name" AS "globalTypeName", global_type."slug" AS "globalTypeSlug",
        category."id" AS "categoryId", category."name" AS "categoryName",
        unit."id" AS "unitId", unit."name" AS "unitName",
        image."secure_url" AS "coverImageUrl",
        GREATEST(COALESCE(balance."quantity", 0) - COALESCE(balance."reserved", 0), 0) AS "availableQuantity"
      ${publishedProductSql(branchId)}
      LEFT JOIN LATERAL (
        SELECT product_image."secure_url"
        FROM "ProductImage" product_image
        WHERE product_image."productId" = product."id" AND product_image."active" = TRUE
        ORDER BY COALESCE(product_image."isCover", FALSE) DESC, product_image."createdAt" ASC
        LIMIT 1
      ) image ON TRUE
      ${searchSql}
      ORDER BY product."name" ASC, product."id" ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `),
    db.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS "total"
      ${publishedProductSql(branchId)}
      ${searchSql}
    `),
  ]);

  return {
    items: rows.map(productRowProjection),
    total: Number(counts[0]?.total || 0),
  };
};

const findPublishedProductById = async ({ branchId, productId }, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT product."id", product."name", product."saleBarcode", product."warrantyDays",
      price."priceOnline", price."effectiveDate", price."expiredDate",
      brand."id" AS "brandId", brand."name" AS "brandName",
      product_type."id" AS "productTypeId", product_type."name" AS "productTypeName",
      global_type."id" AS "globalTypeId", global_type."name" AS "globalTypeName", global_type."slug" AS "globalTypeSlug",
      category."id" AS "categoryId", category."name" AS "categoryName",
      unit."id" AS "unitId", unit."name" AS "unitName",
      GREATEST(COALESCE(balance."quantity", 0) - COALESCE(balance."reserved", 0), 0) AS "availableQuantity"
    ${publishedProductSql(branchId)}
    AND product."id" = ${productId}
    LIMIT 1
  `);
  const product = rows[0];
  if (!product) return null;

  const images = await db.$queryRaw(Prisma.sql`
    SELECT image."id", image."secure_url", image."url", image."caption", image."isCover"
    FROM "ProductImage" image
    WHERE image."productId" = ${productId} AND image."active" = TRUE
    ORDER BY COALESCE(image."isCover", FALSE) DESC, image."createdAt" ASC, image."id" ASC
  `);

  return {
    ...productRowProjection(product),
    price: {
      amount: Number(product.priceOnline),
      currency: 'THB',
      effectiveDate: product.effectiveDate || null,
      expiredDate: product.expiredDate || null,
    },
    images: images.map((image) => ({
      id: Number(image.id),
      url: image.secure_url || image.url,
      caption: image.caption || null,
      cover: Boolean(image.isCover),
    })),
  };
};

module.exports = Object.freeze({
  findPublishedBySlug,
  listPublishedProducts,
  findPublishedProductById,
});
