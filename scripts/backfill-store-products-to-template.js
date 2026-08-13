'use strict'

require('dotenv').config()

const { prisma } = require('../src/lib/prisma')
const {
  reverseCloneStoreProductToMatchingTemplate,
} = require('../src/modules/product/templateReverseClone/services/storeProductTemplateReverseCloneService')

const DEFAULT_BATCH_SIZE = 50
const MAX_BATCH_SIZE = 100

const parseArgs = (argv = []) => {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!String(token).startsWith('--')) continue
    const key = String(token).slice(2)
    const next = argv[i + 1]
    if (!next || String(next).startsWith('--')) {
      args[key] = true
      continue
    }
    args[key] = next
    i += 1
  }
  return args
}

const parsePositiveIdList = (value, label) => {
  const ids = String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0)

  const unique = [...new Set(ids)].sort((a, b) => a - b)
  if (unique.length === 0) throw new Error(`Missing ${label}`)
  return unique
}

const parseEmployeeMap = (value) => {
  const map = new Map()
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [branchRaw, employeeRaw] = pair.split(':')
      const branchId = Number(branchRaw)
      const employeeId = Number(employeeRaw)
      if (!Number.isInteger(branchId) || branchId <= 0 || !Number.isInteger(employeeId) || employeeId <= 0) {
        throw new Error(`Invalid --employee-map entry: ${pair}`)
      }
      map.set(branchId, employeeId)
    })
  return map
}

const assertExecuteConfirmation = ({ execute, branches, confirmation }) => {
  if (!execute) return
  const confirmed = parsePositiveIdList(confirmation, '--confirm-branches')
  if (confirmed.length !== branches.length || confirmed.some((id, index) => id !== branches[index])) {
    throw new Error('--confirm-branches must exactly match --branches when using --execute')
  }
}

const validateActor = async ({ branchId, employeeId, db = prisma }) => {
  const employee = await db.employeeProfile.findFirst({
    where: {
      id: Number(employeeId),
      branchId: Number(branchId),
      active: true,
      approved: true,
    },
    select: {
      id: true,
      branchId: true,
      name: true,
      role: true,
      v2Role: true,
      active: true,
      approved: true,
    },
  })

  if (!employee) {
    throw new Error(`Employee ${employeeId} is not an active approved actor for branch ${branchId}`)
  }
  return employee
}

const buildBranchProductWhere = (branchId) => ({
  active: true,
  productType: { branchId: Number(branchId) },
})

const loadBranchAudit = async ({ branchId, db = prisma }) => {
  const branchWhere = buildBranchProductWhere(branchId)
  const [activeProducts, linkedProducts, unlinkedProducts, missingGlobalMapping] = await Promise.all([
    db.product.count({ where: branchWhere }),
    db.product.count({ where: { ...branchWhere, templateProductId: { not: null } } }),
    db.product.count({ where: { ...branchWhere, templateProductId: null } }),
    db.product.count({
      where: {
        ...branchWhere,
        templateProductId: null,
        OR: [
          { productType: { globalProductTypeId: null } },
          { productType: { globalProductType: { categoryId: null } } },
        ],
      },
    }),
  ])

  return {
    branchId: Number(branchId),
    activeProducts,
    linkedProducts,
    unlinkedProducts,
    missingGlobalMapping,
    readyUnlinked: Math.max(0, unlinkedProducts - missingGlobalMapping),
  }
}

