// ✅ API: รับสินค้าเข้า PO (Receive PO)
// 📁 ตำแหน่งไฟล์: /server/controllers/purchase.controller.js

const prisma = require('../lib/prisma');


exports.receivePO = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, items } = req.body;

    if (!items?.length) {
      return res.status(400).json({ error: 'No items to receive' });
    }

    const receipt = await prisma.pOReceipt.create({
      data: {
        poId: parseInt(id),
        note,
        items: {
          create: items.map((item) => ({
            poItemId: item.poItemId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    res.status(201).json({ message: 'PO Received', receipt });
  } catch (err) {
    console.error('❌ receivePO error:', err);
    res.status(500).json({ error: 'Failed to receive PO' });
  }
};