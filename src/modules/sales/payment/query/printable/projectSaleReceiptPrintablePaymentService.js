'use strict'

const { prisma } = require('../../../../../lib/prisma')
const {
  ResolvePrintDocumentPurposeService,
} = require('../../../../document-purpose/resolve/resolvePrintDocumentPurposeService')

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  throw error
}

const positiveInt = (value, code, field) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(code, `${field} must be a positive integer`)
  }
  return parsed
}

const amount = (value) => Number(value || 0)

const projectSaleReceiptPrintablePayment = async ({ branchId, paymentId }) => {
  const normalizedBranchId = positiveInt(
    branchId,
    'SALE_RECEIPT_BRANCH_REQUIRED',
    'branchId',
  )
  const normalizedPaymentId = positiveInt(
    paymentId,
    'SALE_RECEIPT_PAYMENT_ID_REQUIRED',
    'paymentId',
  )

  const payment = await prisma.payment.findFirst({
    where: {
      id: normalizedPaymentId,
      branchId: normalizedBranchId,
      isCancelled: false,
      sale: {
        is: {
          branchId: normalizedBranchId,
          status: { not: 'CANCELLED' },
        },
      },
    },
    select: {
      id: true,
      code: true,
      receivedAt: true,
      note: true,
      combinedDocumentCode: true,
      items: {
        select: {
          id: true,
          amount: true,
          note: true,
          cardRef: true,
          paymentMethod: true,
        },
      },
      sale: {
        select: {
          id: true,
          code: true,
          soldAt: true,
          status: true,
          totalBeforeDiscount: true,
          totalDiscount: true,
          vat: true,
          totalAmount: true,
          paidAmount: true,
          statusPayment: true,
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              companyName: true,
              departmentName: true,
              taxId: true,
            },
          },
          items: {
            select: {
              id: true,
              basePrice: true,
              discount: true,
              price: true,
              vatAmount: true,
              documentDescription: true,
              stockItem: {
                select: {
                  barcode: true,
                  product: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          simpleItems: {
            select: {
              id: true,
              quantity: true,
              basePrice: true,
              discount: true,
              price: true,
              vatAmount: true,
              documentDescription: true,
              product: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  })

  if (!payment) {
    fail('SALE_RECEIPT_PAYMENT_NOT_FOUND', 'Printable sale receipt payment not found', 404)
  }

  const purpose = await new ResolvePrintDocumentPurposeService().execute({
    branchId: normalizedBranchId,
    code: 'SALE_RECEIPT',
  })

  const paymentAmount = payment.items.reduce(
    (sum, item) => sum + amount(item.amount),
    0,
  )

  const lines = [
    ...payment.sale.items.map((item) => ({
      id: item.id,
      lineType: 'STOCK_ITEM',
      description: String(
        item.documentDescription || item.stockItem?.product?.name || 'Sale item',
      ),
      barcode: item.stockItem?.barcode || null,
      quantity: 1,
      unitAmount: amount(item.basePrice),
      discountAmount: amount(item.discount),
      lineAmount: amount(item.price),
      vatAmount: amount(item.vatAmount),
    })),
    ...payment.sale.simpleItems.map((item) => ({
      id: item.id,
      lineType: 'SIMPLE',
      description: String(
        item.documentDescription || item.product?.name || 'Sale item',
      ),
      barcode: null,
      quantity: amount(item.quantity),
      unitAmount: amount(item.basePrice),
      discountAmount: amount(item.discount),
      lineAmount: amount(item.price),
      vatAmount: amount(item.vatAmount),
    })),
  ]

  return Object.freeze({
    document: {
      id: payment.id,
      type: purpose.code,
      title: purpose.displayName,
      number: payment.code,
      issuedAt: payment.receivedAt,
      combinedDocumentCode: payment.combinedDocumentCode,
      amount: paymentAmount,
    },
    issuer: {
      branchId: payment.sale.branch.id,
      name: payment.sale.branch.name,
    },
    recipient: payment.sale.customer
      ? {
          id: payment.sale.customer.id,
          name: payment.sale.customer.companyName || payment.sale.customer.name || null,
          taxId: payment.sale.customer.taxId || null,
        }
      : null,
    sale: {
      id: payment.sale.id,
      code: payment.sale.code,
      soldAt: payment.sale.soldAt,
      status: payment.sale.status,
      totalBeforeDiscount: amount(payment.sale.totalBeforeDiscount),
      totalDiscount: amount(payment.sale.totalDiscount),
      vatAmount: amount(payment.sale.vat),
      totalAmount: amount(payment.sale.totalAmount),
      paidAmount: amount(payment.sale.paidAmount),
      statusPayment: payment.sale.statusPayment,
    },
    payment: {
      id: payment.id,
      code: payment.code,
      receivedAt: payment.receivedAt,
      note: payment.note,
      amount: paymentAmount,
      items: payment.items.map((item) => ({
        id: item.id,
        paymentMethod: item.paymentMethod,
        amount: amount(item.amount),
        note: item.note,
        cardRef: item.cardRef,
      })),
    },
    lines,
  })
}

module.exports = Object.freeze({ projectSaleReceiptPrintablePayment })
