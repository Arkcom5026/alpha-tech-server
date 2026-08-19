const { prisma } = require('../../../../../lib/prisma');
const {
  toInt,
  projectSaleReturnDetail,
} = require('../../shared/saleReturnProjection');
const {
  freezeRefundReceiptPresentation,
  serializeRefundReceiptPresentationSnapshots,
} = require('../../presentation/refundReceiptPresentationSnapshot');

const getSaleReturnById = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    const branchId = toInt(req.user?.branchId);

    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const saleReturn = await prisma.saleReturn.findFirst({
      where: { id, branchId },
      include: {
        sale: { include: { customer: true } },
        items: {
          include: {
            saleItem: {
              include: {
                stockItem: { include: { product: true } },
              },
            },
          },
        },
        refundTransaction: true,
      },
    });

    if (!saleReturn) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลใบคืนสินค้า' });
    }

    const presentationSnapshots = await freezeRefundReceiptPresentation({
      tx: prisma,
      saleReturn,
    });
    return res.status(200).json({
      ...projectSaleReturnDetail(saleReturn),
      presentationSnapshots: serializeRefundReceiptPresentationSnapshots(presentationSnapshots),
    });
  } catch (error) {
    console.error('❌ [getSaleReturnById] error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลใบคืนสินค้า' });
  }
};

module.exports = {
  getSaleReturnById,
};
