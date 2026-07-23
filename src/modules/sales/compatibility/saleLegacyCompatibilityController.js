// src/controllers/saleController.js
// 🏛️ Clean Architecture Routing: Unified Premium Integration (Safe Emergency Rollback Edition)

const { prisma, Prisma } = require('../../../lib/prisma');
const dayjs = require('dayjs');
const { SALE_DOCUMENT_INCLUDE } = require('../documents/contracts/saleDocumentContract');
const { updateSaleDocumentLines } = require('../documents/services/saleDocumentService');
const { projectSalePaymentStatus } = require('../completion/services/salePaymentPostingService');

// --- Feature Flags (Backward-Compatible) ---
const ENABLE_PAYMENT_AUTOCREATE = process.env.ENABLE_PAYMENT_AUTOCREATE === '1'; // สร้าง Payment อัตโนมัติเมื่อขายสด
const NORMALIZE_DECIMAL_TO_NUMBER = process.env.NORMALIZE_DECIMAL_TO_NUMBER !== '0'; // ส่งเลขเป็น number ให้ FE เดิม (ค่าเริ่มต้น: เปิด)
const SALE_CODE_MAX_RETRY = Number(process.env.SALE_CODE_MAX_RETRY || 3);
const CREDIT_SALE_STATUS = process.env.CREDIT_SALE_STATUS || 'DRAFT'; // กรณีเครดิต: DRAFT/DELIVERED/FINALIZED
const STRICT_COMPLETED_REQUIRES_PAYMENT = process.env.STRICT_COMPLETED_REQUIRES_PAYMENT === '1'; // ถ้าเปิด: COMPLETED ได้ก็ต่อเมื่อมี Payment จริง

// --- Helpers ---
const D = (v) => new Prisma.Decimal(typeof v === 'string' ? v : Number(v));
const toNum = (v) => (v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v));
const isMoneyLike = (v) => (typeof v === 'number' && !isNaN(v)) || (typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v));

// rounding helper (2 decimals) for list/print consistency
const round2 = (n) => Number((Number(n || 0)).toFixed(2));

const toLocalRange = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;

  const start = new Date(d);
  start.setHours(0, 0, 0, 0);

  const end = new Date(d);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// canonical total resolver (minimal-disruption)
const resolveCanonicalTotalAmount = (sale) => {
  const stored = round2(sale?.totalAmount != null ? toNum(sale.totalAmount) : 0);
  return stored;
};

const normalizePayment = (payment) => {
  if (!NORMALIZE_DECIMAL_TO_NUMBER || !payment) return payment;
  const cloned = { ...payment };
  if (Array.isArray(cloned.items)) {
    cloned.items = cloned.items.map((it) => ({
      ...it,
      amount: it?.amount != null ? toNum(it.amount) : it.amount,
    }));
  }
  return cloned;
};

const normalizeSaleMoney = (sale) => {
  if (!NORMALIZE_DECIMAL_TO_NUMBER || !sale) return sale;
  const moneyKeys = ['totalBeforeDiscount', 'totalDiscount', 'vat', 'vatRate', 'totalAmount', 'paidAmount'];
  for (const k of moneyKeys) if (k in sale && sale[k] != null) sale[k] = toNum(sale[k]);
  if (Array.isArray(sale.items)) {
    sale.items = sale.items.map((it) => {
      const cloned = { ...it };
      for (const k of ['basePrice', 'vatAmount', 'price', 'discount', 'refundedAmount'])
        if (k in cloned && cloned[k] != null) cloned[k] = toNum(cloned[k]);
      return cloned;
    });
  }
  if (Array.isArray(sale.simpleItems)) {
    sale.simpleItems = sale.simpleItems.map((it) => {
      const cloned = { ...it };
      for (const k of ['quantity', 'basePrice', 'vatAmount', 'price', 'discount', 'unitCost'])
        if (k in cloned && cloned[k] != null) cloned[k] = toNum(cloned[k]);
      return cloned;
    });
  }
  if (Array.isArray(sale.payments)) {
    sale.payments = sale.payments.map((p) => normalizePayment(p));
  }
  return sale;
};

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

