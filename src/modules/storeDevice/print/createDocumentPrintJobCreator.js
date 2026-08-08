'use strict'

const durableJobService = require('../services/storeDeviceDurableJobService')

const createDocumentPrintJobCreator = ({
  jobService = durableJobService,
} = {}) => ({
  create({ user, payload }) {
    return jobService.createJob({
      user,
      payload,
    })
  },
})

module.exports = {
  createDocumentPrintJobCreator,
}
