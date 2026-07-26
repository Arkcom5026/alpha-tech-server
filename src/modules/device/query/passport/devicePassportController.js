const service = require('./devicePassportService');

async function getDevicePassport(req, res, next) {
  try {
    const data = await service.execute(req.user, req.params.deviceId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { getDevicePassport };
