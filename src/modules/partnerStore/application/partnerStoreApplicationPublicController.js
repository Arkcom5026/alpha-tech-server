'use strict'

const intakeService = require('./partnerStoreApplicationIntakeService')

const sendError = (res, error) =>
  res.status(error?.statusCode || 500).json({
    success: false,
    code: error?.code || 'PARTNER_STORE_APPLICATION_FAILED',
    message: error?.message || 'ดำเนินการใบสมัครร้านพาร์ทเนอร์ไม่สำเร็จ',
  })

exports.submit = async (req, res) => {
  try {
    const data = await intakeService.submitApplication(req.body || {})
    return res.status(201).json({ success: true, data })
  } catch (error) {
    return sendError(res, error)
  }
}
