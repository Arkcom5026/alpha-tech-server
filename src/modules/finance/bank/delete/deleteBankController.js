const { prisma, Prisma } = require('../../../../../lib/prisma');
const { requireBranchId, toPositiveInt } = require('../shared/bankContext');

const isForeignKeyConstraintError = (err) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003';

const deleteBank = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toPositiveInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const existing = await prisma.bank.findFirst({
      where: { id, branchId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ message: 'ไม่พบธนาคารที่ต้องการลบ' });
    }

    await prisma.bank.delete({ where: { id } });
    return res.json({ message: 'ลบธนาคารเรียบร้อย' });
  } catch (err) {
    console.error('[deleteBank] error:', err);
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ message: 'ลบไม่ได้ เนื่องจากธนาคารนี้มีการอ้างอิงอยู่' });
    }
    return res.status(500).json({ error: 'ไม่สามารถลบธนาคารได้' });
  }
};

module.exports = { deleteBank };
