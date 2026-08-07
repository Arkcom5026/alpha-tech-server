'use strict'

const PRINT_RENDER_FORMATS = Object.freeze([
  'PDF',
  'HTML',
  'XPS',
  'EMF',
  'DRY_RUN_MANIFEST',
])

const FORMAT_SET = new Set(PRINT_RENDER_FORMATS)

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const nonEmpty = (value, code, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(code, `${field} is required`)
  }
  return value.trim()
}

const createPrintRenderArtifact = ({
  format,
  mediaType,
  documentPurpose,
  source,
  pageCount = 1,
  byteLength = 0,
  checksum = null,
  payload = null,
  renderer,
  physicalSideEffects = false,
}) => {
  const normalizedFormat = nonEmpty(
    format,
    'STORE_DEVICE_PRINT_RENDER_FORMAT_REQUIRED',
    'format',
  ).toUpperCase()

  if (!FORMAT_SET.has(normalizedFormat)) {
    throw fail(
      'STORE_DEVICE_PRINT_RENDER_FORMAT_INVALID',
      `Unsupported print render format: ${normalizedFormat}`,
    )
  }

  const normalizedPageCount = Number(pageCount)
  if (!Number.isInteger(normalizedPageCount) || normalizedPageCount <= 0) {
    throw fail(
      'STORE_DEVICE_PRINT_RENDER_PAGE_COUNT_INVALID',
      'pageCount must be a positive integer',
    )
  }

  const normalizedByteLength = Number(byteLength)
  if (!Number.isInteger(normalizedByteLength) || normalizedByteLength < 0) {
    throw fail(
      'STORE_DEVICE_PRINT_RENDER_BYTE_LENGTH_INVALID',
      'byteLength must be a non-negative integer',
    )
  }

  return Object.freeze({
    schemaVersion: 1,
    format: normalizedFormat,
    mediaType: nonEmpty(
      mediaType,
      'STORE_DEVICE_PRINT_RENDER_MEDIA_TYPE_REQUIRED',
      'mediaType',
    ),
    renderer: nonEmpty(
      renderer,
      'STORE_DEVICE_PRINT_RENDERER_REQUIRED',
      'renderer',
    ),
    physicalSideEffects: physicalSideEffects === true,
    documentPurpose: Object.freeze({
      code: nonEmpty(
        documentPurpose?.code,
        'STORE_DEVICE_PRINT_RENDER_PURPOSE_REQUIRED',
        'documentPurpose.code',
      ),
      displayName: documentPurpose?.displayName || null,
    }),
    source: Object.freeze({
      type: nonEmpty(
        source?.type,
        'STORE_DEVICE_PRINT_RENDER_SOURCE_TYPE_REQUIRED',
        'source.type',
      ),
      id: Number(source?.id),
    }),
    pageCount: normalizedPageCount,
    byteLength: normalizedByteLength,
    checksum,
    payload,
  })
}

const assertPrintRenderArtifact = (artifact) => {
  if (
    artifact?.schemaVersion !== 1
    || !FORMAT_SET.has(artifact?.format)
    || typeof artifact?.mediaType !== 'string'
    || !artifact.mediaType.trim()
    || typeof artifact?.renderer !== 'string'
    || !artifact.renderer.trim()
    || typeof artifact?.documentPurpose?.code !== 'string'
    || !artifact.documentPurpose.code.trim()
    || typeof artifact?.source?.type !== 'string'
    || !artifact.source.type.trim()
    || !Number.isInteger(Number(artifact?.source?.id))
    || Number(artifact.source.id) <= 0
    || !Number.isInteger(Number(artifact?.pageCount))
    || Number(artifact.pageCount) <= 0
    || !Number.isInteger(Number(artifact?.byteLength))
    || Number(artifact.byteLength) < 0
  ) {
    throw fail(
      'STORE_DEVICE_PRINT_RENDER_ARTIFACT_INVALID',
      'Print render artifact is not compatible with the render contract',
      409,
    )
  }

  return artifact
}

module.exports = {
  PRINT_RENDER_FORMATS,
  createPrintRenderArtifact,
  assertPrintRenderArtifact,
}
