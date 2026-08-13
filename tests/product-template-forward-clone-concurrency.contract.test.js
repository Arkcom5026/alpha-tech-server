'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  buildForwardCloneLockKey,
  acquireForwardCloneLock,
} = require('../src/modules/product/templateClone/services/productTemplateCloneService')

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/modules/product/templateClone/services/productTemplateCloneService.js'),
  'utf8'
)

const run = async () => {
  assert.strictEqual(
    buildForwardCloneLockKey({ branchId: 5, templateProductId: 4207 }),
    'product-template-forward-clone:5:4207'
  )

  assert.throws(
    () => buildForwardCloneLockKey({ branchId: null, templateProductId: 4207 }),
    (error) => error?.code === 'FORWARD_CLONE_LOCK_CONTEXT_REQUIRED'
  )

  let sql = null
  let lockKey = null
  const db = {
    $queryRawUnsafe: async (statement, key) => {
      sql = statement
      lockKey = key
      return [{ pg_advisory_xact_lock: '' }]
    },
  }

  const acquired = await acquireForwardCloneLock({
    branchId: 5,
    templateProductId: 4207,
    db,
  })

  assert.strictEqual(acquired, 'product-template-forward-clone:5:4207')
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\(\$1\)\)::text/)
  assert.strictEqual(lockKey, acquired)

  const lockIndex = source.indexOf('await acquireForwardCloneLock({')
  const existingIndex = source.indexOf('const existing = await findOperationalRuntimeProductByTemplateId({')
  const adoptIndex = source.indexOf('const { branchType } = await adoptBranchProductType({')
  const createIndex = source.indexOf('const created = await createOperationalProductRecordFromTemplate({')

  assert.ok(lockIndex > 0, 'forward clone lock must be acquired')
  assert.ok(existingIndex > lockIndex, 'existing traced Local Product must be checked after acquiring lock')
  assert.ok(adoptIndex > existingIndex, 'taxonomy adoption must happen only after the post-lock existing check')
  assert.ok(createIndex > adoptIndex, 'Product creation must happen after the serialized existing check')

  console.log('PASS product-template-forward-clone-concurrency.contract.test.js')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
