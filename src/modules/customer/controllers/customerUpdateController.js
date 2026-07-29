const { prisma } = require('../../../../lib/prisma');
const {
  toInt,
  omitUndefined,
  normalizePhone,
  isValidPhone,
  buildCustomerAddress,
} = require('../shared/customerControllerSupport');

const validateCustomerType = (type) => {
  if (typeof type === 'undefined') return true;
  return new Set(['INDIVIDUAL', 'ORGANIZATION', 'GOVERNMENT']).has(type);
};

const validateSubdistrictPostcode = async ({ subdistrictCode, clientPostcode }) => {
  if (typeof subdistrictCode !== 'string' || !subdistrictCode) return null;

  const subdistrict = await prisma.subdistrict.findUnique({
    where: { code: subdistrictCode },
    select: { postcode: true },
  });

  if (!subdistrict) return { status: 400, body: { message: 'รหัสตำบลไม่ถูกต้อง' } };
  if (clientPostcode && String(subdistrict.postcode) !== clientPostcode) {
    return {
      status: 400,
      body: {
        message: 'รหัสไปรษณีย์ไม่ตรงกับตำบลที่เลือก',
        expectedPostcode: subdistrict.postcode,
      },
    };
  }

  return null;
};

const presentStoreCustomer = (customer) => {
  const subdistrictCode = customer.subdistrict?.code || null;
  const districtCode =
    customer.subdistrict?.districtCode || customer.subdistrict?.district?.code || null;
  const provinceCode =
    customer.subdistrict?.district?.provinceCode ||
    customer.subdistrict?.district?.province?.code ||
    null;

  return {
    id: customer.id,
    name: customer.displayName,
    type: customer.type,
    companyName: customer.companyName,
    taxId: customer.taxId,
    provinceCode,
    districtCode,
    subdistrictCode,
    addressDetail: customer.addressDetail,
    postcode: customer.subdistrict?.postcode || null,
    customerAddress: buildCustomerAddress(customer),
    phone: customer.phone || null,
    email: customer.email || '',
    creditLimit: customer.creditLimit,
    creditBalance: 0,
  };
};

const presentLegacyCustomer = (customer, { includePostcode = true } = {}) => {
  const subdistrictCode = customer.subdistrict?.code || null;
  const districtCode =
    customer.subdistrict?.districtCode || customer.subdistrict?.district?.code || null;
  const provinceCode =
    customer.subdistrict?.district?.provinceCode ||
    customer.subdistrict?.district?.province?.code ||
    null;

  return {
    id: customer.id,
    name: customer.name,
    type: customer.type,
    companyName: customer.companyName,
    taxId: customer.taxId,
    provinceCode,
    districtCode,
    subdistrictCode,
    addressDetail: customer.addressDetail,
    ...(includePostcode ? { postcode: customer.subdistrict?.postcode || null } : {}),
    customerAddress: buildCustomerAddress(customer),
    phone: customer.user?.loginId || null,
    email: '',
  };
};

