'use strict'

const { execFileSync } = require('node:child_process')
const {
  assertWindowsDiscoverySnapshot,
} = require('./windowsPrintCapabilityContract')

const fail = (code, message, statusCode = 500) =>
  Object.assign(new Error(message), { code, statusCode })

const DISCOVERY_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'

$spooler = Get-Service -Name Spooler -ErrorAction Stop
$printers = @(Get-Printer | ForEach-Object {
  [pscustomobject]@{
    name = [string]$_.Name
    isDefault = [bool]$_.Default
    isOnline = ([string]$_.PrinterStatus -notmatch 'Offline|Error')
    driverName = [string]$_.DriverName
    portName = [string]$_.PortName
  }
})

[pscustomobject]@{
  schemaVersion = 1
  platform = 'win32'
  architecture = $env:PROCESSOR_ARCHITECTURE
  spoolerAvailable = ($spooler.Status -eq 'Running')
  printers = $printers
} | ConvertTo-Json -Depth 5 -Compress
`.trim()

const parsePowerShellDiscoveryOutput = (stdout) => {
  let parsed
  try {
    parsed = JSON.parse(String(stdout || '').trim())
  } catch (error) {
    throw fail(
      'STORE_DEVICE_WINDOWS_PRINT_DISCOVERY_OUTPUT_INVALID',
      `Windows printer discovery returned invalid JSON: ${error.message}`,
    )
  }
  return assertWindowsDiscoverySnapshot(parsed)
}

const collectWindowsPrintDiscoverySnapshot = ({
  selectedPrinterName = null,
  execFile = execFileSync,
} = {}) => {
  if (process.platform !== 'win32') {
    throw fail(
      'STORE_DEVICE_WINDOWS_PRINT_DISCOVERY_PLATFORM_UNSUPPORTED',
      `Windows printer discovery requires win32; current platform is ${process.platform}`,
      409,
    )
  }

  let stdout
  try {
    stdout = execFile(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', DISCOVERY_SCRIPT],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      },
    )
  } catch (error) {
    throw fail(
      'STORE_DEVICE_WINDOWS_PRINT_DISCOVERY_FAILED',
      `Windows printer discovery failed: ${error.message}`,
    )
  }

  const snapshot = parsePowerShellDiscoveryOutput(stdout)
  return assertWindowsDiscoverySnapshot({
    ...snapshot,
    selectedPrinterName,
  })
}

module.exports = {
  DISCOVERY_SCRIPT,
  parsePowerShellDiscoveryOutput,
  collectWindowsPrintDiscoverySnapshot,
}
