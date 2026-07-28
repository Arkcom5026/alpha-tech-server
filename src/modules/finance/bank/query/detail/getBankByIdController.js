const { prisma } = require('../../../../../../lib/prisma');
const { requireBranchId, toPositiveInt } = require('../../shared/bankContext');

const getBankById = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toPositiveInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const bank = await prisma.bank.findFirst({ where: { id, branchId } });

    if (!bank) return res.status(404).json({ message: 'ไม่พบธนาคาร' });
    return res.json(bank);
  } catch (err) {
    console.error('[getBankById] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลธนาคารได้' });
  }
};

module.exports = { getBankById };
