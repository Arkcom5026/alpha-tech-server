const { prisma } = require('../../../../lib/prisma');
const {
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

const presentUpdatedCustomer = (customer, { includePostcode = true } = {}) => {
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

    return res.json(presentUpdatedCustomer(full, { includePostcode: false }));
  } catch (error) {
    if (error && error.message === 'INVALID_PHONE') {
      return res.status(400).json({ message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' });
    }
    console.error('❌ updateCustomerProfileOnline error:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
};

module.exports = {
  updateCustomerProfileOnline,
};