const updateCustomerProfile = async (req, res) => {
  try {
    const userContext = req.user || {};
    const role = userContext.role || '';
    const branchId = toInt(userContext.branchId);

    if (!userContext.id) return res.status(401).json({ message: 'Unauthorized' });
    if (!['SUPERADMIN', 'ADMIN', 'EMPLOYEE'].includes(role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (!branchId) return res.status(401).json({ message: 'Unauthorized (missing branchId)' });

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'รหัสลูกค้าไม่ถูกต้อง' });

    const {
      name,
      phone,
      email,
      type,
      companyName,
      taxId,
      subdistrictCode,
      addressDetail,
    } = req.body ?? {};

    if (!validateCustomerType(type)) {
      return res.status(400).json({ message: 'ประเภทลูกค้าไม่ถูกต้อง' });
    }

    const existing = await prisma.storeCustomer.findFirst({
      where: {
        id,
        branchId,
        active: true,
      },
    });
    if (!existing) return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });

    const sanitizedPhone =
      typeof phone === 'undefined' ? undefined : normalizePhone(phone);
    if (typeof sanitizedPhone !== 'undefined' && !isValidPhone(sanitizedPhone)) {
      return res.status(400).json({ message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' });
    }

    const sanitize = (value) => (typeof value === 'string' ? value.trim() : value);
    const updateData = Object.fromEntries(
      Object.entries({
        displayName: sanitize(name),
        phone: sanitizedPhone,
        email: sanitize(email),
        type,
        companyName: sanitize(companyName),
        taxId: sanitize(taxId),
        addressDetail: sanitize(addressDetail),
      }).filter(([, value]) => value !== undefined)
    );

    const clientPostcode =
      req.body?.postalCode ?? req.body?.postcode
        ? String(req.body?.postalCode ?? req.body?.postcode)
        : undefined;
    const postcodeError = await validateSubdistrictPostcode({
      subdistrictCode,
      clientPostcode,
    });
    if (postcodeError) return res.status(postcodeError.status).json(postcodeError.body);

    await prisma.storeCustomer.update({
      where: { id },
      data: {
        ...updateData,
        ...(subdistrictCode !== undefined
          ? { subdistrictCode: subdistrictCode || null }
          : {}),
      },
    });

    const full = await prisma.storeCustomer.findFirst({
      where: {
        id,
        branchId,
        active: true,
      },
      include: {
        subdistrict: { include: { district: { include: { province: true } } } },
      },
    });

    return res.json(presentStoreCustomer(full));
  } catch (error) {
    if (error && error.code === 'P2002') {
      return res.status(409).json({ message: 'ข้อมูลซ้ำกัน' });
    }
    console.error('❌ updateCustomerProfile error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตลูกค้า' });
  }
};

const updateCustomerProfileOnline = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'CUSTOMER') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { name, phone, type, companyName, taxId, subdistrictCode, addressDetail } =
      req.body ?? {};

    if (!validateCustomerType(type)) {
      return res.status(400).json({ message: 'ประเภทลูกค้าไม่ถูกต้อง' });
    }

    const profileData = omitUndefined({
      name,
      type,
      companyName,
      taxId,
      addressDetail,
    });

    const clientPostcode =
      req.body?.postalCode ?? req.body?.postcode
        ? String(req.body?.postalCode ?? req.body?.postcode)
        : undefined;
    const postcodeError = await validateSubdistrictPostcode({
      subdistrictCode,
      clientPostcode,
    });
    if (postcodeError) return res.status(postcodeError.status).json(postcodeError.body);

    const existing = await prisma.customerProfile.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const profile = existing
        ? await tx.customerProfile.update({
            where: { id: existing.id },
            data: {
              ...profileData,
              ...(subdistrictCode !== undefined
                ? { subdistrictCode: subdistrictCode || null }
                : {}),
            },
          })
        : await tx.customerProfile.create({
            data: {
              userId: user.id,
              ...profileData,
              ...(subdistrictCode ? { subdistrictCode } : {}),
            },
          });

      if (phone) {
        const newPhone = normalizePhone(phone);
        if (!isValidPhone(newPhone)) throw new Error('INVALID_PHONE');
        await tx.user.update({ where: { id: user.id }, data: { loginId: newPhone } });
      }

      return profile;
    });

    const full = await prisma.customerProfile.findUnique({
      where: { id: updated.id },
      include: {
        user: true,
        subdistrict: { include: { district: { include: { province: true } } } },
      },
    });

    return res.json(presentLegacyCustomer(full, { includePostcode: false }));
  } catch (error) {
    if (error && error.message === 'INVALID_PHONE') {
      return res.status(400).json({ message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' });
    }
    console.error('❌ updateCustomerProfileOnline error:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
};

module.exports = {
  updateCustomerProfile,
  updateCustomerProfileOnline,
};
