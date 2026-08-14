'use strict'

const activationService = require('./partnerStoreActivationService')

const sendError = (res, error) => res.status(error?.statusCode || 500).json({
  success: false,
  code: error?.code || 'PARTNER_STORE_ACTIVATION_FAILED',
  message: error?.message || 'ดำเนินการเปิดใช้งานร้านพาร์ทเนอร์ไม่สำเร็จ',
})

exports.issueInvitation = async (req, res) => {
  try {
    return res.status(201).json({
      success: true,
      data: await activationService.issueInvitation(Number(req.params.id), req.user?.id),
    })
  } catch (error) {
    return sendError(res, error)
  }
}

exports.claim = async (req, res) => {
  try {
    return res.json({ success: true, data: await activationService.claimActivation(req.body || {}) })
  } catch (error) {
    return sendError(res, error)
  }
}
