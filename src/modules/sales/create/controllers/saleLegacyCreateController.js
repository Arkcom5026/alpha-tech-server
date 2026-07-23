const { prisma, Prisma } = require('../../../../../lib/prisma');
const dayjs = require('dayjs');
const { SALE_DOCUMENT_INCLUDE } = require('../../documents/contracts/saleDocumentContract');
const {
  normalizeSaleMoney,
  round2,
} = require('../../shared/saleLegacyProjection');

const ENABLE_PAYMENT_AUTOCREATE = process.env.ENABLE_PAYMENT_AUTOCREATE === '1';
const SALE_CODE_MAX_RETRY = Number(process.env.SALE_CODE_MAX_RETRY || 3);
const CREDIT_SALE_STATUS = process.env.CREDIT_SALE_STATUS || 'DRAFT';
const STRICT_COMPLETED_REQUIRES_PAYMENT =
  process.env.STRICT_COMPLETED_REQUIRES_PAYMENT === '1';

const D = (value) =>
  new Prisma.Decimal(typeof value === 'string' ? value : Number(value));
const isMoneyLike = (value) =>
  (typeof value === 'number' && !Number.isNaN(value)) ||
  (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value));

const generateSaleCode = async (branchId, attempt = 0) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = dayjs();
  const prefix = `SL-${paddedBranch}${now.format('YYMM')}`;

  const count = await prisma.sale.count({
    where: {
      branchId: Number(branchId),
      createdAt: {
        gte: now.startOf('month').toDate(),
        lt: now.endOf('month').toDate(),
      },
    },
  });

  const running = String(count + 1 + attempt).padStart(4, '0');
  return `${prefix}-${running}`;
};

