const { prisma } = require('../../../../../../lib/prisma');
const { requireBranchId } = require('../../shared/bankContext');

const getAllBanks = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const q = String(req.query?.q || '').trim();
    const includeInactive = String(req.query?.includeInactive || '0') === '1';

    const banks = await prisma.bank.findMany({
      where: {
        branchId,
        ...(includeInactive ? {} : { active: true }),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    return res.json(banks);
  } catch (err) {
    console.error('[getAllBanks] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายชื่อธนาคารได้' });
  }
};

module.exports = { getAllBanks };
