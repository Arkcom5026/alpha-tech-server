'use strict'

const fs = require('fs')
const path = require('path')

const CANDIDATES = Object.freeze([
  Object.freeze({
    code: 'SUMATRA_PDF',
    strategy: 'EXPLICIT_PRINTER_CLI',
    locations: Object.freeze([
      Object.freeze({ environmentVariable: 'LOCALAPPDATA', segments: ['SumatraPDF', 'SumatraPDF.exe'] }),
      Object.freeze({ environmentVariable: 'PROGRAMFILES', segments: ['SumatraPDF', 'SumatraPDF.exe'] }),
      Object.freeze({ environmentVariable: 'PROGRAMFILES(X86)', segments: ['SumatraPDF', 'SumatraPDF.exe'] }),
    ]),
  }),
  Object.freeze({
    code: 'ADOBE_READER',
    strategy: 'SHELL_PRINT_TO_CANDIDATE',
    locations: Object.freeze([
      Object.freeze({ environmentVariable: 'PROGRAMFILES', segments: ['Adobe', 'Acrobat DC', 'Acrobat', 'Acrobat.exe'] }),
      Object.freeze({ environmentVariable: 'PROGRAMFILES(X86)', segments: ['Adobe', 'Acrobat Reader DC', 'Reader', 'AcroRd32.exe'] }),
      Object.freeze({ environmentVariable: 'PROGRAMFILES', segments: ['Adobe', 'Acrobat Reader DC', 'Reader', 'AcroRd32.exe'] }),
    ]),
  }),
])

const resolveLocation = ({ environmentVariable, segments }, env, existsSync) => {
  const root = env?.[environmentVariable]
  if (!root) {
    return Object.freeze({ environmentVariable, executablePath: null, exists: false })
  }
  const executablePath = path.join(root, ...segments)
  return Object.freeze({ environmentVariable, executablePath, exists: existsSync(executablePath) })
}

const createInspectWindowsPdfTransportReadinessService = ({
  existsSync = fs.existsSync,
  env = process.env,
  platform = process.platform,
} = {}) => Object.freeze({
  execute() {
    const candidates = CANDIDATES.map((candidate) => {
      const locations = candidate.locations.map((location) => resolveLocation(location, env, existsSync))
      const selected = locations.find((location) => location.exists) || null
      return Object.freeze({
        code: candidate.code,
        strategy: candidate.strategy,
        available: Boolean(selected),
        executablePath: selected?.executablePath || null,
        locations: Object.freeze(locations),
      })
    })

    const preferred = candidates.find((candidate) => candidate.code === 'SUMATRA_PDF' && candidate.available)
      || candidates.find((candidate) => candidate.available)
      || null

    const ready = platform === 'win32' && preferred?.code === 'SUMATRA_PDF'
    const reasons = []
    if (platform !== 'win32') reasons.push('WINDOWS_PLATFORM_REQUIRED')
    if (!preferred) reasons.push('WINDOWS_PDF_TRANSPORT_NOT_DISCOVERED')
    else if (preferred.code !== 'SUMATRA_PDF') reasons.push('EXPLICIT_PRINTER_PDF_TRANSPORT_REQUIRED')

    return Object.freeze({
      schemaVersion: 1,
      mode: 'DISCOVERY_ONLY',
      physicalSideEffects: false,
      platform,
      ready,
      reasons: Object.freeze(reasons),
      selectedTransport: preferred
        ? Object.freeze({
            code: preferred.code,
            strategy: preferred.strategy,
            executablePath: preferred.executablePath,
          })
        : null,
      candidates: Object.freeze(candidates),
      policy: Object.freeze({
        preferredTransport: 'SUMATRA_PDF',
        requiresExplicitPrinterTarget: true,
        shellPrintToIsNotCertified: true,
        executionEnabled: false,
      }),
    })
  },
})

module.exports = {
  CANDIDATES,
  createInspectWindowsPdfTransportReadinessService,
}
