// ✅ @filename: server/controllers/employeeController.js
// Unified Prisma import (singleton)
const { prisma, Prisma } = require('../lib/prisma');

// --- helpers ---
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : parseInt(v, 10));
// ⬇️ อนุญาต role เพิ่มเติม (superadmin/owner) และเขียนให้ยืดหยุ่นด้วย lowerCase
const isStaffRole = (r) => new Set(['superadmin', 'owner', 'admin', 'manager', 'staff', 'employee']).has(String(r || '').toLowerCase());

// GET /employees
const getAllEmployees = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(400).json({ message: 'กรุณาระบุ branchId จาก token' });

    const employees = await prisma.employeeProfile.findMany({
      where: { branchId },
      include: { user: true, position: true, branch: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    res.json(employees);
  } catch (error) {
    console.error('❌ getAllEmployees error:', error);
    res.status(500).json({ error: 'Server error while fetching employees' });
  }
};

// GET /employees/:id
const getEmployeesById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const branchId = toInt(req.user?.branchId);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const employee = await prisma.employeeProfile.findFirst({
      where: { id, branchId }, // BRANCH_SCOPE_ENFORCED
      include: { user: true, position: true, branch: true },
    });

    if (!employee) return res.status(404).json({ message: 'ไม่พบพนักงานในสาขานี้' });
    res.json(employee);
  } catch (err) {
    console.error('❌ getEmployeesById error:', err);
    res.status(500).json({ message: 'ดึงข้อมูลพนักงานไม่สำเร็จ' });
  }
};

// POST /employees
const createEmployees = async (req, res) => {
  try {
    const actor = req.user || {};
    if (!isStaffRole(actor.role) && !actor.isSuperAdmin) return res.status(403).json({ message: 'FORBIDDEN_ROLE' });

    const { userId, name, phone, positionId } = req.body;
    let requestedBranchId = toInt(req.body?.branchId);

    const MAIN_BRANCH_ID = toInt(process.env.MAIN_BRANCH_ID);
    const isMainBranchAdmin = String(actor.role).toLowerCase() === 'employee' && actor.branchId === MAIN_BRANCH_ID;
    const branchId = isMainBranchAdmin && requestedBranchId ? requestedBranchId : toInt(actor.branchId);

    if (!userId || !name || !branchId || !positionId) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
    }

    const parsedUserId = toInt(userId);
    const parsedPositionId = toInt(positionId);
    if (!parsedUserId || !parsedPositionId) {
      return res.status(400).json({ message: 'รหัสไม่ถูกต้อง' });
    }

    const newEmployee = await prisma.$transaction(async (tx) => {
      // Promote user to employee role
      await tx.user.update({ where: { id: parsedUserId }, data: { role: 'employee' } });

      // Create employee profile
      return tx.employeeProfile.create({
        data: {
          userId: parsedUserId,
          name,
          phone: phone || null,
          branchId,
          positionId: parsedPositionId,
        },
      });
    }, { timeout: 15000 });

    res.status(201).json(newEmployee);
  } catch (err) {
    console.error('❌ createEmployees error:', err);
    const msg = err instanceof Error ? err.message : 'unknown error';
    res.status(400).json({ message: 'สร้างพนักงานไม่สำเร็จ', error: msg });
  }
};

// PATCH /employees/:id
const updateEmployees = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const actorBranchId = toInt(req.user?.branchId);
    if (!id || !actorBranchId) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });

    const { name, phone, positionId } = req.body;

    // Ensure employee belongs to actor's branch
    const current = await prisma.employeeProfile.findFirst({ where: { id, branchId: actorBranchId } });
    if (!current) return res.status(404).json({ message: 'ไม่พบพนักงานในสาขานี้' });

    const updated = await prisma.employeeProfile.update({
      where: { id },
      data: {
        name: name ?? current.name,
        phone: phone ?? current.phone,
        positionId: positionId !== undefined ? toInt(positionId) : current.positionId,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('❌ updateEmployees error:', err);
    res.status(400).json({ message: 'แก้ไขพนักงานล้มเหลว', error: err?.message || String(err) });
  }
};

// DELETE /employees/:id
const deleteEmployees = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const branchId = toInt(req.user?.branchId);
    if (!id || !branchId) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });

    const found = await prisma.employeeProfile.findFirst({ where: { id, branchId } });
    if (!found) return res.status(404).json({ message: 'ไม่พบพนักงานในสาขานี้' });

    await prisma.employeeProfile.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    console.error('❌ deleteEmployees error:', err);
    res.status(400).json({ message: 'ลบพนักงานไม่สำเร็จ', error: err?.message || String(err) });
  }
};

// GET /users?role=user
const getUsersByRole = async (req, res) => {
  try {
    const role = String(req.query?.role || 'user');
    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true, email: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    res.json(users);
  } catch (err) {
    console.error('❌ getUsersByRole error:', err);
    res.status(500).json({ message: 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้' });
  }
};

// POST /employees/approve  (รองรับ /employees/approve-employee ด้วย)
function buildForbiddenMessage(actor) {
  return {
    message: 'FORBIDDEN_ROLE',
    detail: {
      role: actor?.role ?? null,
      isSuperAdmin: !!actor?.isSuperAdmin,
    },
  };
}

const approveEmployee = async (req, res) => {
  const { userId, positionId, role, branchId: requestedBranchId, name, phone } = req.body || {};
  try {
    const actor = req.user || {};
    const canApprove = !!actor?.isSuperAdmin || isStaffRole(actor.role);
    if (!canApprove) return res.status(403).json(buildForbiddenMessage(actor));

    const MAIN_BRANCH_ID = toInt(process.env.MAIN_BRANCH_ID);
    const isMainBranchAdmin = String(actor.role).toLowerCase() === 'employee' && toInt(actor.branchId) === MAIN_BRANCH_ID;
    const branchIdToUse = isMainBranchAdmin && toInt(requestedBranchId) ? toInt(requestedBranchId) : toInt(actor.branchId);

    const parsedUserId = toInt(userId);
    const parsedPositionId = toInt(positionId);
    if (!parsedUserId || !parsedPositionId || !branchIdToUse) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบหรือไม่ถูกต้อง', detail: { userId, positionId, branchIdToUse } });
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeProfile.create({
        data: {
          userId: parsedUserId,
          branchId: branchIdToUse,
          positionId: parsedPositionId,
          name,
          phone: phone || null,
        },
      });

      if (role) {
        await tx.user.update({ where: { id: parsedUserId }, data: { role } });
      }
    }, { timeout: 15000 });

    res.json({ message: '✅ อนุมัติพนักงานเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ approveEmployee error:', error);
    res.status(500).json({ message: 'ไม่สามารถอนุมัติพนักงานได้' });
  }
};

// alias ให้ router เก่าที่เรียก /employees/approve-employee สามารถใช้ร่วมกันได้
const approveEmployeeAlias = approveEmployee;

// GET /positions
const getAllPositions = async (req, res) => {
  try {
    const positions = await prisma.position.findMany({ orderBy: { name: 'asc' } });
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
  approveEmployeeAlias, // ⬅️ ใช้กับ path /employees/approve-employee ได้
  getAllPositions,
};
