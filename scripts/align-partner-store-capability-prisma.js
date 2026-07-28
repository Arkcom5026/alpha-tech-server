'use strict';

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const checkOnly = process.argv.includes('--check');
const schema = fs.readFileSync(schemaPath, 'utf8');

const branchAnchor = '  v2StockAudits                     V2StockAudit[]\n';
const branchRelation = '  partnerStoreCapability          PartnerStoreCapability?\n';

const modelBlock = `\nmodel PartnerStoreCapability {\n  id                       Int                    @id @default(autoincrement())\n  branchId                 Int                    @unique\n  storefrontEnabled        Boolean                @default(false)\n  storefrontSlug           String?                @unique\n  displayName              String?\n  contactPhone             String?\n  pickupEnabled            Boolean                @default(true)\n  deliveryEnabled          Boolean                @default(false)\n  deliveryFeeMode          OnlineDeliveryFeeMode?\n  fixedDeliveryFee         Decimal?               @db.Decimal(12, 2)\n  serviceAreaMode          StoreServiceAreaMode   @default(PICKUP_ONLY)\n  maxDeliveryDistanceKm    Decimal?               @db.Decimal(8, 2)\n  preparationSlaMinutes    Int?\n  pickupInstruction        String?\n  deliveryInstruction      String?\n  createdAt                DateTime                @default(now())\n  updatedAt                DateTime                @updatedAt\n  branch                   Branch                  @relation(fields: [branchId], references: [id], onDelete: Restrict)\n  serviceAreas             PartnerStoreServiceArea[]\n\n  @@index([storefrontEnabled])\n  @@index([pickupEnabled, deliveryEnabled])\n}\n\nmodel PartnerStoreServiceArea {\n  id           Int                  @id @default(autoincrement())\n  capabilityId Int\n  areaType     StoreServiceAreaType\n  areaCode     String\n  areaName     String?\n  active       Boolean              @default(true)\n  createdAt    DateTime             @default(now())\n  updatedAt    DateTime             @updatedAt\n  capability   PartnerStoreCapability @relation(fields: [capabilityId], references: [id], onDelete: Cascade)\n\n  @@unique([capabilityId, areaType, areaCode])\n  @@index([areaType, areaCode, active])\n}\n`;

const enumBlock = `\nenum OnlineDeliveryFeeMode {\n  FREE\n  FIXED\n  NEGOTIATED\n}\n\nenum StoreServiceAreaMode {\n  PICKUP_ONLY\n  ADMIN_AREAS\n  DISTANCE\n  NATIONWIDE\n}\n\nenum StoreServiceAreaType {\n  PROVINCE\n  DISTRICT\n  SUBDISTRICT\n  POSTAL_CODE\n}\n`;

let next = schema;

if (!next.includes(branchRelation)) {
  if (!next.includes(branchAnchor)) throw new Error('Branch relation anchor missing');
  next = next.replace(branchAnchor, `${branchAnchor}${branchRelation}`);
}

if (!next.includes('model PartnerStoreCapability {')) {
  const enumAnchor = '\nenum ';
  const index = next.indexOf(enumAnchor);
  if (index < 0) throw new Error('Enum anchor missing');
  next = `${next.slice(0, index)}${modelBlock}${next.slice(index)}`;
}

if (!next.includes('enum OnlineDeliveryFeeMode {')) {
  next = `${next.trimEnd()}\n${enumBlock}`;
}

if (checkOnly) {
  if (next !== schema) {
    console.error('Partner Store Capability Prisma projection is not aligned');
    process.exit(1);
  }
  console.log('Partner Store Capability Prisma projection: PASS');
  process.exit(0);
}

if (next === schema) {
  console.log('Partner Store Capability Prisma projection already aligned');
  process.exit(0);
}

fs.writeFileSync(schemaPath, next);
console.log('Partner Store Capability Prisma projection aligned');
