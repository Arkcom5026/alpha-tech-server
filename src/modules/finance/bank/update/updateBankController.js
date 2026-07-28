const { prisma, Prisma } = require('../../../../../lib/prisma');
const { requireBranchId, toPositiveInt } = require('../shared/bankContext');

const isUniqueConstraintError = (err) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

const updateBank = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toPositiveInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const existing = await prisma.bank.findFirst({ where: { id, branchId } });
    if (!existing) {
      return res.status(404).json({ message: 'ไม่พบธนาคารที่ต้องการแก้ไข' });
    }

    const data = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อธนาคาร' });

      const duplicate = await prisma.bank.findFirst({
        where: {
          branchId,
          name: { equals: name, mode: 'insensitive' },
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return res.status(409).json({ message: 'ธนาคารนี้มีอยู่แล้วในสาขา' });
      }

      data.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'active')) {
      if (typeof req.body.active !== 'boolean') {
        return res.status(400).json({ message: 'รูปแบบ active ต้องเป็น boolean' });
      }
      data.active = req.body.active;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'ไม่มีข้อมูลที่รองรับสำหรับการแก้ไข' });
    }

    const updated = await prisma.bank.update({ where: { id }, data });
    return res.json(updated);
  } catch (err) {
    console.error('[updateBank] error:', err);
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ message: 'ธนาคารนี้มีอยู่แล้วในสาขา' });
    }
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขธนาคารได้' });
  }
};

module.exports = { updateBank };
