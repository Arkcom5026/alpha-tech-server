/* eslint-env node */
// controllers/customerDepositController.js (updated)

const { prisma, Prisma } = require('../lib/prisma');

// --- Decimal & money helpers ---
const D = (v) => new Prisma.Decimal(typeof v === 'string' ? v : Number(v));
const toNum = (v) => (v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v));
const isMoneyLike = (v) =>
  (typeof v === 'number' && !isNaN(v)) ||
  (typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v));
const NORMALIZE_DECIMAL_TO_NUMBER = process.env.NORMALIZE_DECIMAL_TO_NUMBER !== '0';

// ✅ normalize deposit numeric fields
const normalizeDeposit = (dep) => {
  if (!NORMALIZE_DECIMAL_TO_NUMBER || !dep) return dep;
  const out = { ...dep };
  for (const k of ['cashAmount', 'transferAmount', 'cardAmount', 'usedAmount', 'totalAmount']) {
    if (k in out && out[k] != null) out[k] = toNum(out[k]);
  }
  return out;
};

// ✅ normalize customer numeric fields
const normalizeCustomerMoney = (cust) => {
  if (!NORMALIZE_DECIMAL_TO_NUMBER || !cust) return cust;
  const out = { ...cust };
  for (const k of ['creditLimit', 'creditBalance']) {
    if (k in out && out[k] != null) out[k] = toNum(out[k]);
  }
  return out;
};

// --- Phone & address helpers (SSoT: User.loginId, subdistrictCode) ---
const normalizePhone = (raw = '') => String(raw).replace(/\D/g, '').replace(/^66/, '0').slice(-10);
const isValidPhone = (s = '') => /^\d{10}$/.test(s);

const buildCustomerAddress = (profile) => {
  const parts = [];
  if (profile?.addressDetail) parts.push(profile.addressDetail);
  const sd = profile?.subdistrict;
  const d = sd?.district;
  const pv = d?.province;
  if (sd?.nameTh) parts.push(sd.nameTh);
  if (d?.nameTh) parts.push(d.nameTh);
  if (pv?.nameTh) parts.push(pv.nameTh);
  const postcode = sd?.postcode || null;
  if (postcode) parts.push(postcode);
  return parts.filter(Boolean).join(' ');
};

// Project deposit to stable shape for FE (customer: { name, phone })
const projectDeposit = (dep) => {
  const base = NORMALIZE_DECIMAL_TO_NUMBER ? normalizeDeposit(dep) : dep;
  return {
    ...base,
    customer: {
      name: dep?.customer?.name || '',
      phone: dep?.customer?.user?.loginId || null,
    },
  };
};

// ─────────────────────────────────────────────────────────────
// Create a new customer deposit (ACTIVE)
const createCustomerDeposit = async (req, res) => {
  try {
    const { cashAmount = 0, transferAmount = 0, cardAmount = 0, note, customerId } = req.body;
    const employeeId = req.user?.employeeId; // EmployeeProfile.id
    const branchId = Number(req.user?.branchId);

    if (!customerId || !employeeId || !branchId) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบ (customerId/employeeId/branchId)' });
    }

    if (![cashAmount, transferAmount, cardAmount].every(isMoneyLike)) {
      return res.status(400).json({
        message: 'รูปแบบจำนวนเงินไม่ถูกต้อง (ต้องเป็นเลข และทศนิยมไม่เกิน 2 ตำแหน่ง)',
      });
    }

    const cash = D(cashAmount);
    const trf = D(transferAmount);
    const card = D(cardAmount);
    const total = cash.plus(trf).plus(card);
    if (total.lessThanOrEqualTo(0)) {
      return res.status(400).json({ message: 'ยอดรวมต้องมากกว่า 0' });
    }

    const deposit = await prisma.customerDeposit.create({
      data: {
        cashAmount: cash,
        transferAmount: trf,
        cardAmount: card,
        totalAmount: total,
        note,
        customerId,
        createdBy: employeeId,
        branchId,
        status: 'ACTIVE',
      },
      include: { customer: { include: { user: true } } },
    });

    return res.status(201).json(projectDeposit(deposit));
  } catch (err) {
    console.error('❌ createCustomerDeposit error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกเงินมัดจำ' });
  }
};

