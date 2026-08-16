'use strict'

require('dotenv').config()

const { Client } = require('pg')

const requiredFoundations = [
  ['device_category_enum', 'type', 'DeviceCategory'],
  ['device_intake_table', 'relation', 'DeviceIntake'],
  ['device_tracking_access', 'relation', 'RepairTrackingAccess'],
  ['input_tax_receipt_links', 'relation', 'InputTaxDocumentReceiptLink'],
  ['supplier_payables', 'relation', 'SupplierPayable'],
  ['supplier_payment_allocations', 'relation', 'SupplierPaymentAllocation'],
  ['supplier_advances', 'relation', 'SupplierAdvance'],
  ['supplier_disputes', 'relation', 'SupplierPayableDispute'],
  ['pos_held_carts', 'relation', 'PosHeldCart'],
]

const buildClient = () => {
  const raw = process.env.DATABASE_URL || process.env.DIRECT_URL
  if (!raw) throw new Error('DATABASE_URL or DIRECT_URL is required')

  const url = new URL(raw)
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
    url.searchParams.delete(key)
  }

  return new Client({
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
  })
}

const projectionFor = ([key, kind, name]) => {
  const lookup = kind === 'type' ? 'to_regtype' : 'to_regclass'
  return `${lookup}('public."${name}"') IS NOT NULL AS "${key}"`
}

async function main() {
  const client = buildClient()
  await client.connect()

  try {
    const projections = requiredFoundations
      .map(projectionFor)
      .join(',\n      ')

    const result = await client.query(`
      SELECT
        ${projections}
    `)

    const state = result.rows[0] || {}
    const missing = requiredFoundations
      .filter(([key]) => state[key] !== true)
      .map(([key, kind, name]) => `${key} (${kind}:${name})`)

    if (missing.length > 0) {
      throw new Error(
        `Runtime database foundations are missing: ${missing.join(', ')}. ` +
        'Run "npm run db:ensure-runtime-foundations" as an explicit deployment/maintenance step before starting the server.'
      )
    }

    console.log('[db] Runtime foundation read-only verification is ready')
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('[db] Runtime foundation read-only verification failed:', error.message)
  process.exitCode = 1
})
