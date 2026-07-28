'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const foundationMigration = read('prisma/migrations/20260728170000_product_reservation_foundation/migration.sql');
const guardMigration = read('prisma/migrations/20260728173000_product_reservation_stock_guards/migration.sql');
const repository = read('src/modules/sales/reservation/create/productReservationCreateRepository.js');
const service = read('src/modules/sales/reservation/create/productReservationCreateService.js');
const controller = read('src/modules/sales/reservation/create/productReservationCreateController.js');
const reservationRoutes = read('src/modules/sales/reservation/routes/productReservationRoutes.js');
const saleRoutes = read('src/modules/sales/routes/saleRoutes.js');

assert.match(foundationMigration, /CREATE TABLE "ProductReservation"/);
assert.match(foundationMigration, /CREATE TABLE "ProductReservationItem"/);
assert.match(foundationMigration, /"isActive" BOOLEAN NOT NULL DEFAULT TRUE/);
assert.match(foundationMigration, /ProductReservationItem_active_stock_unique/);
assert.match(foundationMigration, /WHERE "stockItemId" IS NOT NULL AND "isActive" = TRUE/);

assert.match(guardMigration, /ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'RESERVE'/);
assert.match(guardMigration, /CHECK \("reserved" >= 0\)/);
assert.match(guardMigration, /CHECK \("reserved" <= "quantity"\)/);
assert.match(guardMigration, /prevent_reserved_stock_item_sale/);
assert.match(guardMigration, /StockItem_active_reservation_sale_guard/);

assert.match(repository, /db\.\$transaction/);
assert.match(repository, /FOR UPDATE/);
assert.match(repository, /\("quantity" - "reserved"\) >=/);
assert.match(repository, /item\."isActive" = TRUE/);
assert.match(repository, /'RESERVE'::"StockMovementType"/);
assert.match(repository, /'PRODUCT_RESERVATION'/);
assert.doesNotMatch(repository, /tx\.stockMovement\.create/);

assert.match(service, /STOCK_ITEM/);
assert.match(service, /SIMPLE/);
assert.match(service, /RESERVATION_DUPLICATE_LINE/);
assert.match(service, /RESERVATION_EXPIRY_INVALID/);
assert.match(controller, /createProductReservation/);
assert.match(reservationRoutes, /router\.post\('\/'/);
assert.match(saleRoutes, /router\.use\('\/reservations', productReservationRoutes\)/);

console.log('product reservation foundation contract: PASS');
