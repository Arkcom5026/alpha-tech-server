// ✅ controllers/bankController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllBanks = async (req, res) => {
  try {
    const banks = await prisma.bank.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    res.json(banks);
  } catch (err) {
    console.error('❌ ไม่สามารถโหลดธนาคาร:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดรายชื่อธนาคารได้' });
  }
};

module.exports = {
  getAllBanks,
};
