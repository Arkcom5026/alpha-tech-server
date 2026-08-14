'use strict'

const service = require('./partnerStoreApplicationService')
const reviewService = require('./partnerStoreApplicationReviewService')
const decisionService = require('./partnerStoreApplicationDecisionService')
const provisioningService = require('./partnerStoreProvisioningService')

const sendError = (res, error) => res.status(error?.statusCode || 500).json({ success: false, code: error?.code || 'PARTNER_STORE_APPLICATION_FAILED', message: error?.message || 'ดำเนินการใบสมัครร้านพาร์ทเนอร์ไม่สำเร็จ' })

exports.submit = async (req, res) => {
  try { return res.status(201).json({ success: true, data: await service.createApplication(req.body || {}) }) } catch (error) { return sendError(res, error) }
}
exports.list = async (req, res) => {
  try { return res.json({ success: true, data: await service.listApplications(req.query?.status) }) } catch (error) { return sendError(res, error) }
}
exports.startReview = async (req, res) => {
  try { return res.json({ success: true, data: await reviewService.startReview(Number(req.params.id), req.user?.id, req.body?.note) }) } catch (error) { return sendError(res, error) }
}
exports.approve = async (req, res) => {
  try { return res.json({ success: true, data: await decisionService.approve(Number(req.params.id), req.user?.id, req.body?.reviewNote) }) } catch (error) { return sendError(res, error) }
}
exports.reject = async (req, res) => {
  try { return res.json({ success: true, data: await decisionService.reject(Number(req.params.id), req.user?.id, req.body?.reviewNote) }) } catch (error) { return sendError(res, error) }
}
exports.provision = async (req, res) => {
  try { return res.json({ success: true, data: await provisioningService.provision(Number(req.params.id), req.user?.id) }) } catch (error) { return sendError(res, error) }
}
