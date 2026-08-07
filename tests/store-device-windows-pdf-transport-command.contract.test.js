'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const scriptPath = path.join(__dirname, '..', 'scripts', 'inspect-windows-pdf-transport-readiness.js')
const source = fs.readFileSync(scriptPath, 'utf8')

assert.match(source, /createInspectWindowsPdfTransportReadinessService/)
assert.match(source, /JSON\.stringify\(report, null, 2\)/)
assert.match(source, /report\.ready \? 0 : 2/)
assert.doesNotMatch(source, /child_process|exec\(|execFile|spawn\(|Start-Process|PrintTo|WinSpool|prisma/i)

const servicePath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'storeDevice',
  'print',
  'adapters',
  'windows',
  'inspectWindowsPdfTransportReadinessService.js',
)
const serviceSource = fs.readFileSync(servicePath, 'utf8')
assert.doesNotMatch(serviceSource, /child_process|exec\(|execFile|spawn\(|Start-Process|PrintTo|WinSpool|prisma/i)

console.log('store-device-windows-pdf-transport-command.contract.test.js: PASS')
