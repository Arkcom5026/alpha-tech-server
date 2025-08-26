// ✅ controllers/supplierController.js — Prisma singleton + Branch scope + isSystem safety + Decimal-safe
const { prisma, Prisma } = require('../lib/prisma');

// Helpers
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v ?? 0));
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v ?? 0));

// GET /suppliers
const getAllSuppliers = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(400).json({ error: 'branchId is required from token' });

    // optional ?includeSystem=1 เพื่อให้เห็น supplier ระบบด้วย
    const includeSystem = String(req.query?.includeSystem || '0') === '1';
    const q = (req.query?.q || '').toString().trim();

    const where = omitUndefined({
      branchId,
      ...(includeSystem ? {} : { isSystem: false }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { contactPerson: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    });

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        contactPerson: true,
        creditLimit: true,
        creditBalance: true,
        isSystem: true,
        active: true,
        createdAt: true,
      },
    });

    const suppliersWithCreditRemaining = suppliers.map((s) => ({
      ...s,
      creditLimit: toNum(s.creditLimit),
      creditBalance: toNum(s.creditBalance),
      creditRemaining: toNum(D(s.creditLimit).minus(D(s.creditBalance))),
    }));

    return res.json(suppliersWithCreditRemaining);
  } catch (error) {
    console.error('❌ getAllSuppliers error:', error);
    return res.status(500).json({ error: 'Server error while fetching suppliers' });
  }
};

// GET /suppliers/:id
const getSupplierById = async (req, res) => {
  try {
    const supplierId = toInt(req.params.id);
    const branchId = toInt(req.user?.branchId);
    if (!branchId || !supplierId) {
      return res.status(400).json({ error: 'branchId หรือ supplierId ไม่ถูกต้อง' });
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, branchId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        contactPerson: true,
        taxId: true,
        address: true,
        province: true,
        postalCode: true,
        country: true,
        paymentTerms: true,
        creditLimit: true,
        creditBalance: true,
        bankId: true,
        accountNumber: true,
        accountType: true,
        notes: true,
        active: true,
        isSystem: true,
        createdAt: true,
      },
    });

    if (!supplier) return res.status(404).json({ error: 'ไม่พบ Supplier' });

    return res.json({
      ...supplier,
      creditLimit: toNum(supplier.creditLimit),
      creditBalance: toNum(supplier.creditBalance),
    });
  } catch (err) {
    console.error('❌ [getSupplierById] error:', err);
    return res.status(500).json({ error: 'โหลดข้อมูล supplier ล้มเหลว' });
  }
};

// POST /suppliers
const createSupplier = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(400).json({ message: 'branchId is required from token' });

    const { name, contactPerson, phone, email, taxId, address, province, postalCode, country, paymentTerms, creditLimit } = req.body || {};
    if (!name || !phone) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (name, phone)' });
    }

    const newSupplier = await prisma.supplier.create({
      data: {
        branchId,
        name: String(name).trim(),
        contactPerson: contactPerson || null,
        phone: String(phone).trim(),
        email: email ? String(email).trim() : null,
        taxId: taxId ? String(taxId).trim() : null,
        address: address || null,
        province: province || null,
        postalCode: postalCode || null,
        country: country || null,
        paymentTerms: paymentTerms || null,
        creditLimit: creditLimit !== undefined ? D(creditLimit) : D(0),
        creditBalance: D(0),
        isSystem: false, // 🔒 ห้ามสร้างระบบผ่าน endpoint นี้
        active: true,
      },
    });

    return res.status(201).json(newSupplier);
  } catch (err) {
    console.error('❌ createSupplier error:', err);
    return res.status(400).json({ message: 'สร้าง supplier ไม่สำเร็จ', error: err?.message || String(err) });
  }
};

// PATCH /suppliers/:id
const updateSupplier = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const supplierId = toInt(req.params.id);
    if (!branchId || !supplierId) {
      return res.status(400).json({ message: 'branchId หรือ supplierId ไม่ถูกต้อง' });
    }

    const existing = await prisma.supplier.findFirst({ where: { id: supplierId, branchId } });
    if (!existing) {
      return res.status(403).json({ message: 'ไม่พบ supplier หรือไม่มีสิทธิ์เข้าถึง' });
    }
    if (existing.isSystem) {
      return res.status(403).json({ message: 'ไม่สามารถแก้ไข Supplier ระบบได้' });
    }

    const allowedFields = [
      'name',
      'contactPerson',
      'phone',
      'email',
      'taxId',
      'address',
      'province',
      'postalCode',
      'country',
      'paymentTerms',
      'creditLimit',
      'bankId',
      'accountNumber',
      'accountType',
      'notes',
      'active',
    ];

    const data = {};
    for (const field of allowedFields) {
      if (field in req.body) data[field] = req.body[field];
    }

    // Normalize & Decimal-safe
    if (data.creditLimit !== undefined) data.creditLimit = D(data.creditLimit);
    if (data.bankId !== undefined && data.bankId !== null) data.bankId = toInt(data.bankId);

    const updated = await prisma.supplier.update({ where: { id: supplierId }, data });

    return res.json(updated);
  } catch (err) {
    console.error('❌ updateSupplier error:', err);
    return res.status(400).json({ message: 'แก้ไข supplier ล้มเหลว', error: err?.message || String(err) });
  }
};

// DELETE /suppliers/:id
const deleteSupplier = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const supplierId = toInt(req.params.id);
    if (!branchId) return res.status(400).json({ error: 'branchId is required from token' });
    if (!supplierId) return res.status(400).json({ error: 'supplierId ไม่ถูกต้อง' });

    const existing = await prisma.supplier.findFirst({ where: { id: supplierId, branchId } });
    if (!existing) return res.status(403).json({ message: 'ไม่พบ supplier หรือไม่มีสิทธิ์ลบ' });
    if (existing.isSystem) return res.status(403).json({ message: 'ไม่สามารถลบ Supplier ระบบได้' });

    // กันลบถ้ามีการอ้างอิง
    const poCount = await prisma.purchaseOrder.count({ where: { supplierId } });
    if (poCount > 0) return res.status(409).json({ message: 'ลบไม่ได้: มีเอกสารจัดซื้ออ้างอิงอยู่' });

    await prisma.supplier.delete({ where: { id: supplierId } });
    return res.status(204).end();
  } catch (err) {
    console.error('❌ deleteSupplier error:', err);
    return res.status(400).json({ message: 'ลบ supplier ไม่สำเร็จ', error: err?.message || String(err) });
  }
};

module.exports = {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
