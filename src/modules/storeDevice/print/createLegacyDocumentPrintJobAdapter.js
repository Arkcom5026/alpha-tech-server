'use strict'

const createLegacyDocumentPrintJobAdapter = ({
  createDocumentPrintJobService,
}) => ({
  async execute({ user, document, payload = {} }) {
    if (!createDocumentPrintJobService) {
      throw new Error('Unified document print job service is required')
    }

    return createDocumentPrintJobService.execute({
      user,
      document,
      payload,
    })
  },
})

module.exports = {
  createLegacyDocumentPrintJobAdapter,
}
