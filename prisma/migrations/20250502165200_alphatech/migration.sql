/*
  Warnings:

  - You are about to drop the column `currentcy` on the `order` table. All the data in the column will be lost.
  - Added the required column `currency` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `order` DROP COLUMN `currentcy`,
    ADD COLUMN `currency` VARCHAR(191) NOT NULL,
    MODIFY `stripePaymentId` VARCHAR(191) NOT NULL;
