'use strict';

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const checkOnly = process.argv.includes('--check');

const fail = (message) => {
  throw new Error(`[online-commerce-prisma] ${message}`);
};

const replaceOnce = (source, anchor, replacement, label) => {
  if (!source.includes(anchor)) fail(`anchor not found: ${label}`);
  const first = source.indexOf(anchor);
  if (source.indexOf(anchor, first + anchor.length) !== -1) fail(`anchor is not unique: ${label}`);
  return source.replace(anchor, replacement);
};

let schema = fs.readFileSync(schemaPath, 'utf8');
const original = schema;

if (!schema.includes('partnerStoreCapability          PartnerStoreCapability?')) {
  schema = replaceOnce(
    schema,
    '  productReservations             ProductReservation[]\n  v2StockAudits',
    '  productReservations             ProductReservation[]\n  partnerStoreCapability          PartnerStoreCapability?\n  v2StockAudits',
    'Branch relation',
  );
}

if (!schema.includes('orderSource         OnlineOrderSource')) {
  schema = replaceOnce(
    schema,
    '  status              ProductReservationStatus @default(ACTIVE)\n  totalBeforeDiscount',
    '  status              ProductReservationStatus @default(ACTIVE)\n  orderSource         OnlineOrderSource         @default(STOREFRONT)\n  sourceReference     String?\n  fulfillmentMethod   OnlineFulfillmentMethod   @default(PICKUP)\n  deliveryFeeMode     OnlineDeliveryFeeMode?\n  deliveryFee         Decimal                   @default(0) @db.Decimal(12, 2)\n  recipientName       String?\n  recipientPhone      String?\n  deliveryAddress     String?\n  deliveryNote        String?\n  totalBeforeDiscount',
    'ProductReservation online fields',
  );
}

if (!schema.includes('@@index([branchId, orderSource, createdAt])')) {
  schema = replaceOnce(
    schema,
    '  @@index([branchId, status, createdAt])\n  @@index([customerId, createdAt])',
    '  @@index([branchId, status, createdAt])\n  @@index([branchId, orderSource, createdAt])\n  @@index([branchId, fulfillmentMethod, status])\n  @@index([branchId, fulfillmentMethod, status, updatedAt])\n  @@index([customerId, createdAt])',
    'ProductReservation indexes',
  );
}

if (!schema.includes('model PartnerStoreCapability {')) {
  const models = `model PartnerStoreCapability {
  id                    Int                     @id @default(autoincrement())
  branchId              Int                     @unique
  storefrontEnabled     Boolean                 @default(false)
  storefrontSlug        String?                 @unique
  displayName           String?
  contactPhone          String?
  pickupEnabled         Boolean                 @default(true)
  deliveryEnabled       Boolean                 @default(false)
  deliveryFeeMode       OnlineDeliveryFeeMode?
  fixedDeliveryFee      Decimal?                @db.Decimal(12, 2)
  serviceAreaMode       StoreServiceAreaMode    @default(PICKUP_ONLY)
  maxDeliveryDistanceKm Decimal?                @db.Decimal(8, 2)
  preparationSlaMinutes Int?
  pickupInstruction     String?
  deliveryInstruction   String?
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt
  branch                Branch                  @relation(fields: [branchId], references: [id], onDelete: Restrict)
  serviceAreas          PartnerStoreServiceArea[]

  @@index([storefrontEnabled])
  @@index([pickupEnabled, deliveryEnabled])
}

model PartnerStoreServiceArea {
  id           Int                      @id @default(autoincrement())
  capabilityId Int
  areaType     StoreServiceAreaType
  areaCode     String
  areaName     String?
  active       Boolean                  @default(true)
  createdAt    DateTime                 @default(now())
  updatedAt    DateTime                 @updatedAt
  capability   PartnerStoreCapability   @relation(fields: [capabilityId], references: [id], onDelete: Cascade)

  @@unique([capabilityId, areaType, areaCode])
  @@index([areaType, areaCode, active])
}

`;
  schema = replaceOnce(schema, 'model ProductReservationItem {', `${models}model ProductReservationItem {`, 'Partner Store models');
}

if (!schema.includes('enum OnlineOrderSource {')) {
  const enums = `enum OnlineOrderSource {
  MARKETPLACE
  STOREFRONT
  FACEBOOK
  LINE
  QR
  PHONE
  OTHER
}

enum OnlineFulfillmentMethod {
  PICKUP
  DELIVERY
}

enum OnlineDeliveryFeeMode {
  FREE
  FIXED
  NEGOTIATED
}

enum StoreServiceAreaMode {
  PICKUP_ONLY
  ADMIN_AREAS
  DISTANCE
  NATIONWIDE
}

enum StoreServiceAreaType {
  PROVINCE
  DISTRICT
  SUBDISTRICT
  POSTAL_CODE
}

`;
  schema = replaceOnce(schema, 'enum ProductReservationLineType {', `${enums}enum ProductReservationLineType {`, 'Online commerce enums');
}

for (const status of ['READY_TO_SHIP', 'SHIPPING', 'DELIVERED']) {
  if (!new RegExp(`enum ProductReservationStatus \\{[\\s\\S]*?\\n  ${status}\\n`).test(schema)) {
    schema = replaceOnce(
      schema,
      '  READY_FOR_PICKUP\n  COMPLETED',
      `  READY_FOR_PICKUP\n  ${status}\n  COMPLETED`,
      `ProductReservationStatus.${status}`,
    );
  }
}

const requiredTokens = [
  'partnerStoreCapability          PartnerStoreCapability?',
  'orderSource         OnlineOrderSource',
  'fulfillmentMethod   OnlineFulfillmentMethod',
  'model PartnerStoreCapability {',
  'model PartnerStoreServiceArea {',
  'enum OnlineOrderSource {',
  'enum OnlineFulfillmentMethod {',
  'enum OnlineDeliveryFeeMode {',
  'enum StoreServiceAreaMode {',
  'enum StoreServiceAreaType {',
  'READY_TO_SHIP',
  'SHIPPING',
  'DELIVERED',
];

for (const token of requiredTokens) {
  if (!schema.includes(token)) fail(`required projection token missing after alignment: ${token}`);
}

if (checkOnly) {
  if (schema !== original) {
    console.error('Online Commerce Prisma projection is not aligned. Run: npm run prisma:align-online-commerce');
    process.exitCode = 1;
  } else {
    console.log('Online Commerce Prisma projection alignment: PASS');
  }
} else if (schema !== original) {
  fs.writeFileSync(schemaPath, schema);
  console.log('Online Commerce Prisma projection aligned safely.');
} else {
  console.log('Online Commerce Prisma projection already aligned.');
}
