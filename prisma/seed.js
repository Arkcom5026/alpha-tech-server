// ✅ seed.js — สร้าง User + CustomerProfile + EmployeeProfile
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function main() {
  // ✅ ล้างข้อมูลเก่าถ้าไม่ต้องการซ้ำ
  await prisma.user.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.employeeProfile.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.position.deleteMany();

  // ✅ สร้างตำแหน่งและสาขา
  const branch = await prisma.branch.create({
    data: {
      name: 'สำนักงานใหญ่',
      address: '123 ถนนหลัก แขวงกลางเมือง เขตเมืองหลวง'
    }
  });

  const position = await prisma.position.create({
    data: { name: 'ผู้ดูแลระบบ' }
  });

  // ✅ สร้างผู้ใช้แบบ Admin (Employee)
  const adminPassword = await bcrypt.hash('123456', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: adminPassword,
      role: 'admin',
      enabled: true,
      employeeProfile: {
        create: {
          name: 'แอดมินระบบ',
          phone: '0999999999',
          branchId: branch.id,
          positionId: position.id
        }
      }
    }
  });

  // ✅ สร้างผู้ใช้แบบลูกค้า
  const customerPassword = await bcrypt.hash('654321', 10);
  const customerUser = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      password: customerPassword,
      role: 'customer',
      enabled: true,
      customerProfile: {
        create: {
          name: 'ลูกค้าทดสอบ',
          phone: '0888888888',
          address: '456 ถนนลูกค้า แขวงประชาชน'
        }
      }
    }
  });

  console.log('✅ Seed สำเร็จ');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
