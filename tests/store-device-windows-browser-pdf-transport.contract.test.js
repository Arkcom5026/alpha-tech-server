'use strict'

const assert = require('assert')
const {
  createWindowsBrowserPdfTransport,
} = require('../src/modules/storeDevice/print/render/windowsBrowserPdfTransport')

const calls = []
let htmlWritten = null
let htmlDeleted = null
const fakeBrowser = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const fakePdf = Buffer.from('%PDF-1.7\nalpha-tech')

const transport = createWindowsBrowserPdfTransport({
  tempRoot: 'C:\\temp',
  existsSync(value) {
    if (value === fakeBrowser) return true
    if (String(value).endsWith('.pdf')) return true
    if (String(value).endsWith('.html')) return htmlDeleted === null
    return false
  },
  writeFile(file, content, encoding) {
    htmlWritten = { file, content, encoding }
  },
  readFile(file) {
    assert.ok(String(file).endsWith('.pdf'))
    return fakePdf
  },
  unlink(file) {
    htmlDeleted = file
  },
  execFile(executable, args, options) {
    calls.push({ executable, args, options })
  },
})

const result = transport.execute({
  browserExecutablePath: fakeBrowser,
  html: '<html lang="th"><body>ทดสอบภาษาไทย</body></html>',
  outputPath: 'C:\\temp\\alpha-tech.pdf',
})

assert.strictEqual(transport.code, 'WINDOWS_BROWSER_PDF')
assert.strictEqual(transport.physicalSideEffects, false)
assert.strictEqual(transport.localProcessSideEffects, true)
assert.strictEqual(transport.filesystemSideEffects, true)
assert.strictEqual(calls.length, 1)
assert.strictEqual(calls[0].executable, fakeBrowser)
assert.ok(calls[0].args.includes('--headless=new'))
assert.ok(calls[0].args.includes('--no-pdf-header-footer'))
assert.ok(calls[0].args.some((arg) => arg.startsWith('--print-to-pdf=')))
assert.ok(calls[0].args.some((arg) => arg.startsWith('file:///')))
assert.ok(htmlWritten.content.includes('ทดสอบภาษาไทย'))
assert.strictEqual(htmlWritten.encoding, 'utf8')
assert.ok(htmlDeleted.endsWith('.html'))
assert.strictEqual(result.pdfBytes.subarray(0, 5).toString('ascii'), '%PDF-')
assert.strictEqual(result.outputPath, 'C:\\temp\\alpha-tech.pdf')

assert.throws(
  () => createWindowsBrowserPdfTransport({ existsSync: () => false }).execute({
    browserExecutablePath: fakeBrowser,
    html: '<html></html>',
  }),
  (error) => error.code === 'STORE_DEVICE_PRINT_BROWSER_EXECUTABLE_NOT_FOUND',
)

console.log('store-device-windows-browser-pdf-transport.contract.test.js: PASS')
