'use strict'

const {
  assertWindowsDiscoverySnapshot,
} = require('./windowsPrintCapabilityContract')

const choosePrinter = (snapshot) => {
  if (snapshot.selectedPrinterName) {
    return snapshot.printers.find(
      (printer) => printer.name === snapshot.selectedPrinterName,
    ) || null
  }

  return snapshot.printers.find((printer) => printer.isDefault) || null
}

const createInspectWindowsPrintAdapterReadinessService = () => ({
  execute({ discoverySnapshot }) {
    const snapshot = assertWindowsDiscoverySnapshot(discoverySnapshot)
    const reasons = []

    if (snapshot.platform !== 'win32') {
      reasons.push('WINDOWS_PLATFORM_REQUIRED')
    }

    if (!snapshot.spoolerAvailable) {
      reasons.push('WINDOWS_SPOOLER_UNAVAILABLE')
    }

    if (snapshot.printers.length === 0) {
      reasons.push('WINDOWS_PRINTERS_NOT_DISCOVERED')
    }

    const selectedPrinter = choosePrinter(snapshot)

    if (snapshot.printers.length > 0 && !selectedPrinter) {
      reasons.push('WINDOWS_PRINTER_SELECTION_REQUIRED')
    }

    if (selectedPrinter && !selectedPrinter.isOnline) {
      reasons.push('WINDOWS_PRINTER_OFFLINE')
    }

    const ready = reasons.length === 0

    return Object.freeze({
      schemaVersion: 1,
      adapterCode: 'WINDOWS_SPOOLER',
      mode: 'DISCOVERY_ONLY',
      physicalSideEffects: false,
      ready,
      reasons: Object.freeze(reasons),
      capability: Object.freeze({
        platform: snapshot.platform,
        architecture: snapshot.architecture,
        spoolerAvailable: snapshot.spoolerAvailable,
        printerCount: snapshot.printers.length,
      }),
      selectedPrinter,
      printers: snapshot.printers,
    })
  },
})

module.exports = {
  createInspectWindowsPrintAdapterReadinessService,
}
