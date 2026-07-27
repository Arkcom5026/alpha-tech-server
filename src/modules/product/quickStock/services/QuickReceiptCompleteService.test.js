const assert = require('node:assert/strict')

const QuickReceiptCompleteService = require('./QuickReceiptCompleteService')

const makeService = () => {
  const service = new QuickReceiptCompleteService({})
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
    getReceipt: async () => ({ id: 77, status: 'DRAFT' }),
    cancel: async (receiptId, branchId, reason) => {
      calls.push(['cancel', receiptId, branchId, reason])
      return { id: receiptId, status: 'CANCELLED' }
    },
  }
  return { service, calls }
}

;(async () => {
  {
    const { service, calls } = makeService()
    const result = await service.complete({
      deliveryNoteNumber: 'DN-001',
      items: [{ productId: 101 }, { productId: 202 }],
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
      () => service.complete({ deliveryNoteNumber: 'DN-FAIL', items: [{ productId: 101 }] }, 3, 9, 'cmd-fail'),
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

  console.log('✅ QuickReceiptCompleteService orchestration contract passed')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