const getAllSales = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const limitRaw = req.query?.limit;
    const limitParsed = parseInt(limitRaw, 10);
    const take = Math.min(Math.max(Number.isFinite(limitParsed) ? limitParsed : 200, 1), 500);

    const where = { branchId };

    const computeTotals = (sale) => {
      const vatRate = Number.isFinite(Number(sale?.vatRate)) ? Number(sale.vatRate) : 7;
      const totalAmount = resolveCanonicalTotalAmount(sale);
      const vatStored = sale?.vat != null ? round2(toNum(sale.vat)) : null;
      const vatAmount = vatStored != null ? vatStored : round2((totalAmount * vatRate) / (100 + vatRate));

      const beforeVat = round2(totalAmount - vatAmount);
      const totalBeforeDiscount = round2(sale?.totalBeforeDiscount != null ? toNum(sale.totalBeforeDiscount) : 0);
      const totalDiscount = round2(sale?.totalDiscount != null ? toNum(sale.totalDiscount) : 0);

      return { vatRate, totalBeforeDiscount, totalDiscount, totalAmount: round2(totalAmount), beforeVat, vatAmount };
    };

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: SALE_DOCUMENT_INCLUDE,
    });

    const normalized = NORMALIZE_DECIMAL_TO_NUMBER ? sales.map((s) => normalizeSaleMoney(s)) : sales;

    const out = normalized.map((s) => {
      const totals = computeTotals(s);
      return {
        ...s,
        vatRate: totals.vatRate,
        totalAmount: totals.totalAmount,
        totals: {
          ...(s?.totals || {}),
          totalBeforeDiscount: totals.totalBeforeDiscount,
          totalDiscount: totals.totalDiscount,
          beforeVat: totals.beforeVat,
          vatAmount: totals.vatAmount,
          total: totals.totalAmount,
        },
      };
    });

    return res.json(out);
  } catch (error) {
    console.error('❌ [getAllSales] Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงรายการขายได้' });
  }
};

const getSaleById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid sale ID' });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: SALE_DOCUMENT_INCLUDE,
    });

    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (Number(sale.branchId) !== Number(req.user?.branchId)) {
      return res.status(404).json({ error: 'ไม่พบรายการขายนี้ในสาขาของคุณ' });
    }

    const includePayments = String(req.query?.includePayments ?? '1') !== '0';
    const requestedPaymentId = req.query?.paymentId != null ? String(req.query.paymentId) : '';

    let payments = [];
    if (includePayments) {
      payments = await prisma.payment.findMany({
        where: { saleId: id },
        include: { items: true },
        orderBy: { receivedAt: 'asc' },
      });

      if (requestedPaymentId && Array.isArray(payments) && payments.length > 1) {
        payments = payments.slice().sort((a, b) => {
          const ax = String(a?.id) === requestedPaymentId ? -1 : 0;
          const bx = String(b?.id) === requestedPaymentId ? -1 : 0;
          return ax - bx;
        });
      }
    }

    const normalized = normalizeSaleMoney({ ...sale, payments });

    const totalAmount = resolveCanonicalTotalAmount(sale);
    const vatRate = round2(sale?.vatRate != null ? toNum(sale.vatRate) : 7);
    const vatStored = sale?.vat != null ? round2(toNum(sale.vat)) : null;
    const vatAmount = vatStored != null ? vatStored : round2((totalAmount * vatRate) / (100 + vatRate));
    const beforeVat = round2(totalAmount - vatAmount);
    const totalBeforeDiscount = round2(sale?.totalBeforeDiscount != null ? toNum(sale.totalBeforeDiscount) : 0);
    const totalDiscount = round2(sale?.totalDiscount != null ? toNum(sale.totalDiscount) : 0);

    const receivedAmountRaw = Array.isArray(payments)
      ? payments.reduce((sum, payment) => {
          if (payment?.isCancelled) return sum;
          const itemSum = Array.isArray(payment?.items)
            ? payment.items.reduce((itemAcc, item) => itemAcc + Number(item?.amount || 0), 0)
            : 0;
          return sum + itemSum;
        }, 0)
      : 0;

    const receivedAmount = round2(receivedAmountRaw);
    const balanceAmount = round2(Math.max(0, totalAmount - receivedAmount));
    const changeAmount = round2(Math.max(0, receivedAmount - totalAmount));

    const response = {
      ...normalized,
      totals: { totalBeforeDiscount, totalDiscount, beforeVat, vatAmount, totalAmount: round2(totalAmount), vatRate },
      paymentSummary: {
        totalAmount: round2(totalAmount),
        receivedAmount,
        balanceAmount,
        changeAmount,
        hasPayment: receivedAmount > 0,
        isFullyPaid: receivedAmount >= round2(totalAmount),
        isPartiallyPaid: receivedAmount > 0 && receivedAmount < round2(totalAmount),
      },
    };

    return res.json(response);
  } catch (error) {
    console.error('❌ [getSaleById] error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getSalesByBranchId = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    if (!branchId) return res.status(400).json({ error: 'branchId ไม่ถูกต้อง' });

    const sales = await prisma.sale.findMany({
      where: { branchId: Number(branchId) },
      orderBy: { soldAt: 'desc' },
      include: SALE_DOCUMENT_INCLUDE,
    });

    const mapped = sales.map((sale) => ({
      id: sale.id,
      code: sale.code,
      totalAmount: NORMALIZE_DECIMAL_TO_NUMBER ? toNum(sale.totalAmount) : sale.totalAmount,
      createdAt: sale.createdAt,
      customerName: sale.customer?.name || sale.customer?.companyName || '-',
      customerPhone: sale.customer?.user?.loginId || '-',
    }));

    return res.json(mapped);
  } catch (error) {
    console.error('❌ [getSalesByBranchId] Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลใบเสร็จย้อนหลัง' });
  }
};

