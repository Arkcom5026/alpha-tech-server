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
const authority = assertTestDatabaseAuthority({
  targetUrl,
  env: process.env,
  requiresWriteApproval: true,
})
const migration = fs.readFileSync(
  path.join(process.cwd(), 'prisma/migrations/20260809010000_document_printer_routing_foundation/migration.sql'),
  'utf8',
)

const run = async () => {
  const url = new URL(targetUrl)
  url.searchParams.delete('sslmode')
  const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
  await client.connect()
  let began = false
  try {
    await client.query('BEGIN')
    began = true
    await client.query(migration)
    const tables = await client.query(
      `SELECT "table_name" FROM "information_schema"."tables"
       WHERE "table_schema" = 'public'
         AND "table_name" IN ('PrintDeviceProfile', 'DocumentPurposePrintRoute')`,
    )
    if (tables.rowCount !== 2) throw new Error('Migration did not create both routing tables')
    const constraints = await client.query(
      `SELECT "conname" FROM "pg_constraint"
       WHERE "conname" IN (
         'DocumentPurposePrintRoute_definition_fkey',
         'DocumentPurposePrintRoute_printerProfile_fkey',
         'DocumentPurposePrintRoute_copies_check'
       )`,
    )
    if (constraints.rowCount !== 3) throw new Error('Migration did not create routing isolation constraints')
    console.log(`DOCUMENT PRINTER ROUTING MIGRATION DRY RUN: PASS (${authority.target.host}/${authority.target.database})`)
  } finally {
    if (began) await client.query('ROLLBACK')
    await client.end()
  }
}

run().catch((error) => {
  console.error(`DOCUMENT PRINTER ROUTING MIGRATION DRY RUN: FAIL (${error.message})`)
  process.exitCode = 1
})
