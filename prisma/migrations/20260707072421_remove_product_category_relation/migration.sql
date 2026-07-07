/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `ProductType` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[branchId,globalProductTypeId,slug]` on the table `ProductType` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branchId,globalProductTypeId,normalizedName]` on the table `ProductType` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductType" DROP CONSTRAINT "ProductType_categoryId_fkey";

-- DropIndex
DROP INDEX "public"."Product_categoryId_idx";

-- DropIndex
DROP INDEX "public"."ProductType_branchId_categoryId_normalizedName_key";

-- DropIndex
DROP INDEX "public"."ProductType_branchId_categoryId_slug_key";

-- DropIndex
DROP INDEX "public"."ProductType_categoryId_idx";

-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "categoryId";

-- AlterTable
ALTER TABLE "public"."ProductType" DROP COLUMN "categoryId";

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_branchId_globalProductTypeId_slug_key" ON "public"."ProductType"("branchId", "globalProductTypeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_branchId_globalProductTypeId_normalizedName_key" ON "public"."ProductType"("branchId", "globalProductTypeId", "normalizedName");
