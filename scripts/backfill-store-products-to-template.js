'use strict'

require('dotenv').config()

const { prisma } = require('../src/lib/prisma')
const {
  reverseCloneStoreProductToMatchingTemplate,
} = require('../src/modules/product/templateReverseClone/services/storeProductTemplateReverseCloneService')

const ALLOWED_BRANCHES = new Set([2, 5])
const DEFAULT_BATCH_SIZE = 50

const parseArgs = (argv) => {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }
    args[key] = next
    i += 1
  }
  return args
}

const parseBranches = (value) => {
  const branches = String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0)

  if (branches.length === 0) throw new Error('Missing --branches')
  const invalid = branches.filter((branchId) => !ALLOWED_BRANCHES.has(branchId))
  if (invalid.length > 0) {
    throw new Error(`Only branch 2 and 5 are allowed. Invalid: ${invalid.join(',')}`)
  }
  return [...new Set(branches)]
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
      if (!Number.isInteger(branchId) || !Number.isInteger(employeeId)) {
        throw new Error(`Invalid --employee-map entry: ${pair}`)
      }
      map.set(branchId, employeeId)
    })
  return map
}

const chunk = (items, size) => {
  const output = []
  for (let i = 0; i < items.length; i += size) output.push(items.slice(i, i + size))
  return output
}

const validateActor = async ({ branchId, employeeId }) => {
  const employee = await prisma.employeeProfile.findFirst({
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

const loadCandidates = async (branchId) =>
  prisma.product.findMany({
    where: {
      active: true,
      templateProductId: null,
      productType: {
        branchId: Number(branchId),
      },
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
          globalProductType: {
            select: { id: true, name: true, categoryId: true },
          },
        },
      },
    },
    orderBy: { id: 'asc' },
  })

const dryRunBranch = async ({ branchId, employee }) => {
  const candidates = await loadCandidates(branchId)
  const missingGlobalMapping = candidates.filter(
    (product) => !product.productType?.globalProductTypeId || !product.productType?.globalProductType?.categoryId,
  )

  return {
    branchId,
    employeeId: employee.id,
    employeeName: employee.name,
    actorRole: employee.v2Role,
    candidates: candidates.length,
    ready: candidates.length - missingGlobalMapping.length,
    missingGlobalMapping: missingGlobalMapping.length,
    mutation: 'NONE',
  }
}

const executeBranch = async ({ branchId, employee, batchSize }) => {
  const candidates = await loadCandidates(branchId)
  const summary = {
    branchId,
    employeeId: employee.id,
    actorRole: employee.v2Role,
    candidates: candidates.length,
    REVERSE_CLONED: 0,
    MATCHED_UNLINKED: 0,
    LINKED_TEMPLATE: 0,
    UNSUPPORTED: 0,
    FAILED: 0,
    failures: [],
  }

  const batches = chunk(candidates, batchSize)
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex]
    console.log(`\n[branch ${branchId}] batch ${batchIndex + 1}/${batches.length} (${batch.length})`)

    for (const product of batch) {
      try {
        const result = await reverseCloneStoreProductToMatchingTemplate({
          sourceBranchId: branchId,
          sourceProductId: product.id,
          employeeId: employee.id,
          role: employee.v2Role,
          v2Role: employee.v2Role,
        })
        const status = String(result?.status || 'UNKNOWN')
        if (Object.prototype.hasOwnProperty.call(summary, status)) summary[status] += 1
        else if (result?.success === false) summary.UNSUPPORTED += 1
        else summary.LINKED_TEMPLATE += 1

        console.log(
          `[${status}] store=${product.id} template=${result?.templateProductId || '-'} ${product.name}`,
        )
      } catch (error) {
        summary.FAILED += 1
        const failure = {
          productId: product.id,
          name: product.name,
          code: error?.code || null,
          message: error?.message || String(error),
        }
        summary.failures.push(failure)
        console.error(`[FAILED] store=${product.id} ${failure.code || ''} ${failure.message}`)
      }
    }
  }

  const remaining = await prisma.product.count({
    where: {
      active: true,
      templateProductId: null,
      productType: { branchId: Number(branchId) },
    },
  })
  summary.remainingUnlinked = remaining
  return summary
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const branches = parseBranches(args.branches)
  const employeeMap = parseEmployeeMap(args['employee-map'])
  const execute = Boolean(args.execute)
  const dryRun = Boolean(args['dry-run']) || !execute
  const batchSize = Number(args['batch-size'] || DEFAULT_BATCH_SIZE)

  if (execute && args['dry-run']) throw new Error('Use either --dry-run or --execute, not both')
  if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 100) {
    throw new Error('--batch-size must be an integer from 1 to 100')
  }

  console.log('Existing Store Products -> Template Backfill')
  console.log(`mode=${dryRun ? 'DRY_RUN' : 'EXECUTE'} branches=${branches.join(',')} batchSize=${batchSize}`)

  const summaries = []
  for (const branchId of branches) {
    const employeeId = employeeMap.get(branchId)
    if (!employeeId) throw new Error(`Missing employee mapping for branch ${branchId}`)
    const employee = await validateActor({ branchId, employeeId })

    const summary = dryRun
      ? await dryRunBranch({ branchId, employee })
      : await executeBranch({ branchId, employee, batchSize })
    summaries.push(summary)
  }

  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(summaries, null, 2))
}

main()
  .catch((error) => {
    console.error('\nBackfill aborted:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
