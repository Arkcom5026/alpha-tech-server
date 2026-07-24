// ✅ @filename: server/controllers/employeeController.js
const { prisma } = require('../lib/prisma');

const toInt = (value) => (
  value === undefined || value === null || value === ''
    ? undefined
    : parseInt(value, 10)
);

const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const isSuperAdmin = (actor = {}) => !!actor.isSuperAdmin || normalizeRole(actor.role) === 'superadmin';
const isStaffRole = (role) => new Set(['superadmin', 'admin', 'employee']).has(normalizeRole(role));

const toPrismaRole = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === 'supperadmin' || normalized === 'superadmin') return 'SUPERADMIN';
  if (normalized === 'admin') return 'ADMIN';
  if (normalized === 'employee') return 'EMPLOYEE';
  if (normalized === 'customer') return 'CUSTOMER';
  return null;
};

const projectEmployeeStatus = (employee) => {
  if (!employee?.approved) return 'pending';
  return employee.active ? 'active' : 'inactive';
};

const statusWhere = (status) => {
  switch (String(status || '').trim().toLowerCase()) {
    case 'pending':
      return { approved: false };
    case 'active':
      return { approved: true, active: true };
    case 'inactive':
      return { approved: true, active: false };
    default:
      return {};
  }
};

const employeeProjection = (employee) => ({
  id: employee.id,
  userId: employee.userId,
  name: employee.name,
  phone: employee.phone,
  positionId: employee.positionId,
  branchId: employee.branchId,
  approved: employee.approved,
  active: employee.active,
  status: projectEmployeeStatus(employee),
  role: employee.user?.role ?? null,
  email: employee.user?.email ?? null,
  user: employee.user,
  position: employee.position,
  branch: employee.branch,
});

const resolveManagedBranchId = (actor, requestedBranchId) => {
  if (isSuperAdmin(actor)) return toInt(requestedBranchId);

  const actorBranchId = toInt(actor?.branchId);
  const mainBranchId = toInt(process.env.MAIN_BRANCH_ID);
  const isMainBranchEmployee = normalizeRole(actor?.role) === 'employee'
    && actorBranchId
    && mainBranchId
    && actorBranchId === mainBranchId;

  if (isMainBranchEmployee && toInt(requestedBranchId)) return toInt(requestedBranchId);
  return actorBranchId;
};

