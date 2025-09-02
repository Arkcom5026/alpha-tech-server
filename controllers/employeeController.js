// ✅ @filename: server/controllers/employeeController.js
// Unified Prisma import (singleton)
const { prisma, Prisma } = require('../lib/prisma');

// --- helpers ---
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : parseInt(v, 10));
// ⬇️ อนุญาต role เพิ่มเติม (superadmin/owner) และเขียนให้ยืดหยุ่นด้วย lowerCase
const isStaffRole = (r) => new Set(['superadmin', 'owner', 'admin', 'manager', 'staff', 'employee']).has(String(r || '').toLowerCase());

// GET /employees (supports q/search, role, status, page, limit, branchId)
const getAllEmployees = async (req, res) => {
  try {
    const actor = req.user || {};
    const actorBranchId = toInt(actor.branchId);
    const actorRole = String(actor.role || '').toLowerCase();
    const isSuper = !!actor?.isSuperAdmin || actorRole === 'superadmin';

    const q = (req.query.q ?? req.query.search ?? '').toString().trim();
    const role = (req.query.role ?? '').toString().trim().toLowerCase(); // admin|employee (optional)
    const statusParam = (req.query.status ?? '').toString().trim().toLowerCase(); // active|inactive|pending (optional)
    const requestedBranchId = toInt(req.query.branchId);
    const pageNum = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
    const skip = (pageNum - 1) * take;

    // Build where clause (branch-scoped unless superadmin; superadmin may pass branchId to filter)
    const where = {
      ...(isSuper ? (requestedBranchId ? { branchId: requestedBranchId } : {}) : { branchId: actorBranchId || -1 }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { user: { email: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(role ? { user: { role } } : {}),
      ...(statusParam && statusParam !== 'all' ? { status: statusParam } : {}), // รองรับ field status ใน employeeProfile ถ้ามี
    };

    const [itemsRaw, total] = await Promise.all([
      prisma.employeeProfile.findMany({
        where,
        include: { user: true, position: true, branch: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.employeeProfile.count({ where }),
    ]);

    // Normalize shape expected by FE
    const items = itemsRaw.map((e) => ({
      id: e.id,
      userId: e.userId,
      name: e.name,
      phone: e.phone,
      positionId: e.positionId,
      branchId: e.branchId,
      status: e.status ?? e.employeeStatus ?? 'active',
      role: e.user?.role ?? null,
      email: e.user?.email ?? null,
      user: e.user,
      position: e.position,
      branch: e.branch,
    }));

    return res.json({
      items,
      total,
      page: pageNum,
      limit: take,
      pages: Math.max(1, Math.ceil(total / take)),
    });
  } catch (error) {
    console.error('❌ getAllEmployees error:', error);
    res.status(500).json({ error: 'Server error while fetching employees' });
  }
};

// GET /employees/:id
const getEmployeesById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const actor = req.user || {};
    const actorBranchId = toInt(actor.branchId);
    const actorRole = String(actor.role || '').toLowerCase();
    const isSuper = !!actor?.isSuperAdmin || actorRole === 'superadmin';
    const scopeAll = String(req.query?.scope || '').toLowerCase() === 'all';

    // superadmin (หรือ scope=all) มองเห็นทุกสาขา
    const where = isSuper || scopeAll ? { id } : { id, branchId: actorBranchId || -1 };

    const employee = await prisma.employeeProfile.findFirst({
      where,
      include: { user: true, position: true, branch: true },
    });

    if (!employee) {
      return res.status(404).json({ message: isSuper || scopeAll ? 'ไม่พบพนักงาน' : 'ไม่พบพนักงานในสาขานี้' });
    }
    res.json(employee);
  } catch (err) {
    console.error('❌ getEmployeeById error:', err);
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
    const actor = req.user || {};
    const actorBranchId = toInt(actor.branchId);
    const actorRole = String(actor.role || '').toLowerCase();
    const isSuper = !!actor?.isSuperAdmin || actorRole === 'superadmin';

    if (!id) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });

    const { name, phone, positionId } = req.body;

    // หา employee โดยไม่จำกัดสาขาก่อน แล้วค่อยตรวจสิทธิ์
    const current = await prisma.employeeProfile.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: 'ไม่พบพนักงาน' });

    if (!isSuper && toInt(current.branchId) !== actorBranchId) {
      return res.status(403).json({ message: 'FORBIDDEN_BRANCH' });
    }

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

// GET /branches/dropdowns  (for superadmin filter on Manage Roles)
const getBranchDropdowns = async (req, res) => {
  try {
    const rows = await prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
    res.json(rows);
  } catch (err) {
    console.error('❌ getBranchDropdowns error:', err);
    res.status(500).json({ message: 'โหลดสาขาล้มเหลว' });
  }
};

// PATCH /roles/users/:userId/role  — superadmin only; allow admin↔employee; forbid when employee status is 'pending'
const updateUserRole = async (req, res) => {
  try {
    const actor = req.user || {};
    const meRole = String(actor.role || '').toLowerCase();
    const isSuper = meRole === 'superadmin' || !!actor.isSuperAdmin;
    if (!isSuper) return res.status(403).json({ message: 'FORBIDDEN' });

    const userId = toInt(req.params.userId);
    const desired = String(req.body?.role || '').toLowerCase();
    if (!userId) return res.status(400).json({ message: 'userId ไม่ถูกต้อง' });
    if (!['admin', 'employee'].includes(desired)) {
      return res.status(400).json({ message: 'Allowed roles: admin หรือ employee เท่านั้น' });
    }

    // ตรวจสอบผู้ใช้ปลายทาง
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!target) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

    const current = String(target.role || '').toLowerCase();
    if (!['admin', 'employee'].includes(current)) {
      return res.status(400).json({ message: 'ไม่สามารถเปลี่ยนบทบาทของผู้ใช้นี้ในหน้าจอนี้ได้' });
    }

    // ต้องเป็นพนักงานที่ได้รับอนุมัติแล้วเท่านั้น
    const profile = await prisma.employeeProfile.findFirst({ where: { userId } });
    const empStatus = String(profile?.status || profile?.employeeStatus || '').toLowerCase();
    if (empStatus === 'pending') {
      return res.status(400).json({ message: 'ผู้ใช้ยังไม่ได้รับอนุมัติพนักงาน' });
    }

    // อัปเดตบทบาท
    const updated = await prisma.user.update({ where: { id: userId }, data: { role: desired } });
    return res.json({ message: 'Role updated', user: { id: updated.id, role: updated.role } });
  } catch (err) {
    console.error('[updateUserRole] error:', err);
    return res.status(500).json({ message: 'ไม่สามารถเปลี่ยน Role ได้' });
  }
};

// PATCH /employees/:id/status — toggle active/inactive (branch-scoped; forbid when pending)
const toggleEmployeeStatus = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const actor = req.user || {};
    const actorBranchId = toInt(actor.branchId);
    const isSuper = !!actor?.isSuperAdmin || String(actor.role || '').toLowerCase() === 'superadmin';

    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    // payload: { active: boolean }  หรือ  { status: 'active' | 'inactive' }
    const bodyActive = req.body?.active;
    const bodyStatus = String(req.body?.status || '').toLowerCase();
    const nextActive = typeof bodyActive === 'boolean' ? bodyActive : bodyStatus === 'active';
    const nextStatus = nextActive ? 'active' : 'inactive';

    // หา employee และตรวจสาขา
    const employee = await prisma.employeeProfile.findUnique({ where: { id }, include: { branch: true } });
    if (!employee) return res.status(404).json({ message: 'ไม่พบพนักงาน' });
    if (!isSuper && toInt(employee.branchId) !== actorBranchId) {
      return res.status(403).json({ message: 'FORBIDDEN_BRANCH' });
    }

    const curStatus = String(employee.status || employee.employeeStatus || '').toLowerCase();
    if (curStatus === 'pending') {
      return res.status(400).json({ message: 'ไม่สามารถเปลี่ยนสถานะผู้ที่ยังรออนุมัติได้' });
    }

    // บาง schema ใช้ field ชื่อ status, บาง schema ใช้ employeeStatus
    // พยายามอัปเดต status ก่อน ถ้า error ค่อย fallback ไป employeeStatus
    let updated;
    try {
      updated = await prisma.employeeProfile.update({ where: { id }, data: { status: nextStatus } });
    } catch (e1) {
      try {
        updated = await prisma.employeeProfile.update({ where: { id }, data: { employeeStatus: nextStatus } });
      } catch (e2) {
        // ทั้งสอง field ใช้ไม่ได้ — แจ้ง error กลับ
        return res.status(400).json({ message: 'ไม่สามารถอัปเดตสถานะพนักงานได้' });
      }
    }

    return res.json({ message: 'อัปเดตสถานะสำเร็จ', employee: { id: updated.id, status: updated.status ?? updated.employeeStatus } });
  } catch (err) {
    console.error('❌ toggleEmployeeStatus error:', err);
    res.status(500).json({ message: 'เปลี่ยนสถานะพนักงานล้มเหลว' });
  }
};

const getEmployeeById = getEmployeesById;

module.exports = {
  getAllEmployees,
  getEmployeesById,
  getEmployeeById,
  createEmployees,
  updateEmployees,
  deleteEmployees,
  getUsersByRole,
  approveEmployee,
  approveEmployeeAlias, // ⬅️ ใช้กับ path /employees/approve-employee ได้
  getAllPositions,
  getBranchDropdowns,
  updateUserRole,
  toggleEmployeeStatus,
};







