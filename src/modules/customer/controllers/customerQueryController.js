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

const includeLegacyCustomerAddress = {
  user: true,
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
    provinceCode,
    districtCode,
    subdistrictCode,
    addressDetail: customer.addressDetail || null,
    email: customer.email || '',
    type: customer.type,
    companyName: customer.companyName,
    taxId: customer.taxId,
    postcode: customer.subdistrict?.postcode || null,
    creditLimit: customer.creditLimit,
    creditBalance: 0,
    customerAddress: buildCustomerAddress(customer),
  };
};

const presentLegacyCustomer = (customer, { includeCredit = true, includeType = true } = {}) => {
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
    phone: customer.user?.loginId || null,
    provinceCode,
    districtCode,
    subdistrictCode,
    addressDetail: customer.addressDetail || null,
    email: '',
    ...(includeType
      ? {
          type: customer.type,
          companyName: customer.companyName,
          taxId: customer.taxId,
        }
      : {
          companyName: customer.companyName,
          taxId: customer.taxId,
        }),
    postcode: customer.subdistrict?.postcode || null,
    ...(includeCredit
      ? {
          creditLimit: customer.creditLimit,
          creditBalance: customer.creditBalance,
        }
      : {}),
    customerAddress: buildCustomerAddress(customer),
  };
};

const getCustomerByPhone = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'Unauthorized (missing branchId)' });

    const phone = normalizePhone(req.params.phone);
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' });
    }

    const customer = await prisma.storeCustomer.findFirst({
      where: {
        branchId,
        active: true,
        phone,
      },
      include: includeStoreCustomerAddress,
    });

    if (!customer) return res.status(404).json({ message: 'ไม่พบลูกค้า' });
    return res.json(presentStoreCustomer(customer));
  } catch (err) {
    console.error('❌ getCustomerByPhone error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้า' });
  }
};

const getCustomerByName = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'Unauthorized (missing branchId)' });

    const q = String(req.query?.q || '').trim();
    if (!q) return res.json([]);

    const customers = await prisma.storeCustomer.findMany({
      where: {
        branchId,
        active: true,
        displayName: { contains: q, mode: 'insensitive' },
      },
      take: 10,
      include: includeStoreCustomerAddress,
    });

    return res.json(customers.map((customer) => presentStoreCustomer(customer)));
  } catch (err) {
    console.error('❌ getCustomerByName error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้า' });
  }
};

async function getCustomerByUserId(req, res) {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (role !== 'CUSTOMER') return res.status(403).json({ message: 'Forbidden' });

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      include: includeLegacyCustomerAddress,
    });

    if (!customer) return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });
    return res.json(presentLegacyCustomer(customer, { includeCredit: false, includeType: false }));
  } catch (err) {
    console.error('❌ getCustomerByUserId error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า' });
  }
}

module.exports = {
  getCustomerByPhone,
  getCustomerByName,
  getCustomerByUserId,
};
