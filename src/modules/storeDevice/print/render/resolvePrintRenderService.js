'use strict'

const {
  createDryRunPrintRenderService,
} = require('./dryRunPrintRenderService')

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const normalizeFormat = (format) => {
  if (typeof format !== 'string' || !format.trim()) {
    throw fail(
      'STORE_DEVICE_PRINT_RENDER_FORMAT_REQUIRED',
      'Print render format is required',
    )
  }
  return format.trim().toUpperCase()
}

const createResolvePrintRenderService = ({ renderers } = {}) => {
  const registry = new Map()

  const register = (format, renderer) => {
    const normalizedFormat = normalizeFormat(format)
    if (!renderer || typeof renderer.execute !== 'function') {
      throw fail(
        'STORE_DEVICE_PRINT_RENDERER_INVALID',
        `Renderer for ${normalizedFormat} must implement execute()`,
        500,
      )
    }
    registry.set(normalizedFormat, renderer)
  }

  register('DRY_RUN_MANIFEST', createDryRunPrintRenderService())

  if (renderers && typeof renderers === 'object') {
    for (const [format, renderer] of Object.entries(renderers)) {
      register(format, renderer)
    }
  }

  return Object.freeze({
    resolve({ format }) {
      const normalizedFormat = normalizeFormat(format)
      const renderer = registry.get(normalizedFormat)
      if (!renderer) {
        throw fail(
          'STORE_DEVICE_PRINT_RENDERER_UNAVAILABLE',
          `No certified renderer is registered for ${normalizedFormat}`,
          409,
        )
      }
      return renderer
    },

    supportedFormats() {
      return Object.freeze([...registry.keys()])
    },
  })
}

module.exports = {
  createResolvePrintRenderService,
}
