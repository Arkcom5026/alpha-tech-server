



 

// saleController.js

const { prisma, Prisma } = require('../lib/prisma');
const dayjs = require('dayjs');

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
  const moneyKeys = ['totalBeforeDiscount','totalDiscount','vat','vatRate','totalAmount'];
  for (const k of moneyKeys) if (k in sale && sale[k] != null) sale[k] = toNum(sale[k]);
  if (Array.isArray(sale.items)) {
    sale.items = sale.items.map((it) => {
      const cloned = { ...it };
      for (const k of ['basePrice','vatAmount','price','discount','refundedAmount'])
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
      items, // [{ stockItemId, price, discount, basePrice, vatAmount, remark }]
      mode = 'CASH',

      // ✅ Backward-compatible extra fields (FE may send or omit)
      // - Credit sale: tax invoice must be false (sale-time)
      isTaxInvoice: isTaxInvoiceFromClient,
      // - Credit + หน่วยงาน: PRINT (default) | NO_PRINT
      deliveryNoteMode,
      // - Optional override; still validated by customer type below
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

    // ✅ Guardrail: เครดิตต้องมีลูกค้า (debtor) เสมอ
    if (mode === 'CREDIT' && !customerId) {
      return res.status(400).json({ error: 'การขายแบบเครดิตต้องเลือกชื่อลูกค้าก่อน' });
    }

    // Validate money fields (accept number or string)
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
      const itemNumericFields = { price: item.price, discount: item.discount, basePrice: item.basePrice, vatAmount: item.vatAmount };
      for (const [key, value] of Object.entries(itemNumericFields)) {
        if (!isMoneyLike(value) || Number(value) < 0) {
          return res.status(400).json({ error: `ข้อมูล ${key} ในรายการสินค้า (stockItemId: ${item.stockItemId}) ไม่ถูกต้อง หรือเป็นค่าติดลบ` });
        }
      }
    }

    // Determine sale meta
    let saleStatus;
    let isCreditSale = false;
    let paidStatus = false;
    let paidAtDate = null;
    let soldAtDate = new Date();
    let dueDate = null;
    let customerSaleType = 'NORMAL';

    // ✅ tax invoice policy (sale-time): credit sale cannot issue tax invoice
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
      saleStatus = CREDIT_SALE_STATUS; // Backward-compatible default: DRAFT
      paidStatus = false;
      // ✅ Prisma schema requires soldAt (non-null). For credit sales, use creation time as soldAt.
      soldAtDate = soldAtDate || new Date();
    } else {
      // ขายสด: ถือว่ามีการขายเกิดขึ้นแล้ว → เซ็ต soldAt เสมอ (ช่วย sorting/printing)
      soldAtDate = new Date();

      if (STRICT_COMPLETED_REQUIRES_PAYMENT && !ENABLE_PAYMENT_AUTOCREATE) {
        // ยังไม่สร้าง Payment อัตโนมัติ → ยังไม่ควร mark เป็น COMPLETED
        saleStatus = 'FINALIZED';
        paidStatus = false;
        paidAtDate = null;
      } else {
        saleStatus = 'COMPLETED';
        paidStatus = true;
        paidAtDate = new Date();
      }
    }

    const stockItemIds = items.map((i) => i.stockItemId).filter(Boolean);
    // Prevent duplicate stock items in the same sale
    const dup = stockItemIds.find((id, i) => stockItemIds.indexOf(id) !== i);
    if (dup) {
      return res.status(400).json({ error: `ห้ามใส่สินค้าชิ้นเดียวกันซ้ำ (stockItemId=${dup})` });
    }

    const stockItems = await prisma.stockItem.findMany({
      where: { id: { in: stockItemIds }, status: 'IN_STOCK' },
      select: { id: true },
    });
    if (stockItems.length !== items.length) {
      const availableIds = new Set(stockItems.map((si) => si.id));
      const unavailable = items.filter((it) => !availableIds.has(it.stockItemId)).map((it) => it.stockItemId);
      return res.status(400).json({ error: 'บางรายการไม่พร้อมขาย หรือถูกขายไปแล้ว', unavailableStockItemIds: unavailable });
    }

    // Try create with retry on unique collision (code)
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
              // ✅ Prisma CreateInput: use relation connect (customerId scalar is not accepted here)
              customer: customerId ? { connect: { id: customerId } } : undefined,
              // ✅ Prisma relation required: connect employee profile (instead of raw employeeId)
              employee: { connect: { id: employeeId } },
              // ✅ Prisma relation required: connect branch (instead of raw branchId)
              branch: { connect: { id: branchId } },
              totalBeforeDiscount: D(totalBeforeDiscount),
              totalDiscount: D(totalDiscount),
              vat: D(vat),
              vatRate: D(vatRate),
              totalAmount: D(totalAmount),
              note,
              // ✅ allow client to suggest saleType (still bounded by derived customerSaleType)
              saleType: saleTypeFromClient || customerSaleType,

              // ✅ Credit sale-time: never issue tax invoice
              isTaxInvoice: isTaxInvoiceEffective,

              // ✅ CREDIT + หน่วยงาน: เอกสารได้แค่ ใบส่งของ หรือไม่พิมพ์
              // - PRINT (default) -> DN-<sale.code>
              // - NO_PRINT -> null
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

          if (ENABLE_PAYMENT_AUTOCREATE && !isCreditSale) {
            await tx.payment.create({
              data: {
                code: `PM-${sale.code}`,
                saleId: sale.id,
                branchId,
                employeeProfileId: employeeId,
                receivedAt: new Date(),
                items: { create: [{ paymentMethod: 'CASH', amount: D(totalAmount) }] },
              },
              include: { items: true },
            });
          }

          return sale;
        });
        break; // success
      } catch (err) {
        if (err?.code === 'P2002' && /code/.test(String(err?.meta?.target))) {
          if (attempt < SALE_CODE_MAX_RETRY) continue; // retry with next running
        }
        throw err; // unknown error or max retry reached
      }
    }

    const sale = await prisma.sale.findUnique({
      where: { id: createdSale.id },
      include: {
        branch: true,
        customer: true,
        employee: true,
        items: { include: { stockItem: { include: { product: true } } } },
      },
    });

    // Fetch payments separately to avoid include name differences across schemas
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

    const sales = await prisma.sale.findMany({
      where: {
        branchId,
        status: { not: 'CANCELLED' },
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        customer: true,
        employee: true,
      },
    });

    const normalized = NORMALIZE_DECIMAL_TO_NUMBER ? sales.map((s) => normalizeSaleMoney(s)) : sales;
    return res.json(normalized);
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
      include: {
        branch: true,
        customer: true,
        employee: true,
        items: { include: { stockItem: { include: { product: true } } } },
      },
    });

    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (Number(sale.branchId) !== Number(req.user?.branchId)) {
      return res.status(404).json({ error: 'ไม่พบรายการขายนี้ในสาขาของคุณ' });
    }

    // ✅ NEW: query flags (backward-compatible)
    const includePayments = String(req.query?.includePayments ?? '1') !== '0';
    const requestedPaymentId = req.query?.paymentId != null ? String(req.query.paymentId) : '';

    let payments = [];
    if (includePayments) {
      payments = await prisma.payment.findMany({
        where: { saleId: id },
        include: { items: true },
        orderBy: { receivedAt: 'asc' },
      });

      // ✅ optional: move requested payment to front (no shape change)
      if (requestedPaymentId && Array.isArray(payments) && payments.length > 1) {
        payments = payments.slice().sort((a, b) => {
          const ax = String(a?.id) === requestedPaymentId ? -1 : 0;
          const bx = String(b?.id) === requestedPaymentId ? -1 : 0;
          return ax - bx;
        });
      }
    }

    const response = normalizeSaleMoney({ ...sale, payments });
    return res.json(response);
  } catch (error) {
    console.error('❌ [getSaleById] error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getSalesByBranchId = async (req, res) => {
  try {
    const branchId = req.user?.branchId;

    if (!branchId) {
      return res.status(400).json({ error: 'branchId ไม่ถูกต้อง' });
    }

    const sales = await prisma.sale.findMany({
      where: { branchId: Number(branchId) },
      orderBy: { soldAt: 'desc' },
      include: {
        customer: true,
      },
    });

    const mapped = sales.map((sale) => ({
      id: sale.id,
      code: sale.code,
      totalAmount: NORMALIZE_DECIMAL_TO_NUMBER ? toNum(sale.totalAmount) : sale.totalAmount,
      createdAt: sale.createdAt,
      customerName: sale.customer?.name || '-',
      customerPhone: sale.customer?.phone || '-',
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

  if (!saleId || Number.isNaN(saleId)) {
    return res.status(400).json({ message: 'Sale ID ไม่ถูกต้อง' });
  }
  if (!branchId || Number.isNaN(branchId)) {
    return res.status(401).json({ message: 'unauthorized' });
  }

  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale || Number(sale.branchId) !== branchId) {
      return res.status(404).json({ message: 'ไม่พบรายการขายนี้ในสาขาของคุณ' });
    }

    // รวมยอดชำระจาก PaymentItem (ไม่รวมที่ถูกยกเลิก)
    const agg = await prisma.paymentItem.aggregate({
      _sum: { amount: true },
      where: { payment: { saleId, isCancelled: false } },
    });

    const paidSum = agg._sum.amount || new Prisma.Decimal(0);

    const isFullyPaid =
      typeof paidSum?.greaterThanOrEqualTo === 'function'
        ? paidSum.greaterThanOrEqualTo(sale.totalAmount)
        : toNum(paidSum) >= toNum(sale.totalAmount);

    // ✅ idempotent: ถ้าปิดบิลแล้ว และยอดครบแล้ว ให้ตอบ ok
    if (sale.paid && isFullyPaid) {
      return res.status(200).json({ success: true });
    }

    if (!isFullyPaid) {
      return res.status(409).json({ message: 'ยอดชำระยังไม่ครบ ไม่สามารถปิดบิลได้' });
    }

    // ✅ เมื่อรับเงินครบ: mark paid + finalize status
    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: {
          paid: true,
          paidAt: new Date(),
          // ✅ credit sale อาจยังไม่มี soldAt (ตั้งไว้ตอนรับเงินครบ)
          soldAt: sale.soldAt || new Date(),
          // ✅ ปิดงานให้ชัดเจน
          status: 'COMPLETED',
          // ❗ ไม่แตะ isTaxInvoice ที่นี่ (กติกาคุณคือออกใบกำกับภายหลังเป็น feature แยก)
        },
      });

      // ✅ minimal-disruption: สินค้าควรถูก mark SOLD ตั้งแต่ createSale แล้ว
      // แต่กัน edge case: ถ้ายังมีชิ้นไหนหลุดเป็น IN_STOCK ให้ปิดให้เรียบร้อย
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

// --- Helpers (date range; TH timezone default) ---
const toLocalRange = (dateStr, tz = '+07:00') => {
  if (!dateStr) return null;
  const start = new Date(`${dateStr}T00:00:00.000${tz}`);
  const end = new Date(`${dateStr}T23:59:59.999${tz}`);
  return { start, end };
};




// ✅ Printable Sales (ย้อนหลัง) = “เห็นใบขายทั้งหมด”
// - ใช้ช่วงวันที่จาก sale.createdAt (ไม่ใช่ receivedAt / soldAt)
// - สรุปยอดชำระจาก PaymentItem ของ Payment ที่ isCancelled=false
// - ส่ง payload สำหรับ list (เบา + ชัด)
const searchPrintableSales = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const { keyword = '', fromDate, toDate, limit: limitRaw, onlyUnpaid, onlyPaid } = req.query;

    // ✅ optional filter: only unpaid (Delivery Note list)
    const onlyUnpaidBool = ['1', 'true', 'yes', 'y'].includes(String(onlyUnpaid ?? '').toLowerCase());

    // ✅ optional filter: only paid (PrintBill list)
    // "paid" here means: has at least 1 non-cancelled payment item (paidAmount > 0)
    const onlyPaidBool = ['1', 'true', 'yes', 'y'].includes(String(onlyPaid ?? '').toLowerCase());

    // 🔒 Guard: if both flags are sent, prefer deterministic intersection behavior
    // (paidAmount > 0 AND balanceAmount > 0)
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
              { customer: { is: { phone: { contains: String(keyword), mode: 'insensitive' } } } },
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
      include: {
        customer: true,
        employee: true,
      },
    });

    // Fetch payments separately (schema-safe: Sale model may not expose `payments` relation)
    const saleIds = sales.map((s) => s.id);

    const payments = saleIds.length
      ? await prisma.payment.findMany({
          where: {
            saleId: { in: saleIds },
            isCancelled: false,
          },
          orderBy: { receivedAt: 'desc' },
          select: {
            saleId: true,
            receivedAt: true,
            items: { select: { amount: true } },
          },
        })
      : [];

    // Build { saleId -> { paidAmount, lastPaidAt } }
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
        : p.receivedAt && new Date(p.receivedAt) > new Date(prev.lastPaidAt)
          ? p.receivedAt
          : prev.lastPaidAt;

      paymentAgg.set(sid, { paidAmount: nextPaid, lastPaidAt: nextLast });
    }

    const rowsAll = sales.map((s) => {
      const totalAmount = s.totalAmount != null ? toNum(s.totalAmount) : 0;

      const agg = paymentAgg.get(s.id) || { paidAmount: 0, lastPaidAt: null };
      const paidAmount = agg.paidAmount || 0;

      const balanceAmount = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));
      const paidEnough = totalAmount > 0 ? paidAmount >= totalAmount : false;

      const lastPaidAt = agg.lastPaidAt || null;

      return {
        id: s.id,
        code: s.code,
        createdAt: s.createdAt,
        soldAt: s.soldAt || null, // เผื่อใช้แสดง/ตรวจสอบ แต่ไม่ใช้เป็น filter
        totalAmount: Number(totalAmount.toFixed(2)),
        paidAmount: Number(paidAmount.toFixed(2)),
        balanceAmount,
                // legacy flag (kept for backward compatibility)
        paid: !!(s.paid || paidEnough),

        // ✅ explicit semantic flags (production clarity)
        hasPayment: paidAmount > 0,
        isFullyPaid: paidEnough,
        isPartiallyPaid: paidAmount > 0 && paidAmount < totalAmount,
        lastPaidAt,
        customerName: s.customer?.name || '-',
        companyName: s.customer?.companyName || '-',
        customerPhone: s.customer?.phone || '-',
        employeeName: s.employee?.name || '-',
        status: s.status,
        isCredit: !!s.isCredit,
      };
    });

    let rows = rowsAll;

    // Apply filters deterministically
    if (bothFlags) {
      rows = rows.filter((r) => (r?.paidAmount ?? 0) > 0 && (r?.balanceAmount ?? 0) > 0);
    } else {
      if (onlyUnpaidBool) rows = rows.filter((r) => (r?.balanceAmount ?? 0) > 0);
      if (onlyPaidBool) rows = rows.filter((r) => (r?.paidAmount ?? 0) > 0);
    }
    if (onlyUnpaidBool) rows = rows.filter((r) => (r?.balanceAmount ?? 0) > 0);
    if (onlyPaidBool) rows = rows.filter((r) => (r?.paidAmount ?? 0) > 0);

    return res.json(rows);
  } catch (error) {
    console.error('❌ [searchPrintableSales] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดข้อมูลใบขายย้อนหลังได้' });
  }
};









// ✅ Backward-compat alias (some routes may still import getAllSalesReturn)
const getAllSalesReturn = getAllSales;

module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  getSalesByBranchId,
  markSaleAsPaid,
  getAllSalesReturn,
  searchPrintableSales,
};
















