'use strict'

const assert = require('assert')
const Module = require('module')

const servicePath = require.resolve('../src/modules/employee/lookup/positions/positionLookupService')
const repositoryPath = require.resolve('../src/modules/employee/lookup/positions/positionLookupRepository')

const originalLoad = Module._load
let receivedBranchId = null

const repositoryStub = {
  listPositions: async ({ branchId }) => {
    receivedBranchId = branchId
    return [{ id: 7, name: 'แคชเชียร์', branchId, isActive: true }]
  },
}

Module._load = function patchedLoad(request, parent, isMain) {
  const resolved = Module._resolveFilename(request, parent, isMain)
  if (resolved === repositoryPath) return repositoryStub
  return originalLoad.apply(this, arguments)
}

delete require.cache[servicePath]
const service = require(servicePath)

async function main() {
  await assert.rejects(
    () => service.listPositions({ branchId: null }),
    (error) => error.code === 'EMPLOYEE_POSITION_LOOKUP_BRANCH_REQUIRED'
      && error.statusCode === 403,
  )

  const positions = await service.listPositions({ branchId: '14' })
  assert.equal(receivedBranchId, 14)
  assert.deepEqual(positions, [
    { id: 7, name: 'แคชเชียร์', branchId: 14, isActive: true },
  ])

  console.log('employee-position-lookup-branch-authority.contract.test.js: PASS')
}

main()
  .finally(() => {
    Module._load = originalLoad
    delete require.cache[servicePath]
  })
