'use strict'

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const nonEmpty = (value, code, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(code, `${field} is required`)
  }
  return value.trim()
}

const normalizePrinter = (printer) => {
  const name = nonEmpty(
    printer?.name,
    'STORE_DEVICE_WINDOWS_PRINTER_NAME_REQUIRED',
    'printer.name',
  )

  return Object.freeze({
    name,
    isDefault: printer?.isDefault === true,
    isOnline: printer?.isOnline !== false,
    driverName: typeof printer?.driverName === 'string' && printer.driverName.trim()
      ? printer.driverName.trim()
      : null,
    portName: typeof printer?.portName === 'string' && printer.portName.trim()
      ? printer.portName.trim()
      : null,
  })
}

const assertWindowsDiscoverySnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    throw fail(
      'STORE_DEVICE_WINDOWS_PRINT_DISCOVERY_INVALID',
      'Windows print discovery snapshot is required',
    )
  }

  const platform = nonEmpty(
    snapshot.platform,
    'STORE_DEVICE_WINDOWS_PRINT_PLATFORM_REQUIRED',
    'platform',
  ).toLowerCase()

  const printers = Array.isArray(snapshot.printers)
    ? snapshot.printers.map(normalizePrinter)
    : []

  return Object.freeze({
    schemaVersion: 1,
    platform,
    architecture: typeof snapshot.architecture === 'string' && snapshot.architecture.trim()
      ? snapshot.architecture.trim()
      : null,
    spoolerAvailable: snapshot.spoolerAvailable === true,
    printers: Object.freeze(printers),
    selectedPrinterName: typeof snapshot.selectedPrinterName === 'string' && snapshot.selectedPrinterName.trim()
      ? snapshot.selectedPrinterName.trim()
      : null,
  })
}

module.exports = {
  assertWindowsDiscoverySnapshot,
}
