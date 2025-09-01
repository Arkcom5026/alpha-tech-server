// prisma/seed.js — Node.js (CommonJS)
// - เพิ่ม superadmin
// - ปรับลำดับลบข้อมูลให้ปลอดภัย (optional ผ่าน env)
// - ใช้ upsert เพื่อรันซ้ำได้โดยไม่พัง

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const CLEAR_ALL = String(process.env.CLEAR_ALL).toLowerCase() === 'true';

async function ensureBranch(name, address) {
  const found = await prisma.branch.findFirst({ where: { name } });
  if (found) return found;
  return prisma.branch.create({ data: { name, address } });
}

async function ensurePosition(name) {
  const found = await prisma.position.findFirst({ where: { name } });
  if (found) return found;
  return prisma.position.create({ data: { name } });
}

async function upsertUser({ email, passwordPlain, role, enabled = true, employee, customer }) {
  const password = await bcrypt.hash(passwordPlain, 10);
  // ถ้า unique โดย email
  const existed = await prisma.user.findUnique({ where: { email } });
  if (existed) {
    return prisma.user.update({
      where: { email },
      data: {
        password,
        role,
        enabled,
        // อัปเดตโปรไฟล์แบบเบา ๆ ถ้ามี
        ...(employee ? { employeeProfile: { upsert: { update: employee, create: employee } } } : {}),
        ...(customer ? { customerProfile: { upsert: { update: customer, create: customer } } } : {}),
      },
    });
  }
  return prisma.user.create({
    data: {
      email,
      password,
      role,
      enabled,
      ...(employee ? { employeeProfile: { create: employee } } : {}),
      ...(customer ? { customerProfile: { create: customer } } : {}),
    },
  });
}

async function main() {
  if (CLEAR_ALL) {
    console.warn('⚠️  CLEAR_ALL=true → ลบข้อมูลที่เกี่ยวข้องก่อน seed');
    // ลบตามลำดับความสัมพันธ์ (child → parent)
    await prisma.customerProfile.deleteMany();
    await prisma.employeeProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.branch.deleteMany();
    await prisma.position.deleteMany();
  }

  const branch = await ensureBranch('สำนักงานใหญ่', '123 ถนนหลัก แขวงกลางเมือง เขตเมืองหลวง');
  const position = await ensurePosition('ผู้ดูแลระบบ');

  // 👑 superadmin
  await upsertUser({
    email: 'root@yourdomain.com',
    passwordPlain: 'admin1234',
    role: 'superadmin', // ✅ enum ใหม่
    enabled: true,
    employee: {
      name: 'Root Superadmin',
      phone: '0900000000',
      branchId: branch.id,
      positionId: position.id,
    },
  });

  // 👨‍💼 admin (employee)
  await upsertUser({
    email: 'admin@example.com',
    passwordPlain: '123456',
    role: 'admin',
    enabled: true,
    employee: {
      name: 'แอดมินระบบ',
      phone: '0999999999',
      branchId: branch.id,
      positionId: position.id,
    },
  });

  // 🧑‍💼 customer
  await upsertUser({
    email: 'customer@example.com',
    passwordPlain: '654321',
    role: 'customer',
    enabled: true,
    customer: {
      name: 'ลูกค้าทดสอบ',
      phone: '0888888888',
      address: '456 ถนนลูกค้า แขวงประชาชน',
    },
  });

  console.log('✅ Seed สำเร็จ (superadmin/admin/customer)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