const markSaleAsPaid = async (req, res) => {
  const saleId = parseInt(req.params.id, 10);
  const branchId = Number(req.user?.branchId);

  if (!saleId || Number.isNaN(saleId)) return res.status(400).json({ message: 'Sale ID ไม่ถูกต้อง' });
  if (!branchId || Number.isNaN(branchId)) return res.status(401).json({ message: 'unauthorized' });

  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale || Number(sale.branchId) !== branchId) {
      return res.status(404).json({ message: 'ไม่พบรายการขายนี้ในสาขาของคุณ' });
    }

    const canonicalTotalAmount = resolveCanonicalTotalAmount(sale);
    const canonicalTotalDecimal = D(canonicalTotalAmount);

    const agg = await prisma.paymentItem.aggregate({
      _sum: { amount: true },
      where: { payment: { saleId, isCancelled: false } },
    });

    const paidSum = agg._sum.amount || new Prisma.Decimal(0);

    const isFullyPaid =
      typeof paidSum?.greaterThanOrEqualTo === 'function'
        ? paidSum.greaterThanOrEqualTo(canonicalTotalDecimal)
        : toNum(paidSum) >= canonicalTotalAmount;

    if (sale.paid && isFullyPaid) {
      return res.status(200).json({ success: true });
    }

    if (!isFullyPaid) {
      return res.status(409).json({
        message: 'ยอดชำระยังไม่ครบ ไม่สามารถปิดบิลได้',
        detail: {
          totalAmount: canonicalTotalAmount,
          paidAmount: round2(toNum(paidSum)),
          balanceAmount: round2(Math.max(0, canonicalTotalAmount - toNum(paidSum))),
        },
      });
    }

    await prisma.$transaction(async (tx) => {
      const projection = await projectSalePaymentStatus(tx, saleId);
      if (!projection.paid) {
        throw Object.assign(new Error('Payment evidence is insufficient'), {
          status: 409,
          code: 'PAYMENT_EVIDENCE_INSUFFICIENT',
        });
      }
      await tx.sale.update({
        where: { id: saleId },
        data: {
          soldAt: sale.soldAt || new Date(),
          status: 'COMPLETED',
        },
      });

      const stockItemIds = (sale.items || []).map((it) => it.stockItemId).filter(Boolean);
      if (stockItemIds.length > 0) {
        await tx.stockItem.updateMany({
          where: { id: { in: stockItemIds }, status: { not: 'SOLD' } },
          data: { status: 'SOLD', soldAt: new Date() },
        });
      }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ [markSaleAsPaid]', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะปิดบิล' });
  }
};