const loadCandidateBatch = async ({ branchId, afterId = 0, take = DEFAULT_BATCH_SIZE, db = prisma }) =>
  db.product.findMany({
    where: {
      ...buildBranchProductWhere(branchId),
      templateProductId: null,
      id: { gt: Number(afterId) || 0 },
    },
    select: {
      id: true,
      name: true,
      templateProductId: true,
      productType: {
        select: {
          id: true,
          name: true,
          branchId: true,
          globalProductTypeId: true,
          globalProductType: { select: { id: true, name: true, categoryId: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
    take,
  })

const dryRunBranch = async ({ branchId, employee, db = prisma }) => ({
  ...(await loadBranchAudit({ branchId, db })),
  employeeId: employee.id,
  employeeName: employee.name,
  actorRole: employee.v2Role || employee.role || null,
  mode: 'DRY_RUN',
  mutation: 'NONE',
})

const executeBranch = async ({
  branchId,
  employee,
  batchSize,
  maxItems = null,
  db = prisma,
  reverseClone = reverseCloneStoreProductToMatchingTemplate,
}) => {
  const before = await loadBranchAudit({ branchId, db })
  const summary = {
    branchId: Number(branchId),
    employeeId: employee.id,
    actorRole: employee.v2Role || employee.role || null,
    before,
    attempted: 0,
    REVERSE_CLONED: 0,
    MATCHED_UNLINKED: 0,
    LINKED_TEMPLATE: 0,
    SKIPPED: 0,
    FAILED: 0,
    failures: [],
  }

  let cursor = 0
  let stop = false

  while (!stop) {
    const batch = await loadCandidateBatch({ branchId, afterId: cursor, take: batchSize, db })
    if (batch.length === 0) break

    for (const product of batch) {
      cursor = product.id
      if (maxItems && summary.attempted >= maxItems) {
        stop = true
        break
      }

      summary.attempted += 1
      try {
        const result = await reverseClone({
          sourceBranchId: Number(branchId),
          sourceProductId: product.id,
          employeeId: employee.id,
          role: employee.role || employee.v2Role,
          v2Role: employee.v2Role || employee.role,
        })
        const status = String(result?.status || 'SKIPPED')
        if (Object.prototype.hasOwnProperty.call(summary, status)) summary[status] += 1
        else summary.SKIPPED += 1
        console.log(`[${status}] branch=${branchId} store=${product.id} template=${result?.templateProductId || '-'} ${product.name}`)
      } catch (error) {
        summary.FAILED += 1
        const failure = {
          productId: product.id,
          name: product.name,
          code: error?.code || null,
          message: error?.message || String(error),
        }
        summary.failures.push(failure)
        console.error(`[FAILED] branch=${branchId} store=${product.id} ${failure.code || ''} ${failure.message}`)
      }
    }
  }

  summary.after = await loadBranchAudit({ branchId, db })
  summary.remainingUnlinked = summary.after.unlinkedProducts
  summary.completed = summary.after.unlinkedProducts === 0
  return summary
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const branches = parsePositiveIdList(args.branches, '--branches')
  const employeeMap = parseEmployeeMap(args['employee-map'])
  const execute = Boolean(args.execute)
  const dryRun = Boolean(args['dry-run']) || !execute
  const batchSize = Number(args['batch-size'] || DEFAULT_BATCH_SIZE)
  const maxItems = args['max-items'] == null ? null : Number(args['max-items'])

  if (execute && args['dry-run']) throw new Error('Use either --dry-run or --execute, not both')
  if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > MAX_BATCH_SIZE) {
    throw new Error(`--batch-size must be an integer from 1 to ${MAX_BATCH_SIZE}`)
  }
  if (maxItems != null && (!Number.isInteger(maxItems) || maxItems <= 0)) {
    throw new Error('--max-items must be a positive integer')
  }

  assertExecuteConfirmation({ execute, branches, confirmation: args['confirm-branches'] })

  console.log('Existing Store Products -> Template Reverse Clone Backfill')
  console.log(`mode=${dryRun ? 'DRY_RUN' : 'EXECUTE'} branches=${branches.join(',')} batchSize=${batchSize}${maxItems ? ` maxItems=${maxItems}` : ''}`)

  const summaries = []
  for (const branchId of branches) {
    const employeeId = employeeMap.get(branchId)
    if (!employeeId) throw new Error(`Missing employee mapping for branch ${branchId}`)
    const employee = await validateActor({ branchId, employeeId })

    const summary = dryRun
      ? await dryRunBranch({ branchId, employee })
      : await executeBranch({ branchId, employee, batchSize, maxItems })
    summaries.push(summary)
  }

  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(summaries, null, 2))
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('\nBackfill aborted:', error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  parseArgs,
  parsePositiveIdList,
  parseEmployeeMap,
  assertExecuteConfirmation,
  validateActor,
  buildBranchProductWhere,
  loadBranchAudit,
  loadCandidateBatch,
  dryRunBranch,
  executeBranch,
  main,
}
