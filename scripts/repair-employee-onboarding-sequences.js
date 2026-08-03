'use strict'

if (process.env.ALLOW_EMPLOYEE_ONBOARDING_SEQUENCE_REPAIR !== 'true') {
  throw new Error(
    'Refusing sequence repair: set ALLOW_EMPLOYEE_ONBOARDING_SEQUENCE_REPAIR=true explicitly',
  )
}

if (process.env.ALPHATECH_RUNTIME_ENV !== 'TEST') {
  throw new Error('Refusing sequence repair outside ALPHATECH_RUNTIME_ENV=TEST')
}

const { prisma } = require('../lib/prisma')

const targets = ['User', 'EmployeeProfile', 'CustomerProfile']

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`

async function inspectTarget(tableName) {
  const quotedTable = quoteIdentifier(tableName)
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      pg_get_serial_sequence('${quotedTable}', 'id') AS "sequenceName",
      COALESCE((SELECT MAX(id) FROM ${quotedTable}), 0)::bigint AS "maxId"
  `)

  const row = rows[0] || {}
  const sequenceName = row.sequenceName || null
  const maxId = Number(row.maxId || 0)

  if (!sequenceName) {
    throw new Error(`No serial sequence found for ${tableName}.id`)
  }

  const sequenceRows = await prisma.$queryRawUnsafe(
    `SELECT last_value::bigint AS "lastValue", is_called AS "isCalled" FROM ${sequenceName}`,
  )
  const sequenceRow = sequenceRows[0] || {}
  const lastValue = Number(sequenceRow.lastValue || 0)
  const isCalled = Boolean(sequenceRow.isCalled)
  const nextValue = isCalled ? lastValue + 1 : lastValue
  const drifted = nextValue <= maxId

  return {
    tableName,
    sequenceName,
    maxId,
    lastValue,
    isCalled,
    nextValue,
    drifted,
  }
}

async function repairTarget(target) {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      '${target.sequenceName}'::regclass,
      ${Math.max(target.maxId, 1)},
      ${target.maxId > 0 ? 'true' : 'false'}
    )
  `)
}

async function main() {
  const before = []
  for (const tableName of targets) before.push(await inspectTarget(tableName))

  for (const target of before) {
    if (target.drifted) await repairTarget(target)
  }

  const after = []
  for (const tableName of targets) after.push(await inspectTarget(tableName))

  if (after.some((target) => target.drifted)) {
    throw new Error('Sequence repair did not converge for all employee onboarding tables')
  }

  console.log(JSON.stringify({
    result: 'PASS',
    repairedTables: before.filter((target) => target.drifted).map((target) => target.tableName),
    before,
    after,
  }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