const searchPrintableSales = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const { keyword = '', fromDate, toDate, limit: limitRaw, onlyUnpaid, onlyPaid } = req.query;
    const onlyUnpaidBool = ['1', 'true', 'yes', 'y'].includes(String(onlyUnpaid ?? '').toLowerCase());
    const onlyPaidBool = ['1', 'true', 'yes', 'y'].includes(String(onlyPaid ?? '').toLowerCase());
    const bothFlags = onlyPaidBool && onlyUnpaidBool;

    const limitParsed = parseInt(limitRaw, 10);
    const take = Math.min(Math.max(Number.isFinite(limitParsed) ? limitParsed : 100, 1), 500);

    const fromRange = fromDate ? toLocalRange(String(fromDate)) : null;
    const toRange = toDate ? toLocalRange(String(toDate)) : null;

    const where = {
      branchId,
      status: { not: 'CANCELLED' },
      ...(keyword
        ? {
            OR: [
              { code: { contains: String(keyword), mode: 'insensitive' } },
              { note: { contains: String(keyword), mode: 'insensitive' } },
              { customer: { is: { name: { contains: String(keyword), mode: 'insensitive' } } } },
              { customer: { is: { companyName: { contains: String(keyword), mode: 'insensitive' } } } },            
            ],
          }
        : {}),
      ...(fromRange || toRange
        ? {
            createdAt: {
              ...(fromRange ? { gte: fromRange.start } : {}),
              ...(toRange ? { lte: toRange.end } : {}),
            },
          }
        : {}),
    };

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: SALE_DOCUMENT_INCLUDE,
    });

    const saleIds = sales.map((s) => s.id);

    const payments = saleIds.length
      ? await prisma.payment.findMany({
          where: { saleId: { in: saleIds }, isCancelled: false },
          orderBy: { receivedAt: 'desc' },
          select: { saleId: true, receivedAt: true, items: { select: { amount: true } } },
        })
      : [];

    const paymentAgg = new Map();
    for (const p of payments) {
      const sid = p.saleId;
      const prev = paymentAgg.get(sid) || { paidAmount: 0, lastPaidAt: null };
      const itemSum = (Array.isArray(p.items) ? p.items : []).reduce((ss, it) => {
        const amt = it?.amount != null ? toNum(it.amount) : 0;
        return ss + amt;
      }, 0);

      const nextPaid = prev.paidAmount + itemSum;
      const nextLast = !prev.lastPaidAt
        ? p.receivedAt || null
        : p.receivedAt && new Date(p.receivedAt) > new Date(prev.lastPaidAt) ? p.receivedAt : prev.lastPaidAt;

      paymentAgg.set(sid, { paidAmount: nextPaid, lastPaidAt: nextLast });
    }

    const rowsAll = sales.map((s) => {
      const totalAmount = resolveCanonicalTotalAmount(s);
      const storedPaidAmount = s?.paidAmount != null ? toNum(s.paidAmount) : null;
      const agg = paymentAgg.get(s.id) || { paidAmount: 0, lastPaidAt: null };
      const aggPaid = agg.paidAmount || 0;
      const paidAmount = storedPaidAmount == null ? aggPaid : Math.max(storedPaidAmount, aggPaid);
      const balanceAmount = Math.max(0, round2(totalAmount - paidAmount));
      const paidEnough = totalAmount > 0 ? paidAmount >= totalAmount : false;
      const lastPaidAt = (storedPaidAmount != null ? null : agg.lastPaidAt) || null;

      return {
        id: s.id,
        code: s.code,
        createdAt: s.createdAt,
        soldAt: s.soldAt || null, 
        totalAmount: round2(totalAmount),
        paidAmount: Number(paidAmount.toFixed(2)),
        balanceAmount,
        paid: !!(s.paid || paidEnough),
        hasPayment: paidAmount > 0,
        isFullyPaid: paidEnough,
        isPartiallyPaid: paidAmount > 0 && paidAmount < totalAmount,
        lastPaidAt,
        customerName: s.customer?.name || '-',
        companyName: s.customer?.companyName || '-',
        customerPhone: s.customer?.user?.loginId || '-',
        employeeName: s.employee?.name || '-',
        status: s.status,
        isCredit: !!s.isCredit,
      };
    });

    let rows = rowsAll;
    if (bothFlags) {
      rows = rows.filter((r) => (r?.paidAmount ?? 0) > 0 && (r?.balanceAmount ?? 0) > 0);
    } else {
      if (onlyUnpaidBool) rows = rows.filter((r) => (r?.balanceAmount ?? 0) > 0);
      if (onlyPaidBool) rows = rows.filter((r) => !!r?.isFullyPaid);
    }

    return res.json(rows);
  } catch (error) {
    console.error('❌ [searchPrintableSales] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดข้อมูลใบขายย้อนหลังได้' });
  }
};

const updateSaleDocumentLinesController = async (req, res) => {
  try {
    const saleId = Number(req.params.id ?? req.params.saleId);
    const branchId = Number(req.user?.branchId);

    const result = await updateSaleDocumentLines({
      prisma,
      saleId,
      branchId,
      items: req.body?.items,
      simpleItems: req.body?.simpleItems,
    });

    return res.json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('❌ [updateSaleDocumentLines] error:', error);
    return res.status(status).json({ error: error?.message || 'ไม่สามารถบันทึกข้อความก่อน/หลังสินค้าได้' });
  }
};

const updateSaleDocumentDescriptionsController = updateSaleDocumentLinesController;
const getAllSalesReturn = getAllSales;

module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  getSalesByBranchId,
  markSaleAsPaid,
  getAllSalesReturn,
  searchPrintableSales,
  updateSaleDocumentLinesController,
  updateSaleDocumentDescriptionsController,
};
