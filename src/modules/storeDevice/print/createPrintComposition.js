'use strict'

const {
  createDocumentPrintJobCreator,
} = require('./createDocumentPrintJobCreator')
const {
  createSaleReceiptPrintJobService,
} = require('./createSaleReceiptPrintJobService')
const {
  createDeliveryNotePrintJobService,
} = require('./createDeliveryNotePrintJobService')
const {
  createOutputTaxInvoicePrintJobService,
} = require('./createOutputTaxInvoicePrintJobService')

const createPrintComposition = ({
  documentPrintJobCreator = createDocumentPrintJobCreator(),
} = {}) => ({
  saleReceiptPrintJobService: createSaleReceiptPrintJobService({
    documentPrintJobCreator,
  }),
  deliveryNotePrintJobService: createDeliveryNotePrintJobService({
    documentPrintJobCreator,
  }),
  outputTaxInvoicePrintJobService: createOutputTaxInvoicePrintJobService({
    documentPrintJobCreator,
  }),
})

module.exports = {
  createPrintComposition,
}
