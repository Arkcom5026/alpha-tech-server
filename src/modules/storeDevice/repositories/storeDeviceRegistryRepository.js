'use strict'

const { prisma } = require('../../../../lib/prisma')

const mapDevice = (row) => row && Object.freeze({
  id: Number(row.id),
  branchId: row.branchId,
  gatewayId: row.gatewayId,
  deviceId: row.deviceId,
  name: row.name,
  kind: row.kind,
  connectionState: row.connectionState,
  capabilities: row.capabilities || {},
  transportKind: row.transportKind,
  adapterKind: row.adapterKind,
  metadata: row.metadata || {},
  workstationId: row.workstationId,
  registeredAt: row.registeredAt,
  updatedAt: row.updatedAt,
  revokedAt: row.revokedAt,
})

const rows = async (sql, ...params) => prisma.$queryRawUnsafe(sql, ...params)
const execute = async (sql, ...params) => prisma.$executeRawUnsafe(sql, ...params)

const find = async (branchId, deviceId) => {
  const result = await rows(
    'SELECT * FROM "StoreDeviceRegistryDevice" WHERE "branchId" = $1 AND "deviceId" = $2 LIMIT 1',
    branchId,
    deviceId,
  )
  return mapDevice(result[0])
}

const list = async (branchId) => {
  const result = await rows(
    'SELECT * FROM "StoreDeviceRegistryDevice" WHERE "branchId" = $1 ORDER BY "registeredAt" DESC, "id" DESC',
    branchId,
  )
  return result.map(mapDevice)
}

const register = async (input) => {
  const result = await rows(
    `INSERT INTO "StoreDeviceRegistryDevice"
      ("branchId", "gatewayId", "deviceId", "name", "kind", "connectionState", "capabilities", "transportKind", "adapterKind", "metadata")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb)
     ON CONFLICT ("branchId", "deviceId") DO UPDATE SET
       "name" = EXCLUDED."name",
       "connectionState" = EXCLUDED."connectionState",
       "capabilities" = EXCLUDED."capabilities",
       "transportKind" = EXCLUDED."transportKind",
       "adapterKind" = EXCLUDED."adapterKind",
       "metadata" = EXCLUDED."metadata",
       "updatedAt" = CURRENT_TIMESTAMP
     WHERE "StoreDeviceRegistryDevice"."gatewayId" = EXCLUDED."gatewayId"
       AND "StoreDeviceRegistryDevice"."revokedAt" IS NULL
     RETURNING *`,
    input.branchId,
    input.gatewayId,
    input.deviceId,
    input.name,
    input.kind,
    input.connectionState,
    JSON.stringify(input.capabilities || {}),
    input.transportKind,
    input.adapterKind,
    JSON.stringify(input.metadata || {}),
  )
  if (result[0]) return mapDevice(result[0])
  return find(input.branchId, input.deviceId)
}

const rename = async (branchId, deviceId, name) => {
  const result = await rows(
    `UPDATE "StoreDeviceRegistryDevice"
     SET "name" = $3, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "branchId" = $1 AND "deviceId" = $2 AND "revokedAt" IS NULL
     RETURNING *`,
    branchId,
    deviceId,
    name,
  )
  return mapDevice(result[0])
}

const assignWorkstation = async (branchId, deviceId, workstationId) => {
  const result = await rows(
    `UPDATE "StoreDeviceRegistryDevice"
     SET "workstationId" = $3, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "branchId" = $1 AND "deviceId" = $2 AND "revokedAt" IS NULL
     RETURNING *`,
    branchId,
    deviceId,
    workstationId,
  )
  return mapDevice(result[0])
}

const assignPrinterProfile = async (branchId, deviceId, printerProfileCode) => {
  const result = await rows(
    `UPDATE "StoreDeviceRegistryDevice"
     SET "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object('printerProfileCode', $3::text),
         "updatedAt" = CURRENT_TIMESTAMP
     WHERE "branchId" = $1 AND "deviceId" = $2 AND "kind" = 'PRINTER' AND "revokedAt" IS NULL
     RETURNING *`,
    branchId,
    deviceId,
    printerProfileCode,
  )
  return mapDevice(result[0])
}

const revoke = async (branchId, deviceId, revokedAt = new Date()) => {
  const result = await rows(
    `UPDATE "StoreDeviceRegistryDevice"
     SET "connectionState" = 'REVOKED', "workstationId" = NULL,
         "revokedAt" = COALESCE("revokedAt", $3), "updatedAt" = CURRENT_TIMESTAMP
     WHERE "branchId" = $1 AND "deviceId" = $2
     RETURNING *`,
    branchId,
    deviceId,
    revokedAt,
  )
  return mapDevice(result[0])
}

module.exports = { prisma, find, list, register, rename, assignWorkstation, assignPrinterProfile, revoke, execute }
