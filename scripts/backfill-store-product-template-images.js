'use strict'

require('dotenv').config()

const { prisma } = require('../src/lib/prisma')
const { syncStoreProductImagesToTemplate } = require('../src/modules/product/templateReverseClone/services/storeProductTemplateReverseCloneImageService')

const DEFAULT_BATCH_SIZE = 25
const MAX_BATCH_SIZE = 100

const parseList = (value, label) => {
  const ids = [...new Set(String(value || '').split(',').map((v) => Number(v.trim())).filter((v) => Number.isInteger(v) && v > 0))].sort((a, b) => a - b)
  if (!ids.length) throw new Error(`Missing ${label}`)
  return ids
}

const confirmExecute = ({ execute, branches, confirmation }) => {
  if (!execute) return
  const confirmed = parseList(confirmation, '--confirm-branches')
  if (confirmed.length !== branches.length || confirmed.some((id, i) => id !== branches[i])) {
    throw new Error('--confirm-branches must exactly match --branches when using --execute')
  }
}

const linkedWithImagesWhere = (branchId) => ({
  active: true,
  templateProductId: { not: null },
  productType: { branchId: Number(branchId) },
  productImages: { some: { active: true } },
})

const loadBatch = ({ branchId, afterId = 0, take = DEFAULT_BATCH_SIZE }) => prisma.product.findMany({
  where: { ...linkedWithImagesWhere(branchId), id: { gt: Number(afterId) || 0 } },
  select: { id: true, name: true, templateProductId: true },
  orderBy: { id: 'asc' },
  take,
})

const runBranch = async ({ branchId, batchSize, maxItems = null }) => {
  const summary = { branchId, attempted: 0, SYNCED: 0, ALREADY_SYNCED: 0, SKIPPED_NO_SOURCE_IMAGES: 0, SKIPPED_TARGET_HAS_IMAGES: 0, PARTIAL: 0, FAILED: 0, failures: [] }
  let cursor = 0
  let stop = false

  while (!stop) {
    const batch = await loadBatch({ branchId, afterId: cursor, take: batchSize })
    if (!batch.length) break
    for (const product of batch) {
      cursor = product.id
      if (maxItems && summary.attempted >= maxItems) { stop = true; break }
      summary.attempted += 1
      try {
        const result = await syncStoreProductImagesToTemplate({ sourceProductId: product.id, templateProductId: product.templateProductId })
        const status = String(result?.status || 'FAILED')
        if (Object.prototype.hasOwnProperty.call(summary, status)) summary[status] += 1
        else summary.FAILED += 1
        console.log(`[${status}] branch=${branchId} store=${product.id} template=${product.templateProductId} ${product.name}`)
      } catch (error) {
        summary.FAILED += 1
        summary.failures.push({ productId: product.id, templateProductId: product.templateProductId, code: error?.code || null, message: error?.message || String(error) })
      }
    }
  }
  return summary
}

const main = async () => {
  const argv = process.argv.slice(2)
  const readArg = (name) => {
    const i = argv.indexOf(`--${name}`)
    if (i < 0) return undefined
    const next = argv[i + 1]
    return !next || next.startsWith('--') ? true : next
  }

  const branches = parseList(readArg('branches'), '--branches')
  const execute = Boolean(readArg('execute'))
  const dryRun = Boolean(readArg('dry-run')) || !execute
  const batchSize = Number(readArg('batch-size') || DEFAULT_BATCH_SIZE)
  const maxItems = readArg('max-items') == null ? null : Number(readArg('max-items'))

  if (execute && readArg('dry-run')) throw new Error('Use either --dry-run or --execute, not both')
  if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > MAX_BATCH_SIZE) throw new Error(`--batch-size must be 1..${MAX_BATCH_SIZE}`)
  if (maxItems != null && (!Number.isInteger(maxItems) || maxItems <= 0)) throw new Error('--max-items must be a positive integer')
  confirmExecute({ execute, branches, confirmation: readArg('confirm-branches') })

  const summaries = []
  for (const branchId of branches) {
    if (dryRun) {
      const candidates = await prisma.product.count({ where: linkedWithImagesWhere(branchId) })
      summaries.push({ branchId, candidates, mode: 'DRY_RUN', mutation: 'NONE' })
    } else {
      summaries.push(await runBranch({ branchId, batchSize, maxItems }))
    }
  }
  console.log(JSON.stringify(summaries, null, 2))
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
}

module.exports = { DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE, parseList, confirmExecute, linkedWithImagesWhere, loadBatch, runBranch, main }