// List ACTIVE deposits of branch
const getAllCustomerDeposits = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const deposits = await prisma.customerDeposit.findMany({
      where: { branchId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: { customer: { include: { user: true } } },
    });

    res.json(deposits.map(projectDeposit));
  } catch (err) {
    console.error('❌ getAllCustomerDeposits error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
};

// Get single ACTIVE deposit by id (branch scoped)
const getCustomerDepositById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'ID ไม่ถูกต้อง' });
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const deposit = await prisma.customerDeposit.findFirst({
      where: { id, branchId, status: 'ACTIVE' },
      include: { customer: { include: { user: true } } },
    });

    if (!deposit) return res.status(404).json({ message: 'ไม่พบข้อมูลมัดจำ' });

    res.json(projectDeposit(deposit));
  } catch (error) {
    console.error('getCustomerDepositById error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลมัดจำ' });
  }
};

// Find customer by phone and return deposits
const getCustomerAndDepositByPhone = async (req, res) => {
  try {
    const rawPhone = req.params.phone || '';
    const phone = normalizePhone(rawPhone);
    const branchId = Number(req.user?.branchId);

    if (!branchId) return res.status(401).json({ error: 'unauthorized' });
    if (!isValidPhone(phone)) return res.status(400).json({ message: 'กรุณาระบุเบอร์โทรให้ถูกต้อง (10 หลัก)' });

    const customer = await prisma.customerProfile.findFirst({
      where: { user: { loginId: phone } },
      include: {
        user: true,
        subdistrict: { include: { district: { include: { province: true } } } },
        customerDeposit: {
          where: { branchId, status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) return res.status(404).json({ message: 'ไม่พบลูกค้า' });

    const totalDeposit = customer.customerDeposit.reduce(
      (sum, d) => sum.plus(d.cashAmount).plus(d.transferAmount).plus(d.cardAmount),
      new Prisma.Decimal(0),
    );

    const customerOut = normalizeCustomerMoney({
      id: customer.id,
      name: customer.name,
      phone: customer.user?.loginId || null,
      email: customer.user?.email || '',
      type: customer.type,
      companyName: customer.companyName,
      taxId: customer.taxId,
      creditLimit: customer.creditLimit,
      creditBalance: customer.creditBalance,
      subdistrictCode: customer.subdistrictCode || null,
      addressDetail: customer.addressDetail || null,
      customerAddress: buildCustomerAddress(customer),
    });

    return res.json({
      customer: customerOut,
      totalDeposit: NORMALIZE_DECIMAL_TO_NUMBER ? toNum(totalDeposit) : totalDeposit,
      deposits: NORMALIZE_DECIMAL_TO_NUMBER
        ? customer.customerDeposit.map(normalizeDeposit)
        : customer.customerDeposit,
    });
  } catch (err) {
    console.error('[getCustomerAndDepositByPhone] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้าและมัดจำ' });
  }
};

// Search customers by name/company and return first match + deposits
const getCustomerAndDepositByName = async (req, res) => {
  try {
    let { q } = req.query;
    const branchId = Number(req.user?.branchId);

    if (!branchId) return res.status(401).json({ error: 'unauthorized' });
    if (!q || typeof q !== 'string' || q.trim() === '') {
      return res.status(400).json({ error: 'กรุณาระบุคำค้นหาที่ถูกต้อง' });
    }
    q = q.trim();

    const customers = await prisma.customerProfile.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      include: {
        user: true,
        subdistrict: { include: { district: { include: { province: true } } } },
        customerDeposit: { where: { branchId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customers.length) return res.status(404).json({ error: 'ไม่พบลูกค้า' });

    const c = customers[0];
    const totalDeposit =
      c.customerDeposit?.reduce(
        (sum, d) => sum.plus(d.cashAmount).plus(d.transferAmount).plus(d.cardAmount),
        new Prisma.Decimal(0),
      ) || new Prisma.Decimal(0);

    const customerOut = normalizeCustomerMoney({
      id: c.id,
      name: c.name,
      phone: c.user?.loginId || null,
      email: c.user?.email || '',
      type: c.type || '',
      companyName: c.companyName || '',
      taxId: c.taxId || '',
      creditLimit: c.creditLimit,
      creditBalance: c.creditBalance,
      subdistrictCode: c.subdistrictCode || null,
      addressDetail: c.addressDetail || null,
      customerAddress: buildCustomerAddress(c),
    });

    return res.json({
      customer: customerOut,
      totalDeposit: NORMALIZE_DECIMAL_TO_NUMBER ? toNum(totalDeposit) : totalDeposit,
      deposits: NORMALIZE_DECIMAL_TO_NUMBER
        ? c.customerDeposit.map(normalizeDeposit)
        : c.customerDeposit,
    });
  } catch (err) {
    console.error('[getCustomerAndDepositByName] ❌', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาชื่อลูกค้าและเงินมัดจำ' });
  }
};

// Update deposit values or cancel (soft delete)
const updateCustomerDeposit = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const branchId = Number(req.user?.branchId);

    const existing = await prisma.customerDeposit.findFirst({
      where: { id, branchId, status: 'ACTIVE' },
    });
    if (!existing) return res.status(404).json({ message: 'ไม่พบรายการที่ต้องการแก้ไข' });

    // Soft cancel
    if (req.body.status === 'CANCELLED') {
      const cancelled = await prisma.customerDeposit.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      return res.json(NORMALIZE_DECIMAL_TO_NUMBER ? normalizeDeposit(cancelled) : cancelled);
    }

    const { cashAmount = 0, transferAmount = 0, cardAmount = 0, note } = req.body;
    if (![cashAmount, transferAmount, cardAmount].every(isMoneyLike)) {
      return res.status(400).json({ message: 'รูปแบบจำนวนเงินไม่ถูกต้อง' });
    }

    const cash = D(cashAmount);
    const trf = D(transferAmount);
    const card = D(cardAmount);
    const total = cash.plus(trf).plus(card);

    const updated = await prisma.customerDeposit.update({
      where: { id },
      data: { cashAmount: cash, transferAmount: trf, cardAmount: card, totalAmount: total, note },
    });

    res.json(NORMALIZE_DECIMAL_TO_NUMBER ? normalizeDeposit(updated) : updated);
  } catch (err) {
    console.error('❌ updateCustomerDeposit error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
  }
};

// Soft cancel explicitly
const deleteCustomerDeposit = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const branchId = Number(req.user?.branchId);

    const existing = await prisma.customerDeposit.findFirst({
      where: { id, branchId, status: 'ACTIVE' },
    });
    if (!existing) return res.status(404).json({ message: 'ไม่พบรายการที่ต้องการลบ' });

    await prisma.customerDeposit.update({ where: { id }, data: { status: 'CANCELLED' } });
    res.json({ message: 'ยกเลิกรายการเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('❌ deleteCustomerDeposit error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
};

// Use a portion of deposit, with logging, status update when fully used
const useCustomerDeposit = async (req, res) => {
  try {
    const { depositId, amountUsed, saleId } = req.body;
    const branchId = Number(req.user?.branchId);

    if (!depositId || !amountUsed || !saleId) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }
    if (!isMoneyLike(amountUsed) || Number(amountUsed) <= 0) {
      return res.status(400).json({ message: 'จำนวนเงินที่ใช้ไม่ถูกต้อง' });
    }

    const deposit = await prisma.customerDeposit.findFirst({
      where: { id: Number(depositId), branchId, status: 'ACTIVE' },
    });
    if (!deposit) return res.status(404).json({ message: 'ไม่พบรายการมัดจำ' });

    const already = deposit.usedAmount || new Prisma.Decimal(0);
    const remain = deposit.totalAmount.minus(already);
    const useAmt = D(amountUsed);

    if (remain.lessThan(useAmt)) {
      return res.status(400).json({ message: 'ยอดมัดจำไม่พอสำหรับการใช้งาน' });
    }

    await prisma.$transaction(async (tx) => {
      // 1) Log usage
      await tx.depositUsage.create({
        data: { customerDepositId: deposit.id, saleId: Number(saleId), amountUsed: useAmt },
      });
      // 2) Update running used amount
      const updated = await tx.customerDeposit.update({
        where: { id: deposit.id },
        data: { usedAmount: already.plus(useAmt), usedSaleId: Number(saleId) },
      });
      // 3) Set status to USED only when fully consumed
      const newStatus = updated.usedAmount.greaterThanOrEqualTo(updated.totalAmount)
        ? 'USED'
        : 'ACTIVE';
      if (newStatus !== deposit.status) {
        await tx.customerDeposit.update({ where: { id: deposit.id }, data: { status: newStatus } });
      }
    });

    return res.json({ message: 'ใช้มัดจำสำเร็จ' });
  } catch (err) {
    console.error('❌ useCustomerDeposit error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการใช้เงินมัดจำ' });
  }
};

module.exports = {
  createCustomerDeposit,
  getAllCustomerDeposits,
  getCustomerDepositById,
  updateCustomerDeposit,
  deleteCustomerDeposit,
  getCustomerAndDepositByPhone,
  useCustomerDeposit,
  getCustomerAndDepositByName,
};