// GET /employees
const getAllEmployees = async (req, res) => {
  try {
    const actor = req.user || {};
    const actorBranchId = toInt(actor.branchId);
    const requestedBranchId = toInt(req.query.branchId);
    const q = String(req.query.q ?? req.query.search ?? '').trim();
    const role = req.query.role ? toPrismaRole(req.query.role) : null;
    const status = String(req.query.status || '').trim().toLowerCase();
    const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const filters = [];

    if (isSuperAdmin(actor)) {
      if (requestedBranchId) filters.push({ branchId: requestedBranchId });
    } else {
      filters.push({ branchId: actorBranchId || -1 });
    }

    if (q) {
      filters.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { user: { loginId: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    if (role) filters.push({ user: { role } });
    if (status && status !== 'all') filters.push(statusWhere(status));

    const where = filters.length ? { AND: filters } : {};
    const [itemsRaw, total] = await Promise.all([
      prisma.employeeProfile.findMany({
        where,
        include: { user: true, position: true, branch: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.employeeProfile.count({ where }),
    ]);

    return res.json({
      items: itemsRaw.map(employeeProjection),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('❌ getAllEmployees error:', error);
    return res.status(500).json({ message: 'ดึงรายชื่อพนักงานไม่สำเร็จ' });
  }
};

// GET /employees/:id
const getEmployeesById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const actor = req.user || {};
    const where = isSuperAdmin(actor)
      ? { id }
      : { id, branchId: toInt(actor.branchId) || -1 };

    const employee = await prisma.employeeProfile.findFirst({
      where,
      include: { user: true, position: true, branch: true },
    });

    if (!employee) return res.status(404).json({ message: 'ไม่พบพนักงานในขอบเขตที่อนุญาต' });
    return res.json(employeeProjection(employee));
  } catch (error) {
    console.error('❌ getEmployeeById error:', error);
    return res.status(500).json({ message: 'ดึงข้อมูลพนักงานไม่สำเร็จ' });
  }
};

// POST /employees — direct creation by an authorized staff actor
const createEmployees = async (req, res) => {
  try {
    const actor = req.user || {};
    if (!isStaffRole(actor.role) && !actor.isSuperAdmin) {
      return res.status(403).json({ message: 'FORBIDDEN_ROLE' });
    }

    const userId = toInt(req.body?.userId);
    const positionId = toInt(req.body?.positionId);
    const branchId = resolveManagedBranchId(actor, req.body?.branchId);
    const name = String(req.body?.name || '').trim();
    const phone = req.body?.phone ? String(req.body.phone).trim() : null;

    if (!userId || !positionId || !branchId || !name) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
    }

    const employee = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: 'EMPLOYEE', enabled: true },
      });

      return tx.employeeProfile.create({
        data: {
          userId,
          name,
          phone,
          branchId,
          positionId,
          approved: true,
          active: true,
        },
        include: { user: true, position: true, branch: true },
      });
    }, { timeout: 15000 });

    return res.status(201).json(employeeProjection(employee));
  } catch (error) {
    console.error('❌ createEmployees error:', error);
    return res.status(400).json({
      message: 'สร้างพนักงานไม่สำเร็จ',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// PUT /employees/:id
const updateEmployees = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const actor = req.user || {};
    const current = await prisma.employeeProfile.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: 'ไม่พบพนักงาน' });

    if (!isSuperAdmin(actor) && toInt(current.branchId) !== toInt(actor.branchId)) {
      return res.status(403).json({ message: 'FORBIDDEN_BRANCH' });
    }

    const updated = await prisma.employeeProfile.update({
      where: { id },
      data: {
        name: req.body?.name !== undefined ? String(req.body.name).trim() : current.name,
        phone: req.body?.phone !== undefined ? (req.body.phone || null) : current.phone,
        positionId: req.body?.positionId !== undefined ? toInt(req.body.positionId) : current.positionId,
      },
      include: { user: true, position: true, branch: true },
    });

    return res.json(employeeProjection(updated));
  } catch (error) {
    console.error('❌ updateEmployees error:', error);
    return res.status(400).json({ message: 'แก้ไขพนักงานล้มเหลว', error: error?.message || String(error) });
  }
};

// DELETE /employees/:id — physical deletion is intentionally forbidden
const deleteEmployees = async (_req, res) => res.status(405).json({
  code: 'EMPLOYEE_HARD_DELETE_DISABLED',
  message: 'ไม่อนุญาตให้ลบประวัติพนักงาน กรุณาเปลี่ยนสถานะเป็นไม่ใช้งานแทน',
});

// GET /employees/users/by-role
const getUsersByRole = async (req, res) => {
  try {
    const role = toPrismaRole(req.query?.role || 'customer') || 'CUSTOMER';
    const users = await prisma.user.findMany({
      where: { role },
      select: {
        id: true,
        email: true,
        loginId: true,
        role: true,
        enabled: true,
        employeeProfile: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    });

    return res.json(users.map((user) => ({
      ...user,
      name: user.employeeProfile?.name ?? null,
    })));
  } catch (error) {
    console.error('❌ getUsersByRole error:', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้' });
  }
};

const buildForbiddenMessage = (actor) => ({
  message: 'FORBIDDEN_ROLE',
  detail: { role: actor?.role ?? null, isSuperAdmin: !!actor?.isSuperAdmin },
});

// POST /employees/approve-employee
const approveEmployee = async (req, res) => {
  try {
    const actor = req.user || {};
    if (!isSuperAdmin(actor) && !isStaffRole(actor.role)) {
      return res.status(403).json(buildForbiddenMessage(actor));
    }

    const userId = toInt(req.body?.userId);
    const positionId = toInt(req.body?.positionId);
    const branchId = resolveManagedBranchId(actor, req.body?.branchId);
    const name = String(req.body?.name || '').trim();
    const phone = req.body?.phone ? String(req.body.phone).trim() : null;
    const requestedRole = req.body?.role ? toPrismaRole(req.body.role) : 'EMPLOYEE';

    if (!userId || !positionId || !branchId || !name || !requestedRole) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบหรือไม่ถูกต้อง' });
    }

    const employee = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: requestedRole, enabled: true },
      });

      return tx.employeeProfile.upsert({
        where: { userId },
        create: {
          userId,
          branchId,
          positionId,
          name,
          phone,
          approved: true,
          active: true,
        },
        update: {
          branchId,
          positionId,
          name,
          phone,
          approved: true,
          active: true,
        },
        include: { user: true, position: true, branch: true },
      });
    }, { timeout: 15000 });

    return res.json({
      message: 'อนุมัติพนักงานเรียบร้อยแล้ว',
      employee: employeeProjection(employee),
    });
  } catch (error) {
    console.error('❌ approveEmployee error:', error);
    return res.status(500).json({ message: 'ไม่สามารถอนุมัติพนักงานได้' });
  }
};

