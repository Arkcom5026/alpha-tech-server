// ✅ controllers/supplierController.js
const prisma = require('../lib/prisma');

const getAllSuppliers = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    if (!branchId) return res.status(400).json({ error: 'branchId is required from token' });

    const suppliers = await prisma.supplier.findMany({
      where: {
        branchId: Number(branchId),
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        contactPerson: true,
        creditLimit: true,
        creditBalance: true,
        createdAt: true,
      },
    });

    const suppliersWithCreditRemaining = suppliers.map((s) => ({
      ...s,
      creditRemaining: (s.creditLimit ?? 0) - (s.creditBalance ?? 0),
    }));

    res.json(suppliersWithCreditRemaining);
  } catch (error) {
    console.error('❌ getAllSuppliers error:', error);
    res.status(500).json({ error: 'Server error while fetching suppliers' });
  }
};



const getSupplierById = async (req, res) => {
  try {
    const rawId = req.params.id;
    const supplierId = Number(rawId);
    const branchId = req.user?.branchId;

    console.log('supplierId :', supplierId, '| rawId :', rawId);

    if (!branchId || isNaN(supplierId)) {
      return res.status(400).json({ error: 'branchId หรือ supplierId ไม่ถูกต้อง' });
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, branchId: Number(branchId) },
    });

    if (!supplier) return res.status(404).json({ error: 'ไม่พบ Supplier' });

    res.json(supplier);
  } catch (err) {
    console.error('❌ [getSupplierById] error:', err);
    res.status(500).json({ error: 'โหลดข้อมูล supplier ล้มเหลว' });
  }
};





const createSupplier = async (req, res) => {
  try {
    const { name, contactPerson, phone, email, taxId, address } = req.body;
    const branchId = req.user?.branchId;
    if (!name || !phone || !branchId) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
    }

    const newSupplier = await prisma.supplier.create({
      data: {
        name,
        contactPerson: contactPerson || null,
        phone,
        email: email || null,
        taxId: taxId || null,
        address: address || null,
        branchId: Number(branchId),
      },
    });

    res.status(201).json(newSupplier);
  } catch (err) {
    console.error('❌ createSupplier error:', err);
    res.status(400).json({ message: 'สร้าง supplier ไม่สำเร็จ', error: err.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    const rawId = req.params.id;
    const supplierId = Number(rawId);
    console.log('updateSupplier : ', supplierId);
    console.log('req.body : ', req.body);

    if (!branchId || isNaN(supplierId)) {
      return res.status(400).json({ message: 'branchId หรือ supplierId ไม่ถูกต้อง' });
    }

    const existing = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        branchId: Number(branchId),
      },
    });
    if (!existing) {
      return res.status(403).json({ message: 'ไม่พบ supplier หรือไม่มีสิทธิ์เข้าถึง' });
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
      'active'
    ];
    const updateData = {};

    for (const field of allowedFields) {
      if (field in req.body) {
        updateData[field] = req.body[field];
      }
    }

    // ✅ แปลง bankId ให้เป็น number ถ้ามีค่า
    if ('bankId' in updateData && updateData.bankId !== null) {
      updateData.bankId = Number(updateData.bankId);
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: updateData,
    });

    res.json(updated);
  } catch (err) {
    console.error('❌ updateSupplier error:', err);
    res.status(400).json({ message: 'แก้ไข supplier ล้มเหลว', error: err.message });
  }
};



const deleteSupplier = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    if (!branchId) return res.status(400).json({ error: 'branchId is required from token' });

    const existing = await prisma.supplier.findFirst({
      where: {
        id: parseInt(req.params.id),
        branchId: Number(branchId),
      },
    });
    if (!existing) return res.status(403).json({ message: 'ไม่พบ supplier หรือไม่มีสิทธิ์ลบ' });

    await prisma.supplier.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ message: 'ลบ supplier ไม่สำเร็จ', error: err.message });
  }
};

module.exports = {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
