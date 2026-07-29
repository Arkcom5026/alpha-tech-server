const { prisma } = require('../../../../lib/prisma');
const {
  toInt,
  normalizePhone,
  isValidPhone,
  buildCustomerAddress,
} = require('../shared/customerControllerSupport');

const includeStoreCustomerAddress = {
  subdistrict: { include: { district: { include: { province: true } } } },
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
    phone: customer.phone || null,
    email: customer.email || '',
    type: customer.type,
    companyName: customer.companyName,
    taxId: customer.taxId,
    provinceCode,
    districtCode,
    subdistrictCode,
    addressDetail: customer.addressDetail || null,
    postcode: customer.subdistrict?.postcode || null,
    customerAddress: buildCustomerAddress(customer),
    creditLimit: customer.creditLimit,
    creditBalance: 0,
  };
};

const createCustomer = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) {
      return res.status(401).json({ message: 'Unauthorized (missing branchId)' });
    }

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
    const normalizedPhone = normalizePhone(phone);
    const displayName = typeof name === 'string' ? name.trim() : '';

    if (!displayName || !isValidPhone(normalizedPhone)) {
      return res.status(400).json({ error: 'ต้องระบุชื่อและเบอร์โทร (10 หลัก)' });
    }

    const existingCustomer = await prisma.storeCustomer.findFirst({
      where: {
        branchId,
        active: true,
        phone: normalizedPhone,
      },
      include: includeStoreCustomerAddress,
    });

    if (existingCustomer) {
      return res.json(presentStoreCustomer(existingCustomer));
    }

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

    const result = await prisma.storeCustomer.create({
      data: {
        branchId,
        displayName,
        phone: normalizedPhone,
        email: typeof email === 'string' && email.trim() ? email.trim() : null,
        type: type || 'INDIVIDUAL',
        companyName: companyName || null,
        taxId: taxId || null,
        addressDetail: typeof addressDetail === 'string' ? addressDetail.trim() : null,
        ...(subdistrictCode ? { subdistrictCode } : {}),
      },
      include: includeStoreCustomerAddress,
    });

    return res.status(201).json(presentStoreCustomer(result));
  } catch (err) {
    console.error('❌ createCustomer error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างลูกค้า' });
  }
};

module.exports = { createCustomer };