const createSale = async (req, res) => {
  try {
    const {
      customerId,
      totalBeforeDiscount,
      totalDiscount,
      vat,
      vatRate,
      totalAmount,
      note,
      items,
      mode = 'CASH',
      isTaxInvoice: isTaxInvoiceFromClient,
      deliveryNoteMode,
      saleType: saleTypeFromClient,
    } = req.body;

    const branchId = req.user?.branchId;
    const employeeId = req.user?.employeeId;

    if (!branchId || !employeeId) {
      return res.status(401).json({ error: 'ไม่ได้รับข้อมูลสาขาหรือพนักงานที่ถูกต้อง' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ต้องมีรายการสินค้าอย่างน้อยหนึ่งรายการ' });
    }

    if (mode === 'CREDIT' && !customerId) {
      return res.status(400).json({ error: 'การขายแบบเครดิตต้องเลือกชื่อลูกค้าก่อน' });
    }

    const moneyFields = { totalBeforeDiscount, totalDiscount, vat, vatRate, totalAmount };
    for (const [key, value] of Object.entries(moneyFields)) {
      if (!isMoneyLike(value) || (key !== 'totalDiscount' && Number(value) < 0)) {
        return res.status(400).json({ error: `ข้อมูล ${key} ไม่ถูกต้อง หรือเป็นค่าติดลบ` });
      }
    }

    for (const item of items) {
      if (!item.stockItemId || typeof item.stockItemId !== 'number') {
        return res.status(400).json({ error: 'รายการสินค้าต้องมี stockItemId ที่ถูกต้องและเป็นตัวเลข' });
      }

      const itemNumericFields = {
        price: item.price,
        discount: item.discount,
        basePrice: item.basePrice,
        vatAmount: item.vatAmount,
      };

      for (const [key, value] of Object.entries(itemNumericFields)) {
        if (!isMoneyLike(value)) {
          return res.status(400).json({ error: `ข้อมูล ${key} ในรายการสินค้า (stockItemId: ${item.stockItemId}) ไม่ถูกต้อง` });
        }
        if (key !== 'discount' && Number(value) < 0) {
          return res.status(400).json({ error: `ข้อมูล ${key} ในรายการสินค้า (stockItemId: ${item.stockItemId}) ไม่ถูกต้อง หรือเป็นค่าติดลบ` });
        }
      }
    }

    const moneyTolerance = 0.01;

    const clientTotalBeforeDiscount = round2(totalBeforeDiscount);
    const clientTotalDiscount = round2(totalDiscount);
    const clientVatRate = round2(vatRate);
    const clientTotalAmount = round2(totalAmount);
    const clientVat = round2(vat);

    const computedItemsGross = round2(items.reduce((sum, item) => sum + Number(item.price || 0), 0));
    const computedItemDiscount = round2(items.reduce((sum, item) => sum + Number(item.discount || 0), 0));
    const computedBaseBeforeDiscount = round2(items.reduce((sum, item) => sum + Number(item.basePrice || 0), 0));

    const canonicalTotalBeforeDiscount =
      Math.abs(clientTotalBeforeDiscount - computedBaseBeforeDiscount) <= moneyTolerance
        ? clientTotalBeforeDiscount
        : computedBaseBeforeDiscount;

    const canonicalTotalDiscount =
      Math.abs(clientTotalDiscount - computedItemDiscount) <= moneyTolerance
        ? clientTotalDiscount
        : computedItemDiscount;

    const canonicalTotalAmount =
      Math.abs(clientTotalAmount - computedItemsGross) <= moneyTolerance
        ? clientTotalAmount
        : computedItemsGross;

    const effectiveVatRate = clientVatRate > 0 ? clientVatRate : 7;
    const canonicalVat = effectiveVatRate > 0
      ? round2((canonicalTotalAmount * effectiveVatRate) / (100 + effectiveVatRate))
      : 0;

    const derivedTotalAmount = round2(Math.max(0, canonicalTotalBeforeDiscount - canonicalTotalDiscount));
    if (Math.abs(derivedTotalAmount - canonicalTotalAmount) > moneyTolerance) {
      return res.status(400).json({
        error: 'ยอดรวมสุทธิไม่สอดคล้องกับราคาก่อนลดและส่วนลด กรุณาตรวจสอบรายการสินค้าอีกครั้ง',
        detail: { canonicalTotalBeforeDiscount, canonicalTotalDiscount, canonicalTotalAmount, derivedTotalAmount },
      });
    }

    if (Math.abs(clientTotalAmount - canonicalTotalAmount) > moneyTolerance) {
      return res.status(400).json({
        error: 'ยอดรวมสุทธิไม่ถูกต้อง กรุณารีเฟรชแล้วลองใหม่อีกครั้ง',
        detail: { clientTotalAmount, canonicalTotalAmount, canonicalTotalBeforeDiscount, canonicalTotalDiscount },
      });
    }

    if (Math.abs(clientVat - canonicalVat) > moneyTolerance) {
      return res.status(400).json({
        error: 'ข้อมูลภาษีมูลค่าเพิ่มไม่ถูกต้อง กรุณารีเฟรชแล้วลองใหม่อีกครั้ง',
        detail: { clientVat, canonicalVat, canonicalTotalAmount, vatRate: effectiveVatRate },
      });
    }

    if (computedBaseBeforeDiscount > 0 && Math.abs(computedBaseBeforeDiscount - canonicalTotalBeforeDiscount) > moneyTolerance) {
      return res.status(400).json({
        error: 'ข้อมูลราคาสินค้าไม่สอดคล้องกัน กรุณาตรวจสอบรายการสินค้าอีกครั้ง',
        detail: { computedBaseBeforeDiscount, canonicalTotalBeforeDiscount },
      });
    }

    let saleStatus;
    let isCreditSale = false;
    let paidStatus = false;
    let paidAtDate = null;
    let statusPayment = 'UNPAID';
    let paidAmountDecimal = D(0);
    let soldAtDate = new Date();
    let dueDate = null;
    let customerSaleType = 'NORMAL';

    const isTaxInvoiceEffective = mode === 'CREDIT' ? false : !!isTaxInvoiceFromClient;

    if (customerId) {
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { id: customerId },
        select: { paymentTerms: true, type: true },
      });
      if (customerProfile) {
        if (customerProfile.type === 'ORGANIZATION') customerSaleType = 'WHOLESALE';
        else if (customerProfile.type === 'GOVERNMENT') customerSaleType = 'GOVERNMENT';
        if (mode === 'CREDIT' && typeof customerProfile.paymentTerms === 'number' && customerProfile.paymentTerms >= 0) {
          dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + customerProfile.paymentTerms);
        }
      }
    }

    if (mode === 'CREDIT') {
      isCreditSale = true;
      saleStatus = CREDIT_SALE_STATUS;
      paidStatus = false;
      statusPayment = 'UNPAID';
      paidAmountDecimal = D(0);
      soldAtDate = soldAtDate || new Date();
    } else {
      soldAtDate = new Date();
      if (STRICT_COMPLETED_REQUIRES_PAYMENT && !ENABLE_PAYMENT_AUTOCREATE) {
        saleStatus = 'FINALIZED';
        paidStatus = false;
        paidAtDate = null;
        statusPayment = 'UNPAID';
        paidAmountDecimal = D(0);
      } else {
        saleStatus = 'COMPLETED';
        paidStatus = true;
        paidAtDate = new Date();
        statusPayment = 'PAID';
        paidAmountDecimal = D(canonicalTotalAmount);
      }
    }

    const stockItemIds = items.map((i) => i.stockItemId).filter(Boolean);
    const dup = stockItemIds.find((id, i) => stockItemIds.indexOf(id) !== i);
    if (dup) {
      return res.status(400).json({ error: `ห้ามใส่สินค้าชิ้นเดียวกันซ้ำ (stockItemId=${dup})` });
    }

    const stockItems = await prisma.stockItem.findMany({
      where: { id: { in: stockItemIds }, status: 'IN_STOCK' },
      select: { id: true, productId: true },
    });
    if (stockItems.length !== items.length) {
      const availableIds = new Set(stockItems.map((si) => si.id));
      const unavailable = items.filter((it) => !availableIds.has(it.stockItemId)).map((it) => it.stockItemId);
      return res.status(400).json({ error: 'บางรายการไม่พร้อมขาย หรือถูกขายไปแล้ว', unavailableStockItemIds: unavailable });
    }

    const stockIdToProductIdMap = new Map(stockItems.map(si => [si.id, si.productId]));

    let createdSale;
    for (let attempt = 0; attempt <= SALE_CODE_MAX_RETRY; attempt++) {
      const code = await generateSaleCode(branchId, attempt);
      try {
        createdSale = await prisma.$transaction(async (tx) => {
          const sale = await tx.sale.create({
            data: {
              code,
              status: saleStatus,
              soldAt: soldAtDate,
              isCredit: isCreditSale,
              paid: paidStatus,
              paidAt: paidAtDate,
              dueDate,
              customer: customerId ? { connect: { id: customerId } } : undefined,
              employee: { connect: { id: employeeId } },
              branch: { connect: { id: branchId } },
              totalBeforeDiscount: D(canonicalTotalBeforeDiscount),
              totalDiscount: D(canonicalTotalDiscount),
              vat: D(canonicalVat),
              vatRate: D(effectiveVatRate),
              totalAmount: D(canonicalTotalAmount),
              statusPayment,
              paidAmount: paidAmountDecimal,
              note,
              saleType: saleTypeFromClient || customerSaleType,
              isTaxInvoice: isTaxInvoiceEffective,
              officialDocumentNumber:
                isCreditSale && String(deliveryNoteMode || 'PRINT') === 'PRINT' ? `DN-${code}` : null,
              items: {
                create: items.map((item) => ({
                  stockItemId: item.stockItemId,
                  basePrice: D(item.basePrice),
                  vatAmount: D(item.vatAmount),
                  price: D(item.price),
                  discount: D(item.discount),
                  remark: item.remark,
                  documentPrefix: item.documentPrefix ?? null,
                  documentDescription: item.documentDescription ?? null,
                  documentSuffix: item.documentSuffix ?? null,
                })),
              },
            },
          });

          const upd = await tx.stockItem.updateMany({
            where: { id: { in: stockItemIds }, status: 'IN_STOCK' },
            data: { status: 'SOLD', soldAt: new Date() },
          });

          if (upd.count !== stockItemIds.length) {
            throw Object.assign(new Error('Some items already sold.'), { status: 409, code: 'STOCK_CONFLICT' });
          }

          // 🟢 FIXED: ถอด stockItemId ออกเพื่อให้ตรงตามมาตรฐานฟิลด์ของโมเดล StockMovement ใน schema.prisma เป๊ะๆ
          const movementData = stockItemIds.map((stockId) => {
            const pId = stockIdToProductIdMap.get(stockId);
            return {
              productId: pId,
              branchId: Number(branchId),
              type: 'SALE',
              qty: -1,
              note: `ขายสินค้าหน้าร้านอัตโนมัติผ่านเลขบิลเอกสาร ${code}`,
            };
          });

          await tx.stockMovement.createMany({
            data: movementData,
          });

          if (ENABLE_PAYMENT_AUTOCREATE && !isCreditSale) {
            await tx.payment.create({
              data: {
                code: `PM-${sale.code}`,
                saleId: sale.id,
                branchId,
                employeeProfileId: employeeId,
                receivedAt: new Date(),
                items: { create: [{ paymentMethod: 'CASH', amount: D(canonicalTotalAmount) }] },
              },
              include: { items: true },
            });
          }

          return sale;
        });
        break;
      } catch (err) {
        if (err?.code === 'P2002' && /code/.test(String(err?.meta?.target))) {
          if (attempt < SALE_CODE_MAX_RETRY) continue;
        }
        throw err;
      }
    }

    if (!createdSale?.id) {
      return res.status(500).json({ error: 'ไม่สามารถสร้างรายการขายได้' });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: createdSale.id },
      include: SALE_DOCUMENT_INCLUDE,
    });

    const payments = await prisma.payment.findMany({
      where: { saleId: sale.id },
      include: { items: true },
      orderBy: { receivedAt: 'asc' },
    });

    const response = normalizeSaleMoney({ ...sale, payments, stockItemIds });
    return res.status(201).json(response);
  } catch (error) {
    console.error('❌ [createSale] Error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'ข้อมูลซ้ำซ้อน เช่น หมายเลขใบขายถูกใช้ไปแล้ว' });
    }
    return res.status(500).json({ error: 'ไม่สามารถสร้างการขายได้ เนื่องจากเกิดข้อผิดพลาดภายในระบบ' });
  }
};

module.exports = { createSale };
