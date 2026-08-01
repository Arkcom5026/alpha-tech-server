const service = require('./receiptSimpleRuntimeService');

const sendError = (res, error, operation) => {
  const code = error?.code;
  if (code === 'RECEIPT_SIMPLE_DISABLED') return res.status(403).json({ message: 'สาขานี้ปิดการรับสินค้าแบบ Simple' });
  if (code === 'LIMIT_EXCEEDED') return res.status(403).json({ message: 'เกินเพดานรายวัน ต้องใช้ Manager PIN' });
  if (code === 'PIN_INVALID') return res.status(401).json({ message: 'Manager PIN ไม่ถูกต้อง' });
  if (code === 'IDEMPOTENT_REPLAY') return res.status(200).json(error.payload || { message: 'Idempotent replay' });
  if (code === 'VALIDATION_ERROR') return res.status(400).json({ message: error.message || 'ข้อมูลไม่ถูกต้อง' });
  console.error(`[receiptSimpleRuntimeController.${operation}] Unhandled error:`, error);
  return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ' });
};

const resolveActor = (req, res) => {
  const branchId = req.user?.branchId;
  const userId = req.user?.id;
  if (!branchId || !userId) {
    res.status(401).json({ message: 'ไม่พบสิทธิ์การใช้งานสาขา (branchId) หรือผู้ใช้ (userId)' });
    return null;
  }
  return { branchId, userId };
};

const preview = async (req, res) => {
  try {
    const actor = resolveActor(req, res);
    if (!actor) return;
    const result = await service.preview({ ...actor, body: req.body || {} });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error, 'preview');
  }
};

const create = async (req, res) => {
  try {
    const actor = resolveActor(req, res);
    if (!actor) return;
    const result = await service.create({ ...actor, body: req.body || {} });
    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error, 'create');
  }
};

module.exports = { create, preview };
