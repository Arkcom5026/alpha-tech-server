'use strict'

const assert = require('assert')
const Module = require('module')

const servicePath = require.resolve('../src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeService')
const repositoryPath = require.resolve('../src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeRepository')

const originalLoad = Module._load
let positionLookup = null
let createdProfile = null
let transactionRuns = 0
let allowPosition = false
let positionCapabilities = null

const repositoryStub = {
  findUserByEmail: async () => null,
  findPositionForBranch: async (input) => {
    positionLookup = input
    return allowPosition
      ? { id: input.id, name: 'ตำแหน่งทดสอบ', branchId: input.branchId, isActive: true, capabilities: positionCapabilities }
      : null
  },
  runTransaction: async (work) => {
    transactionRuns += 1
    return work({})
  },
  createUser: async (data) => ({ id: 501, ...data }),
  createEmployeeProfile: async (data) => {
    createdProfile = data
    return {
      id: 601,
      ...data,
      position: { id: data.positionId, name: 'ตำแหน่งทดสอบ', capabilities: positionCapabilities },
      branch: { id: data.branchId, name: 'สาขาทดสอบ' },
    }
  },
  createCustomerProfile: async () => ({ id: 701 }),
  isUniqueConstraintError: () => false,
}

Module._load = function patchedLoad(request, parent, isMain) {
  const resolved = Module._resolveFilename(request, parent, isMain)
  if (resolved === repositoryPath) return repositoryStub
  return originalLoad.apply(this, arguments)
}

delete require.cache[servicePath]
const service = require(servicePath)

const makeResponse = () => {
  const result = { statusCode: 200, payload: null }
  return {
    result,
    status(code) {
      result.statusCode = code
      return this
    },
    json(payload) {
      result.payload = payload
      return payload
    },
  }
}

const validBody = {
  name: 'สมชาย ใจดี',
  email: 'staff@example.com',
  password: 'password8',
  phone: '0812345678',
  v2Role: 'CASHIER',
  positionId: 9,
  branchId: 999,
}

async function main() {
  {
    const res = makeResponse()
    await service.addSubEmployee({
      user: { role: 'EMPLOYEE', employeeRole: 'CASHIER', branchId: 2, positionCapabilities: null },
      body: validBody,
    }, res)
    assert.equal(res.result.statusCode, 403)
    assert.equal(res.result.payload.code, 'EMPLOYEE_ONBOARDING_FORBIDDEN')
  }

  {
    const res = makeResponse()
    await service.addSubEmployee({
      user: { role: 'EMPLOYEE', employeeRole: 'CASHIER', branchId: 2, positionCapabilities: ['employee.manage'] },
      body: validBody,
    }, res)
    assert.notEqual(res.result.statusCode, 403, 'position capability must override legacy CASHIER authority')
  }

  {
    positionLookup = null
    const res = makeResponse()
    await service.addSubEmployee({
      user: { role: 'ADMIN', branchId: 2 },
      body: { ...validBody, email: 'invalid-email' },
    }, res)
    assert.equal(res.result.statusCode, 400)
    assert.equal(res.result.payload.code, 'EMPLOYEE_EMAIL_INVALID')
    assert.equal(positionLookup, null)
  }

  {
    positionLookup = null
    const res = makeResponse()
    await service.addSubEmployee({
      user: { role: 'ADMIN', branchId: 2 },
      body: { ...validBody, password: '123456' },
    }, res)
    assert.equal(res.result.statusCode, 400)
    assert.equal(res.result.payload.code, 'EMPLOYEE_PASSWORD_TOO_SHORT')
    assert.equal(positionLookup, null)
  }

  {
    allowPosition = false
    positionLookup = null
    transactionRuns = 0
    const res = makeResponse()
    await service.addSubEmployee({
      user: { role: 'ADMIN', branchId: 2 },
      body: validBody,
    }, res)
    assert.deepEqual(positionLookup, { id: 9, branchId: 2 })
    assert.equal(res.result.statusCode, 400)
    assert.equal(res.result.payload.code, 'EMPLOYEE_POSITION_NOT_FOUND')
    assert.equal(transactionRuns, 0)
  }

  {
    allowPosition = true
    positionCapabilities = null
    createdProfile = null
    transactionRuns = 0
    const res = makeResponse()
    await service.addSubEmployee({
      user: { role: 'ADMIN', branchId: 2 },
      body: validBody,
    }, res)
    assert.equal(res.result.statusCode, 201)
    assert.equal(transactionRuns, 1)
    assert.equal(createdProfile.branchId, 2)
    assert.equal(createdProfile.positionId, 9)
    assert.equal(createdProfile.v2Role, 'CASHIER')
    assert.equal(res.result.payload.data.branchId, 2)
  }

  {
    allowPosition = true
    positionCapabilities = ['employee.manage']
    createdProfile = null
    const res = makeResponse()
    await service.addSubEmployee({
      user: { role: 'ADMIN', branchId: 2 },
      body: { ...validBody, v2Role: undefined },
    }, res)
    assert.equal(res.result.statusCode, 201)
    assert.equal(createdProfile.v2Role, 'MANAGER', 'migrated position must derive the compatibility role')
  }

  {
    allowPosition = true
    positionCapabilities = []
    createdProfile = null
    const res = makeResponse()
    await service.addSubEmployee({
      user: { role: 'ADMIN', branchId: 2 },
      body: { ...validBody, v2Role: 'MANAGER' },
    }, res)
    assert.equal(res.result.statusCode, 201)
    assert.equal(createdProfile.v2Role, 'CASHIER', 'explicit position authority must override requested legacy role')
  }

  console.log('employee-onboarding-branch-authority.contract.test.js: PASS')
}

main()
  .finally(() => {
    Module._load = originalLoad
    delete require.cache[servicePath]
  })
