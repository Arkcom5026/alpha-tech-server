'use strict'

const { fail } = require('./printDocumentJobContract')

const createDocumentPrintJobService = ({
  routeResolver,
  jobService,
}) => ({
  async execute({ user, document, payload = {} }) {
    if (!routeResolver) {
      throw fail(
        'STORE_DEVICE_PRINT_ROUTE_RESOLVER_REQUIRED',
        'Print route resolver is required',
        500,
      )
    }

    if (!jobService) {
      throw fail(
        'STORE_DEVICE_PRINT_JOB_SERVICE_REQUIRED',
        'Print job service is required',
        500,
      )
    }

    const route = await routeResolver({
      user,
      document,
    })

    if (!route || route.routeStatus !== 'RESOLVED') {
      throw fail(
        'STORE_DEVICE_PRINT_ROUTE_UNAVAILABLE',
        'Unable to resolve print target',
        409,
      )
    }

    const requestSnapshot = {
      document,
      target: {
        type: 'DEVICE',
        deviceId: route.deviceId,
        capability: route.capability,
      },
      routeStatus: route.routeStatus,
    }

    return jobService.createJob({
      user,
      payload: {
        ...payload,
        jobType: 'PRINT_DOCUMENT',
        requestSnapshot,
      },
    })
  },
})

module.exports = {
  createDocumentPrintJobService,
}
