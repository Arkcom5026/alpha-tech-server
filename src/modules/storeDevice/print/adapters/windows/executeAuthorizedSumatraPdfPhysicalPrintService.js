'use strict'

const { execFile: nodeExecFile } = require('child_process')

const fail = (code, message, statusCode = 409, detail = undefined) =>
  Object.assign(new Error(message), { code, statusCode, detail })

const assertAuthorization = (authorization) => {
  if (
    !authorization
    || authorization.schemaVersion !== 1
    || authorization.mode !== 'PHYSICAL_EXECUTION_AUTHORIZED'
    || authorization.physicalSideEffects !== false
    || authorization.executionEnabled !== false
    || authorization.transport?.code !== 'SUMATRA_PDF'
    || authorization.transport?.strategy !== 'EXPLICIT_PRINTER_CLI'
    || typeof authorization.printer?.name !== 'string'
    || !authorization.printer.name.trim()
    || typeof authorization.command?.executablePath !== 'string'
    || !authorization.command.executablePath.trim()
    || !Array.isArray(authorization.command?.args)
    || authorization.command.shell !== false
    || authorization.authorization?.explicitApprovalVerified !== true
    || authorization.authorization?.exactPrinterMatchVerified !== true
    || authorization.authorization?.executorRequired !== true
    || authorization.safety?.processExecutionPerformed !== false
    || authorization.safety?.spoolSubmissionPerformed !== false
    || authorization.safety?.requiresDedicatedPhysicalExecutor !== true
  ) {
    throw fail(
      'STORE_DEVICE_SUMATRA_PHYSICAL_AUTHORIZATION_REQUIRED',
      'Certified physical execution authorization is required',
      403,
    )
  }

  return authorization
}

const executeFile = (execFile, executablePath, args, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile(
      executablePath,
      args,
      {
        windowsHide: true,
        shell: false,
        timeout: timeoutMs,
        encoding: 'utf8',
      },
      (error, stdout = '', stderr = '') => {
        if (error) {
          reject(fail(
            'STORE_DEVICE_SUMATRA_PHYSICAL_EXECUTION_FAILED',
            'SumatraPDF physical print execution failed',
            502,
            {
              exitCode: Number.isInteger(error.code) ? error.code : null,
              signal: error.signal || null,
              stdout: String(stdout),
              stderr: String(stderr),
            },
          ))
          return
        }

        resolve({ stdout: String(stdout), stderr: String(stderr) })
      },
    )
  })

const createExecuteAuthorizedSumatraPdfPhysicalPrintService = ({
  execFile = nodeExecFile,
  timeoutMs = 30000,
} = {}) => Object.freeze({
  async execute({ authorization }) {
    const authority = assertAuthorization(authorization)

    const result = await executeFile(
      execFile,
      authority.command.executablePath,
      [...authority.command.args],
      timeoutMs,
    )

    return Object.freeze({
      schemaVersion: 1,
      mode: 'PHYSICAL_EXECUTION_SUBMITTED',
      physicalSideEffects: true,
      executionEnabled: true,
      transport: Object.freeze({ ...authority.transport }),
      printer: Object.freeze({ name: authority.printer.name }),
      artifact: Object.freeze({ ...authority.artifact }),
      print: Object.freeze({ ...authority.print }),
      command: Object.freeze({
        executablePath: authority.command.executablePath,
        args: Object.freeze([...authority.command.args]),
        shell: false,
      }),
      result: Object.freeze({
        submitted: true,
        stdout: result.stdout,
        stderr: result.stderr,
      }),
      safety: Object.freeze({
        explicitApprovalVerified: true,
        exactPrinterMatchVerified: true,
        processExecutionPerformed: true,
        spoolSubmissionAttempted: true,
      }),
    })
  },
})

module.exports = {
  createExecuteAuthorizedSumatraPdfPhysicalPrintService,
}
