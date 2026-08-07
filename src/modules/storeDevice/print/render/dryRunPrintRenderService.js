'use strict'

const crypto = require('crypto')
const {
  assertExecutionEnvelope,
} = require('../printExecutionAdapterContract')
const {
  createPrintRenderArtifact,
} = require('./printRenderArtifactContract')

const stableJson = (value) => JSON.stringify(value)

const createDryRunPrintRenderService = () => ({
  execute({ executionEnvelope }) {
    const envelope = assertExecutionEnvelope(executionEnvelope)

    const manifest = Object.freeze({
      schemaVersion: 1,
      documentPurpose: envelope.documentPurpose,
      source: envelope.source,
      copies: Number(envelope.print.copies),
      projection: envelope.projection,
    })

    const serialized = stableJson(manifest)
    const checksum = crypto
      .createHash('sha256')
      .update(serialized, 'utf8')
      .digest('hex')

    return createPrintRenderArtifact({
      format: 'DRY_RUN_MANIFEST',
      mediaType: 'application/vnd.alphatech.print-manifest+json',
      renderer: 'DRY_RUN_RENDERER',
      physicalSideEffects: false,
      documentPurpose: envelope.documentPurpose,
      source: envelope.source,
      pageCount: 1,
      byteLength: Buffer.byteLength(serialized, 'utf8'),
      checksum: `sha256:${checksum}`,
      payload: manifest,
    })
  },
})

module.exports = {
  createDryRunPrintRenderService,
}
