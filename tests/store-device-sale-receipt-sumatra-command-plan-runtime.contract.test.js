'use strict'

const assert = require('assert')
const {
  createSaleReceiptSumatraPdfCommandPlanRuntimeService,
} = require('../src/modules/storeDevice/print/adapters/windows/createSaleReceiptSumatraPdfCommandPlanRuntimeService')

const executionEnvelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ jobId: 'sdj_sumatra_plan_101', jobType: 'PRINT_DOCUMENT' }),
  lease: Object.freeze({ leaseId: 'sdl_sumatra_plan_202' }),
  documentPurpose: Object.freeze({ code: 'SALE_RECEIPT', displayName: 'ใบเสร็จรับเงิน' }),
  source: Object.freeze({ type: 'PAYMENT', id: 638 }),
  print: Object.freeze({ copies: 2 }),
  projection: Object.freeze({ document: Object.freeze({ title: 'ใบเสร็จรับเงิน' }) }),
})

const checksum = 'a'.repeat(64)
const stagedPath = `C:\\AlphaTech\\print\\${checksum}.pdf`

const calls = {
  spool: [],
  stage: [],
  readiness: 0,
  command: [],
}

const spoolPlanRuntimeService = Object.freeze({
  async execute(input) {
    calls.spool.push(input)
    return Object.freeze({
      schemaVersion: 1,
      mode: 'SALE_RECEIPT_WINDOWS_PDF_SPOOL_PLAN',
      physicalSideEffects: false,
      executionEnabled: false,
      render: Object.freeze({
        artifact: Object.freeze({
          format: 'PDF',
          mediaType: 'application/pdf',
          checksum,
        }),
      }),
      spoolPlan: Object.freeze({
        printer: Object.freeze({ name: 'EPSON TM-T82X Receipt' }),
        print: Object.freeze({ copies: 2 }),
        artifact: Object.freeze({
          format: 'PDF',
          mediaType: 'application/pdf',
          checksum,
        }),
      }),
    })
  },
})

const stagingService = Object.freeze({
  async execute(input) {
    calls.stage.push(input)
    return Object.freeze({
      schemaVersion: 1,
      mode: 'WINDOWS_PDF_ARTIFACT_STAGED',
      physicalSideEffects: false,
      filesystemSideEffects: true,
      executionEnabled: false,
      artifact: Object.freeze({
        filePath: stagedPath,
        format: 'PDF',
        mediaType: 'application/pdf',
        checksum,
      }),
    })
  },
})

const transportReadiness = Object.freeze({
  schemaVersion: 1,
  mode: 'DISCOVERY_ONLY',
  ready: true,
  selectedTransport: Object.freeze({
    code: 'SUMATRA_PDF',
    strategy: 'EXPLICIT_PRINTER_CLI',
    executablePath: 'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
  }),
})

const transportReadinessService = Object.freeze({
  execute() {
    calls.readiness += 1
    return transportReadiness
  },
})

const commandPlanService = Object.freeze({
  execute(input) {
    calls.command.push(input)
    return Object.freeze({
      schemaVersion: 1,
      mode: 'COMMAND_PLAN_ONLY',
      physicalSideEffects: false,
      executionEnabled: false,
      transport: Object.freeze({ code: 'SUMATRA_PDF', strategy: 'EXPLICIT_PRINTER_CLI' }),
      printer: Object.freeze({ name: input.printerName }),
      artifact: Object.freeze({ filePath: input.artifactFilePath, mediaType: 'application/pdf' }),
      print: Object.freeze({ copies: input.copies }),
      command: Object.freeze({
        executablePath: transportReadiness.selectedTransport.executablePath,
        args: Object.freeze(['-silent', '-print-to', input.printerName, stagedPath]),
        shell: false,
      }),
    })
  },
})

async function main() {
  const service = createSaleReceiptSumatraPdfCommandPlanRuntimeService({
    spoolPlanRuntimeService,
    stagingService,
    transportReadinessService,
    commandPlanService,
  })

  const readiness = Object.freeze({ schemaVersion: 1, adapterCode: 'WINDOWS_SPOOLER', ready: true })
  const result = await service.execute({ executionEnvelope, readiness })

  assert.strictEqual(calls.spool.length, 1)
  assert.strictEqual(calls.spool[0].executionEnvelope, executionEnvelope)
  assert.strictEqual(calls.spool[0].readiness, readiness)
  assert.strictEqual(calls.stage.length, 1)
  assert.strictEqual(calls.stage[0].artifact.checksum, checksum)
  assert.strictEqual(calls.readiness, 1)
  assert.strictEqual(calls.command.length, 1)
  assert.strictEqual(calls.command[0].readiness, transportReadiness)
  assert.strictEqual(calls.command[0].printerName, 'EPSON TM-T82X Receipt')
  assert.strictEqual(calls.command[0].artifactFilePath, stagedPath)
  assert.strictEqual(calls.command[0].copies, 2)

  assert.strictEqual(result.mode, 'SALE_RECEIPT_SUMATRA_PDF_COMMAND_PLAN')
  assert.strictEqual(result.physicalSideEffects, false)
  assert.strictEqual(result.filesystemSideEffects, true)
  assert.strictEqual(result.executionEnabled, false)
  assert.strictEqual(result.documentPurpose.code, 'SALE_RECEIPT')
  assert.strictEqual(result.source.type, 'PAYMENT')
  assert.strictEqual(result.source.id, 638)
  assert.strictEqual(result.commandPlan.mode, 'COMMAND_PLAN_ONLY')
  assert.strictEqual(result.commandPlan.printer.name, 'EPSON TM-T82X Receipt')
  assert.strictEqual(result.commandPlan.artifact.filePath, stagedPath)
  assert.strictEqual(result.safety.artifactChecksumBoundToPlan, true)
  assert.strictEqual(result.safety.explicitPrinterBoundToPlan, true)
  assert.strictEqual(result.safety.transportReadinessVerified, true)
  assert.strictEqual(result.safety.processExecutionPerformed, false)
  assert.strictEqual(result.safety.spoolSubmissionPerformed, false)
  assert.strictEqual(result.safety.requiresExplicitPhysicalAuthorization, true)
  assert.strictEqual(result.safety.requiresDedicatedPhysicalExecutor, true)

  const mismatchService = createSaleReceiptSumatraPdfCommandPlanRuntimeService({
    spoolPlanRuntimeService,
    stagingService: Object.freeze({
      async execute() {
        return Object.freeze({
          artifact: Object.freeze({
            filePath: stagedPath,
            mediaType: 'application/pdf',
            checksum: 'b'.repeat(64),
          }),
        })
      },
    }),
    transportReadinessService,
    commandPlanService,
  })

  await assert.rejects(
    () => mismatchService.execute({ executionEnvelope, readiness }),
    (error) => error.code === 'STORE_DEVICE_SALE_RECEIPT_STAGED_PDF_MISMATCH',
  )

  assert.strictEqual(calls.command.length, 1)

  console.log('store-device-sale-receipt-sumatra-command-plan-runtime.contract.test.js: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
