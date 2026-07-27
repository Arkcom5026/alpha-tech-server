const assert = require('node:assert/strict')

const QuickReceiptCompleteService = require('./QuickReceiptCompleteService')

const makeService = ({ priorCommands = [], priorReceipt = null } = {}) => {
  const prisma = {
    $queryRawUnsafe: async () => priorCommands,
  }
  const service = new QuickReceiptCompleteService(prisma)
  const calls = []
  service.sessions = {
    createDraft: async (payload, branchId, employeeId) => {
      calls.push(['createDraft', payload.deliveryNoteNumber, branchId, employeeId])
      return { id: 77, status: 'DRAFT', items: [] }
    },
    addItem: async (receiptId, line, branchId) => {
      calls.push(['addItem', receiptId, line.productId, branchId])
      return { id: receiptId, status: 'DRAFT' }
    },
    finalize: async (receiptId, branchId, employeeId, commandKey) => {
      calls.push(['finalize', receiptId, branchId, employeeId, commandKey])
      return { id: receiptId, status: 'COMPLETED' }
    },
    getReceipt: async () => priorReceipt || ({ id: 77, status: 'DRAFT' }),
    cancel: async (receiptId, branchId, reason) => {
      calls.push(['cancel', receiptId, branchId, reason])
      return { id: receiptId, status: 'CANCELLED' }
    },
  }
  return { service, calls }
}

const completePayload = {
  supplierId: 5,
  deliveryNoteNumber: 'DN-001',
  taxDocumentMode: 'NOT_RECEIVED',
  items: [
    {
      productId: 101,
      quantity: 1,
      costPrice: 100,
      priceRetail: 150,
      items: [{ barcode: 'BC-001', serialNumber: null }],
    },
  ],
}

;(async () => {
  {
    const { service, calls } = makeService()
    const result = await service.complete({
      ...completePayload,
      items: [
        ...completePayload.items,
        { productId: 202, quantity: 2, costPrice: 50, priceRetail: 80, items: [] },
      ],
    }, 3, 9, 'cmd-001')

    assert.equal(result.status, 'COMPLETED')
    assert.deepEqual(calls, [
      ['createDraft', 'DN-001', 3, 9],
      ['addItem', 77, 101, 3],
      ['addItem', 77, 202, 3],
      ['finalize', 77, 3, 9, 'cmd-001'],
    ])
  }

  {
    const { service, calls } = makeService()
    service.sessions.addItem = async () => {
      const error = new Error('line failed')
      error.code = 'LINE_FAILED'
      throw error
    }

    await assert.rejects(
      () => service.complete({ ...completePayload, deliveryNoteNumber: 'DN-FAIL' }, 3, 9, 'cmd-fail'),
      (error) => error.code === 'LINE_FAILED'
    )
    assert.equal(calls.at(-1)[0], 'cancel')
    assert.match(calls.at(-1)[3], /ONE_SHOT_PREPARATION_FAILED: LINE_FAILED/)
  }

  {
    const { service } = makeService()
    await assert.rejects(
      () => service.complete({ items: [] }, 3, 9, 'cmd-empty'),
      (error) => error.code === 'RECEIPT_ITEMS_REQUIRED' && error.statusCode === 400
    )
  }

  {
    const priorReceipt = {
      id: 77,
      status: 'COMPLETED',
      ...completePayload,
    }
    const { service, calls } = makeService({
      priorCommands: [{ receiptId: 77 }],
      priorReceipt,
    })

    const replay = await service.complete(completePayload, 3, 9, 'cmd-replay')
    assert.equal(replay.id, 77)
    assert.deepEqual(calls, [])
  }

  {
    const priorReceipt = {
      id: 77,
      status: 'COMPLETED',
      ...completePayload,
    }
    const { service } = makeService({
      priorCommands: [{ receiptId: 77 }],
      priorReceipt,
    })

    await assert.rejects(
      () => service.complete({ ...completePayload, deliveryNoteNumber: 'DN-OTHER' }, 3, 9, 'cmd-conflict'),
      (error) => error.code === 'IDEMPOTENCY_KEY_CONFLICT' && error.statusCode === 409
    )
  }

  console.log('✅ QuickReceiptCompleteService orchestration contract passed')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
