'use strict'

const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { Client } = require('pg')
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority')

const envPath = path.join(process.cwd(), '.env.restore')
if (!fs.existsSync(envPath)) throw new Error('Missing .env.restore for dedicated Test DB verification')
dotenv.config({ path: envPath, override: true })

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL
const authority = assertTestDatabaseAuthority({ targetUrl, env: process.env })

const expectedColumns = Object.freeze({
  PrintDeviceProfile: [
    'id', 'branchId', 'code', 'normalizedCode', 'displayName', 'manufacturer',
    'modelName', 'capabilities', 'paperProfile', 'adapterKind', 'transportKind',
    'isActive', 'createdAt', 'updatedAt',
  ],
  DocumentPurposePrintRoute: [
    'id', 'branchId', 'definitionId', 'printerProfileId', 'requiredCapability',
    'copies', 'priority', 'isActive', 'createdAt', 'updatedAt',
  ],
})

const run = async () => {
  const connectionUrl = new URL(targetUrl)
  connectionUrl.searchParams.delete('sslmode')
  const client = new Client({
    connectionString: connectionUrl.toString(),
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    for (const [table, columns] of Object.entries(expectedColumns)) {
      const result = await client.query(
        `SELECT "column_name" FROM "information_schema"."columns"
         WHERE "table_schema" = 'public' AND "table_name" = $1`,
        [table],
      )
      const actual = new Set(result.rows.map((row) => row.column_name))
      for (const column of columns) {
        if (!actual.has(column)) throw new Error(`TEST_SCHEMA_MISSING: ${table}.${column}`)
      }
    }
    const constraints = await client.query(
      `SELECT "conname" FROM "pg_constraint"
       WHERE "conname" IN (
         'DocumentPurposePrintRoute_definition_fkey',
         'DocumentPurposePrintRoute_printerProfile_fkey',
         'DocumentPurposePrintRoute_copies_check'
       )`,
    )
    if (constraints.rowCount !== 3) throw new Error('TEST_SCHEMA_MISSING: printer routing constraints')
    console.log(`DOCUMENT PRINTER ROUTING TEST SCHEMA: PASS (${authority.target.host}/${authority.target.database})`)
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(`DOCUMENT PRINTER ROUTING TEST SCHEMA: FAIL (${error.message})`)
  process.exitCode = 1
})