const approveEmployeeAlias = approveEmployee;

const getAllPositions = async (_req, res) => {
  try {
    const positions = await prisma.position.findMany({ orderBy: { name: 'asc' } });
    return res.json(positions);
  } catch (error) {
    console.error('❌ getAllPositions error:', error);
    return res.status(500).json({ message: 'โหลดตำแหน่งล้มเหลว' });
  }
};

const getBranchDropdowns = async (_req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return res.json(branches);
  } catch (error) {
    console.error('❌ getBranchDropdowns error:', error);
    return res.status(500).json({ message: 'โหลดสาขาล้มเหลว' });
  }
};

// PATCH /employees/roles/users/:userId/role
const updateUserRole = async (req, res) => {
  try {
    const actor = req.user || {};
    if (!isSuperAdmin(actor)) return res.status(403).json({ message: 'FORBIDDEN' });

    const userId = toInt(req.params.userId);
    const nextRole = toPrismaRole(req.body?.role);
    if (!userId) return res.status(400).json({ message: 'userId ไม่ถูกต้อง' });
    if (!nextRole || !['ADMIN', 'EMPLOYEE'].includes(nextRole)) {
      return res.status(400).json({ message: 'Allowed roles: admin หรือ employee เท่านั้น' });
    }

    const profile = await prisma.employeeProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ message: 'ไม่พบข้อมูลพนักงาน' });
    if (!profile.approved || !profile.active) {
      return res.status(400).json({ message: 'พนักงานต้องได้รับอนุมัติและอยู่ในสถานะใช้งานก่อนเปลี่ยน Role' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: nextRole },
    });

    return res.json({ message: 'Role updated', user: { id: updated.id, role: updated.role } });
  } catch (error) {
    console.error('[updateUserRole] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถเปลี่ยน Role ได้' });
  }
};

// PATCH /employees/:id/status
const toggleEmployeeStatus = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const actor = req.user || {};
    const employee = await prisma.employeeProfile.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ message: 'ไม่พบพนักงาน' });

    if (!isSuperAdmin(actor) && toInt(employee.branchId) !== toInt(actor.branchId)) {
      return res.status(403).json({ message: 'FORBIDDEN_BRANCH' });
    }

    let nextActive;
    if (typeof req.body?.active === 'boolean') {
      nextActive = req.body.active;
    } else if (['active', 'inactive'].includes(normalizeRole(req.body?.status))) {
      nextActive = normalizeRole(req.body.status) === 'active';
    } else {
      return res.status(400).json({ message: 'กรุณาระบุ active เป็น boolean หรือ status เป็น active/inactive' });
    }

    if (nextActive && !employee.approved) {
      return res.status(409).json({
        code: 'EMPLOYEE_NOT_APPROVED',
        message: 'ไม่สามารถเปิดใช้งานพนักงานที่ยังไม่ได้รับอนุมัติ',
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const profile = await tx.employeeProfile.update({
        where: { id },
        data: { active: nextActive },
        include: { user: true, position: true, branch: true },
      });

      await tx.user.update({
        where: { id: employee.userId },
        data: { enabled: nextActive },
      });

      return profile;
    }, { timeout: 15000 });

    return res.json({
      message: nextActive ? 'เปิดใช้งานพนักงานสำเร็จ' : 'ปิดใช้งานพนักงานสำเร็จ',
      employee: employeeProjection({
        ...updated,
        user: updated.user ? { ...updated.user, enabled: nextActive } : updated.user,
      }),
    });
  } catch (error) {
    console.error('❌ toggleEmployeeStatus error:', error);
    return res.status(500).json({ message: 'เปลี่ยนสถานะพนักงานล้มเหลว' });
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
  approveEmployeeAlias,
  getAllPositions,
  getBranchDropdowns,
  updateUserRole,
  toggleEmployeeStatus,
};
