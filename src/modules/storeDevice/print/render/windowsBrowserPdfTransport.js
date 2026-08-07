'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const nonEmpty = (value, code, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(code, `${field} is required`)
  }
  return value.trim()
}

const createWindowsBrowserPdfTransport = ({
  execFile = execFileSync,
  writeFile = fs.writeFileSync,
  readFile = fs.readFileSync,
  unlink = fs.unlinkSync,
  existsSync = fs.existsSync,
  tempRoot = os.tmpdir(),
} = {}) => Object.freeze({
  code: 'WINDOWS_BROWSER_PDF',
  physicalSideEffects: false,
  localProcessSideEffects: true,
  filesystemSideEffects: true,

  execute({ browserExecutablePath, html, outputPath = null }) {
    const executable = nonEmpty(
      browserExecutablePath,
      'STORE_DEVICE_PRINT_BROWSER_EXECUTABLE_REQUIRED',
      'browserExecutablePath',
    )
    const sourceHtml = nonEmpty(
      html,
      'STORE_DEVICE_PRINT_BROWSER_HTML_REQUIRED',
      'html',
    )

    if (!existsSync(executable)) {
      throw fail(
        'STORE_DEVICE_PRINT_BROWSER_EXECUTABLE_NOT_FOUND',
        `Browser executable was not found: ${executable}`,
        409,
      )
    }

    const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const htmlPath = path.join(tempRoot, `alpha-tech-print-${nonce}.html`)
    const pdfPath = outputPath
      ? path.resolve(outputPath)
      : path.join(tempRoot, `alpha-tech-print-${nonce}.pdf`)

    try {
      writeFile(htmlPath, sourceHtml, 'utf8')

      execFile(
        executable,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-pdf-header-footer',
          `--print-to-pdf=${pdfPath}`,
          `file:///${htmlPath.replace(/\\/g, '/')}`,
        ],
        { stdio: 'pipe', windowsHide: true },
      )

      if (!existsSync(pdfPath)) {
        throw fail(
          'STORE_DEVICE_PRINT_BROWSER_PDF_NOT_CREATED',
          'Browser did not create the expected PDF artifact',
          502,
        )
      }

      const pdfBytes = Buffer.from(readFile(pdfPath))
      if (pdfBytes.length < 5 || pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw fail(
          'STORE_DEVICE_PRINT_BROWSER_PDF_INVALID',
          'Browser output is not a valid PDF byte stream',
          502,
        )
      }

      return Object.freeze({
        renderer: 'WINDOWS_BROWSER_PDF',
        pdfBytes,
        outputPath: pdfPath,
      })
    } finally {
      try {
        if (existsSync(htmlPath)) unlink(htmlPath)
      } catch (_) {
        // Temp HTML cleanup must not mask the render outcome.
      }
    }
  },
})

module.exports = {
  createWindowsBrowserPdfTransport,
}
