'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const target = path.join(__dirname, '..', 'scripts', 'inspect-windows-browser-pdf-renderer.js')
const source = fs.readFileSync(target, 'utf8')

assert.match(source, /createInspectWindowsBrowserPdfRendererReadinessService/)
assert.match(source, /JSON\.stringify/)
assert.match(source, /process\.exitCode\s*=\s*2/)

for (const forbidden of [
  'child_process',
  'exec(',
  'execFile(',
  'spawn(',
  'powershell',
  'Start-Process',
  'winspool',
  'prisma',
]) {
  assert.strictEqual(
    source.toLowerCase().includes(forbidden.toLowerCase()),
    false,
    `inspection command must not contain physical or database side effect primitive: ${forbidden}`,
  )
}

console.log('store-device-windows-browser-pdf-renderer-command.contract.test.js: PASS')
