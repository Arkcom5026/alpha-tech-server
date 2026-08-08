'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  createDocumentPurposeController,
  actorFromRequest,
  branchFromRequest,
  mutationInput,
} = require('../src/modules/document-purpose/http/documentPurposeController')

const calls = []
const services = {
  readService: {
    list: async (input) => (calls.push(['list', input]), [{ id: 1 }]),
    getById: async (input) => (calls.push(['getById', input]), { id: 10 }),
    getByCode: async (input) => (calls.push(['getByCode', input]), { id: 10 }),
    listVersions: async (input) => (calls.push(['versions', input]), [{ version: 1 }]),
    listEvents: async (input) => (calls.push(['events', input]), [{ eventType: 'CREATED' }]),
  },
  createService: {
    execute: async (input) => (calls.push(['create', input]), { definition: { id: 10 } }),
  },
  updateService: {
    execute: async (input) => (calls.push(['update', input]), { changed: true }),
  },
  lifecycleService: {
    execute: async (input) => (calls.push(['lifecycle', input]), { changed: true }),
  },
}

const controller = createDocumentPurposeController(services)
const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
})

const req = (overrides = {}) => ({
  user: { branchId: 2, employeeId: 7, profileType: 'employee' },
  headers: {},
  params: {},
  query: {},
  body: {},
  ...overrides,
})

;(async () => {
  assert.deepEqual(actorFromRequest(req()), { branchId: 2, employeeId: 7 })
  assert.equal(branchFromRequest(req()), 2)
  assert.throws(
    () => actorFromRequest(req({ user: { branchId: 2, employeeId: null } })),
    (error) => error.code === 'DOCUMENT_PURPOSE_EMPLOYEE_CONTEXT_REQUIRED' && error.statusCode === 403,
  )

  assert.deepEqual(
    mutationInput(req({ headers: { 'x-idempotency-key': ' header-key ' }, body: { displayName: 'A' } })),
    { displayName: 'A', idempotencyKey: 'header-key' },
  )
  assert.equal(
    mutationInput(req({ headers: { 'x-idempotency-key': 'header-key' }, body: { idempotencyKey: 'body-key' } })).idempotencyKey,
    'body-key',
  )

  calls.length = 0
  let res = response()
  await controller.list(req({ query: { lifecycleState: 'ACTIVE' } }), res, (error) => { throw error })
  assert.deepEqual(calls[0], ['list', { branchId: 2, query: { lifecycleState: 'ACTIVE' } }])

  calls.length = 0
  res = response()
  await controller.create(
    req({ headers: { 'x-idempotency-key': 'create-1' }, body: { code: 'RECEIPT', displayName: 'Receipt' } }),
    res,
    (error) => { throw error },
  )
  assert.equal(res.statusCode, 201)
  assert.deepEqual(calls[0][1].actor, { branchId: 2, employeeId: 7 })
  assert.equal(calls[0][1].input.idempotencyKey, 'create-1')

  calls.length = 0
  await controller.update(
    req({ params: { definitionId: '10' }, body: { displayName: 'Updated' } }),
    response(),
    (error) => { throw error },
  )
  assert.equal(calls[0][0], 'update')
  assert.equal(calls[0][1].definitionId, '10')

  calls.length = 0
  await controller.lifecycle(
    req({ params: { definitionId: '10' }, body: { targetState: 'INACTIVE' } }),
    response(),
    (error) => { throw error },
  )
  assert.equal(calls[0][0], 'lifecycle')

  const routesPath = path.join(__dirname, '../src/modules/document-purpose/http/documentPurposeRoutes.js')
  const routes = fs.readFileSync(routesPath, 'utf8')
  assert.match(routes, /router\.use\(verifyToken\)/)
  assert.match(routes, /router\.get\('\/code\/:code'/)
  assert.match(routes, /router\.get\('\/:definitionId\/versions'/)
  assert.match(routes, /router\.get\('\/:definitionId\/events'/)
  assert.match(routes, /router\.post\('\/'/)
  assert.match(routes, /router\.patch\('\/:definitionId'/)
  assert.match(routes, /router\.post\('\/:definitionId\/lifecycle'/)

  const server = require('../scripts/read-server-composition-source').readServerCompositionSource(path.join(__dirname, '..'))
  assert.match(server, /documentPurposeRoutes/)
  assert.match(server, /app\.use\('\/api\/document-purposes', documentPurposeRoutes\)/)

  console.log('document-purpose-http-runtime.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
