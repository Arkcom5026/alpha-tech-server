const { prisma, Prisma } = require('../../../../../lib/prisma');
const { requireBranchId } = require('../shared/bankContext');

const isUniqueConstraintError = (err) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

const createBank = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อธนาคาร' });

    const existing = await prisma.bank.findFirst({
      where: {
        branchId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ message: 'ธนาคารนี้มีอยู่แล้วในสาขา' });
    }

    const created = await prisma.bank.create({
      data: { name, branchId, active: true },
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('[createBank] error:', err);
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ message: 'ธนาคารนี้มีอยู่แล้วในสาขา' });
    }
    return res.status(500).json({ error: 'ไม่สามารถสร้างธนาคารได้' });
  }
};

module.exports = { createBank };
