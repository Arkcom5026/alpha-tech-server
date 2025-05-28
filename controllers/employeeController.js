// ✅ @filename: server/controllers/employeeController.js
const prisma = require('../lib/prisma');


// ✅ GET /api/employees?branchId=xx - ดึงพนักงานตามสาขา
const getAllEmployees = async (req, res) => {
  try {
    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({ message: 'กรุณาระบุ branchId' });
    }

    const employees = await prisma.employeeProfile.findMany({
      where: {
        branchId: parseInt(branchId),
      },
      include: {
        user: true,
        position: true,
        branch: true,
      },
    });

    res.json(employees);
  } catch (error) {
    console.error('❌ getAllEmployees error:', error);
    res.status(500).json({ error: 'Server error while fetching employees' });
  }
};

// ✅ GET /api/employees/:id - ดึงข้อมูลพนักงานรายคน
const getEmployeesById = async (req, res) => {
  try {
    const employee = await prisma.employeeProfile.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: true, position: true, branch: true },
    });
    res.json(employee);
  } catch (err) {
    res.status(404).json({ message: 'ไม่พบพนักงาน' });
  }
};

// ✅ POST /api/employees - เปลี่ยน role + สร้างโปรไฟล์พนักงานใหม่
const createEmployees = async (req, res) => {
  try {
    const { userId, name, phone, branchId, positionId } = req.body;

    if (!userId || !name || !branchId || !positionId) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
    }
    console.log('📦 รับข้อมูลพนักงานใหม่:', { userId, name, phone, branchId, positionId });


    // 1. อัปเดต role ของ user เป็น employee
    await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role: 'employee' },
    });

    // 2. สร้าง employeeProfile
    const newEmployee = await prisma.employeeProfile.create({
      data: {
        userId: parseInt(userId),
        name,
        phone,
        branchId: parseInt(branchId),
        positionId: parseInt(positionId),
      },
    });

    res.status(201).json(newEmployee);
  } catch (err) {
    console.error('❌ createEmployees error:', err);
    res.status(400).json({ message: 'สร้างพนักงานไม่สำเร็จ', error: err.message });
  }
};

// ✅ PUT /api/employees/:id - อัปเดตข้อมูลพนักงาน
const updateEmployees = async (req, res) => {
  try {
    const { name, phone, positionId } = req.body;
    const updated = await prisma.employeeProfile.update({
      where: { id: parseInt(req.params.id) },
      data: { name, phone, positionId: parseInt(positionId) },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'แก้ไขพนักงานล้มเหลว', error: err.message });
  }
};

// ✅ DELETE /api/employees/:id - ลบข้อมูลพนักงาน
const deleteEmployees = async (req, res) => {
  try {
    await prisma.employeeProfile.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ message: 'ลบพนักงานไม่สำเร็จ', error: err.message });
  }
};

// ✅ GET /api/users?role=user - สำหรับ dropdown เลือกผู้ใช้ที่ยังไม่เป็นพนักงาน
const getUsersByRole = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'user' },
      select: { id: true, email: true, name: true },
    });
    res.json(users);
  } catch (err) {
    console.error('❌ getUsersByRole error:', err);
    res.status(500).json({ message: 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้' });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const users = await prisma.user.findMany({
      where: {
        role: 'customer',
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { customerProfile: { name: { contains: q, mode: 'insensitive' } } },
          { customerProfile: { phone: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        email: true,
        customerProfile: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      take: 20,
    });

    res.json(users);
  } catch (err) {
    console.error('❌ searchUsers error:', err);
    res.status(500).json({ message: 'ค้นหาผู้ใช้ล้มเหลว' });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeesById,
  createEmployees,
  updateEmployees,
  deleteEmployees,
  getUsersByRole,
  searchUsers,
};

