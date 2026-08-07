'use strict'

const fs = require('fs')
const path = require('path')

const BROWSER_CANDIDATES = Object.freeze([
  Object.freeze({
    code: 'EDGE',
    relativePaths: Object.freeze([
      Object.freeze({ env: 'PROGRAMFILES(X86)', path: ['Microsoft', 'Edge', 'Application', 'msedge.exe'] }),
      Object.freeze({ env: 'PROGRAMFILES', path: ['Microsoft', 'Edge', 'Application', 'msedge.exe'] }),
      Object.freeze({ env: 'LOCALAPPDATA', path: ['Microsoft', 'Edge', 'Application', 'msedge.exe'] }),
    ]),
  }),
  Object.freeze({
    code: 'CHROME',
    relativePaths: Object.freeze([
      Object.freeze({ env: 'PROGRAMFILES', path: ['Google', 'Chrome', 'Application', 'chrome.exe'] }),
      Object.freeze({ env: 'PROGRAMFILES(X86)', path: ['Google', 'Chrome', 'Application', 'chrome.exe'] }),
      Object.freeze({ env: 'LOCALAPPDATA', path: ['Google', 'Chrome', 'Application', 'chrome.exe'] }),
    ]),
  }),
])

const discoverCandidate = ({ code, relativePaths }, env, existsSync) => {
  const locations = relativePaths
    .map((entry) => {
      const root = env[entry.env]
      if (!root) return null
      const executablePath = path.join(root, ...entry.path)
      return Object.freeze({
        environmentVariable: entry.env,
        executablePath,
        exists: existsSync(executablePath),
      })
    })
    .filter(Boolean)

  const availableLocation = locations.find((entry) => entry.exists) || null

  return Object.freeze({
    code,
    available: Boolean(availableLocation),
    executablePath: availableLocation?.executablePath || null,
    locations: Object.freeze(locations),
  })
}

const createInspectWindowsBrowserPdfRendererReadinessService = ({
  platform = process.platform,
  env = process.env,
  existsSync = fs.existsSync,
} = {}) => Object.freeze({
  execute() {
    const candidates = BROWSER_CANDIDATES.map((candidate) =>
      discoverCandidate(candidate, env, existsSync))

    const selected = candidates.find((candidate) => candidate.available) || null
    const reasons = []

    if (platform !== 'win32') {
      reasons.push('WINDOWS_PLATFORM_REQUIRED')
    }

    if (!selected) {
      reasons.push('WINDOWS_BROWSER_PDF_RENDERER_NOT_DISCOVERED')
    }

    return Object.freeze({
      schemaVersion: 1,
      strategy: 'LOCAL_GATEWAY_BROWSER_PDF',
      mode: 'DISCOVERY_ONLY',
      physicalSideEffects: false,
      ready: reasons.length === 0,
      reasons: Object.freeze(reasons),
      selectedRenderer: selected
        ? Object.freeze({
            browser: selected.code,
            executablePath: selected.executablePath,
          })
        : null,
      candidates: Object.freeze(candidates),
    })
  },
})

module.exports = {
  BROWSER_CANDIDATES,
  createInspectWindowsBrowserPdfRendererReadinessService,
}
