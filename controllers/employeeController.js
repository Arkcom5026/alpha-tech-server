// ✅ @filename: server/controllers/employeeController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllEmployees = async (req, res) => {
  try {
    const branchId = req.user?.branchId;

    if (!branchId) {
      return res.status(400).json({ message: 'กรุณาระบุ branchId จาก token' });
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

const createEmployees = async (req, res) => {
  try {
    const { userId, name, phone, branchId, positionId } = req.body;

    if (!userId || !name || !branchId || !positionId) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
    }

    console.log('📦 รับข้อมูลพนักงานใหม่:', { userId, name, phone, branchId, positionId });

    if (isNaN(parsedUserId) || isNaN(parsedBranchId) || isNaN(parsedPositionId)) {
      return res.status(400).json({ message: 'รหัสไม่ถูกต้อง' });
    }

    await prisma.user.update({
      where: { id: parsedUserId },
      data: { role: 'employee' },
    });

    const newEmployee = await prisma.employeeProfile.create({
      data: {
        userId: Number(userId),
        name,
        phone,
        branchId: Number(branchId),
        positionId: Number(positionId),
      },
    });

    res.status(201).json(newEmployee);
  } catch (err) {
    console.error('❌ createEmployees error:', err);
    res.status(400).json({ message: 'สร้างพนักงานไม่สำเร็จ', error: err.message });
  }
};

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

const approveEmployee = async (req, res) => {
  const { userId, positionId, role, branchId, name, phone } = req.body;
  const requestedBranchId = branchId;
  console.log('📦 approveEmployee received data:',req.body )
  

  try {
    const MAIN_BRANCH_ID = parseInt(process.env.MAIN_BRANCH_ID, 10);
    const isMainBranchAdmin =
      req.user.role === 'employee' && req.user.branchId === MAIN_BRANCH_ID;

    const branchIdToUse = isMainBranchAdmin
      ? requestedBranchId
      : req.user.branchId;

    await prisma.employeeProfile.create({
      data: {
        userId: parseInt(userId, 10),
        branchId: parseInt(branchIdToUse, 10),
        positionId: parseInt(positionId, 10),
        name,
        phone,
      },
    });

    await prisma.user.update({
      where: { id: parseInt(userId, 10) },
      data: { role },
    });

    res.json({ message: '✅ อนุมัติพนักงานเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ approveEmployee error:', error);
    res.status(500).json({ message: 'ไม่สามารถอนุมัติพนักงานได้' });
  }
};

const getAllPositions = async (req, res) => {
  try {
    const positions = await prisma.position.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(positions);
  } catch (err) {
    console.error('❌ getAllPositions error:', err);
    res.status(500).json({ message: 'โหลดตำแหน่งล้มเหลว' });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeesById,
  createEmployees,
  updateEmployees,
  deleteEmployees,
  getUsersByRole,
  approveEmployee,
  getAllPositions,
};
