'use strict'

const { prisma, Prisma } = require('../../../../lib/prisma')

const auditBranchProducts = async (branchId, db = prisma) => {
  return db.$queryRaw(Prisma.sql`
    SELECT
      product."id" AS "productId",
      product."name" AS "productName",
      product."saleBarcode",
      product."active" AS "productActive",
      price."id" AS "branchPriceId",
      price."isActive" AS "priceActive",
      price."priceOnline",
      price."effectiveDate",
      price."expiredDate",
      brand."id" AS "brandId",
      brand."name" AS "brandName",
      brand."active" AS "brandActive",
      product_type."id" AS "productTypeId",
      product_type."name" AS "productTypeName",
      product_type."active" AS "productTypeActive",
      global_type."id" AS "globalTypeId",
      global_type."active" AS "globalTypeActive",
      category."id" AS "categoryId",
      category."name" AS "categoryName",
      category."active" AS "categoryActive",
      GREATEST(COALESCE(balance."quantity", 0) - COALESCE(balance."reserved", 0), 0) AS "availableQuantity"
    FROM "BranchPrice" price
    JOIN "Product" product ON product."id" = price."productId"
    LEFT JOIN "Brand" brand ON brand."id" = product."brandId"
    LEFT JOIN "ProductType" product_type ON product_type."id" = product."productTypeId"
    LEFT JOIN "GlobalProductType" global_type ON global_type."id" = product_type."globalProductTypeId"
    LEFT JOIN "Category" category ON category."id" = global_type."categoryId"
    LEFT JOIN "StockBalance" balance
      ON balance."productId" = product."id" AND balance."branchId" = price."branchId"
    WHERE price."branchId" = ${branchId}
    ORDER BY product."name" ASC, product."id" ASC
  `)
}

module.exports = Object.freeze({ auditBranchProducts })
