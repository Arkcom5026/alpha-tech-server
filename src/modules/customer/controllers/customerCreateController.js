const bcrypt = require('bcryptjs');
const { prisma } = require('../../../../lib/prisma');
const {
  normalizePhone,
  isValidPhone,
  buildCustomerAddress,
} = require('../shared/customerControllerSupport');

const createCustomer = async (req, res) => {
  try {
    const { name, phone, type, companyName, taxId, subdistrictCode, addressDetail } =
      req.body ?? {};
    const normalizedPhone = normalizePhone(phone);

    if (!name || !isValidPhone(normalizedPhone)) {
      return res.status(400).json({ error: 'ต้องระบุชื่อและเบอร์โทร (10 หลัก)' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { loginId: normalizedPhone },
    });

    if (existingUser && existingUser.role !== 'CUSTOMER') {
      return res.status(409).json({ message: 'เบอร์นี้ถูกใช้ในบัญชีประเภทอื่นแล้ว' });
    }
    if (existingUser && existingUser.loginType && existingUser.loginType !== 'PHONE') {
      return res.status(409).json({ message: 'เบอร์นี้ถูกใช้กับวิธีล็อกอินอื่นแล้ว' });
    }

    if (existingUser) {
      const existingProfile = await prisma.customerProfile.findFirst({
        where: { userId: existingUser.id },
        include: {
          user: true,
          subdistrict: { include: { district: { include: { province: true } } } },
        },
      });

      if (existingProfile) {
        const subdistrictCodeValue = existingProfile.subdistrict?.code || null;
        const districtCode =
          existingProfile.subdistrict?.districtCode ||
          existingProfile.subdistrict?.district?.code ||
          null;
        const provinceCode =
          existingProfile.subdistrict?.district?.provinceCode ||
          existingProfile.subdistrict?.district?.province?.code ||
          null;

        return res.json({
          id: existingProfile.id,
          name: existingProfile.name,
          phone: existingProfile.user?.loginId || null,
          provinceCode,
          districtCode,
          subdistrictCode: subdistrictCodeValue,
          addressDetail: existingProfile.addressDetail || null,
          email: '',
          type: existingProfile.type,
          companyName: existingProfile.companyName,
          taxId: existingProfile.taxId,
          postcode: existingProfile.subdistrict?.postcode || null,
          creditLimit: existingProfile.creditLimit,
          creditBalance: existingProfile.creditBalance,
          customerAddress: buildCustomerAddress(existingProfile),
        });
      }
    }

    const rawPassword = normalizedPhone.slice(-4);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const clientPostcode =
      req.body?.postalCode ?? req.body?.postcode
        ? String(req.body?.postalCode ?? req.body?.postcode)
        : undefined;

    if (typeof subdistrictCode === 'string' && subdistrictCode) {
      const subdistrict = await prisma.subdistrict.findUnique({
        where: { code: subdistrictCode },
        select: { postcode: true },
      });
      if (!subdistrict) return res.status(400).json({ message: 'รหัสตำบลไม่ถูกต้อง' });
      if (clientPostcode && String(subdistrict.postcode) !== clientPostcode) {
        return res.status(400).json({
          message: 'รหัสไปรษณีย์ไม่ตรงกับตำบลที่เลือก',
          expectedPostcode: subdistrict.postcode,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = existingUser
        ? existingUser
        : await tx.user.create({
            data: {
              email: null,
              loginId: normalizedPhone,
              password: hashedPassword,
              role: 'CUSTOMER',
              loginType: 'PHONE',
            },
          });

      return tx.customerProfile.create({
        data: {
          name,
          userId: user.id,
          type: type || 'INDIVIDUAL',
          companyName: companyName || null,
          taxId: taxId || null,
          addressDetail: typeof addressDetail === 'string' ? addressDetail.trim() : null,
          ...(subdistrictCode ? { subdistrictCode } : {}),
        },
        include: {
          user: true,
          subdistrict: { include: { district: { include: { province: true } } } },
        },
      });
    });

    const finalSubdistrictCode = result.subdistrict?.code || null;
    const finalDistrictCode =
      result.subdistrict?.districtCode || result.subdistrict?.district?.code || null;
    const finalProvinceCode =
      result.subdistrict?.district?.provinceCode ||
      result.subdistrict?.district?.province?.code ||
      null;

    return res.status(201).json({
      id: result.id,
      name: result.name,
      phone: result.user?.loginId || null,
      email: '',
      type: result.type,
      companyName: result.companyName,
      taxId: result.taxId,
      provinceCode: finalProvinceCode,
      districtCode: finalDistrictCode,
      subdistrictCode: finalSubdistrictCode,
      addressDetail: result.addressDetail || null,
      postcode: result.subdistrict?.postcode || null,
      customerAddress: buildCustomerAddress(result),
      creditLimit: result.creditLimit,
      creditBalance: result.creditBalance,
    });
  } catch (err) {
    console.error('❌ createCustomer error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างลูกค้า' });
  }
};

module.exports = { createCustomer };
