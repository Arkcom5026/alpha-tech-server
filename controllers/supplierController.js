// ✅ controllers/supplierController.js
const prisma = require('../lib/prisma');

const getAllSuppliers = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    if (!branchId) return res.status(400).json({ error: 'branchId is required from token' });

    const suppliers = await prisma.supplier.findMany({
      where: {
        branchId: parseInt(branchId),
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        contactPerson: true,
        creditLimit: true,
        currentBalance: true,
        createdAt: true,
      },
    });

    res.json(suppliers);
  } catch (error) {
    console.error('❌ getAllSuppliers error:', error);
    res.status(500).json({ error: 'Server error while fetching suppliers' });
  }
};

const getSupplierById = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: parseInt(req.params.id),
        branchId: parseInt(branchId),
      },
    });
    if (!supplier) return res.status(404).json({ message: 'ไม่พบ supplier ในสาขานี้' });
    res.json(supplier);
  } catch (err) {
    res.status(404).json({ message: 'ไม่พบ supplier' });
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
        branchId: parseInt(branchId),
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
    const existing = await prisma.supplier.findFirst({
      where: {
        id: parseInt(req.params.id),
        branchId: parseInt(branchId),
      },
    });
    if (!existing) return res.status(403).json({ message: 'ไม่พบ supplier หรือไม่มีสิทธิ์เข้าถึง' });

    const updated = await prisma.supplier.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'แก้ไข supplier ล้มเหลว', error: err.message });
  }
};

const deleteSupplier = async (req, res) => {
  try {
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
  
