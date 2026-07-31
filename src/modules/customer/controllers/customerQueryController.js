const { prisma } = require('../../../../lib/prisma');
const {
  toInt,
  buildCustomerAddress,
} = require('../shared/customerControllerSupport');

const includeAddress = {
  user: true,
  subdistrict: { include: { district: { include: { province: true } } } },
};

const presentCustomer = (customer, { includeCredit = true, includeType = true } = {}) => {
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

const getCustomerByName = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'Unauthorized (missing branchId)' });

    const q = String(req.query?.q || '').trim();
    if (!q) return res.json([]);

    const customers = await prisma.customerProfile.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
        sale: { some: { branchId } },
      },
      take: 10,
      include: includeAddress,
    });

    return res.json(customers.map((customer) => presentCustomer(customer)));
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
      include: includeAddress,
    });

    if (!customer) return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });
    return res.json(presentCustomer(customer, { includeCredit: false, includeType: false }));
  } catch (err) {
    console.error('❌ getCustomerByUserId error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า' });
  }
}

module.exports = {
  getCustomerByName,
  getCustomerByUserId,
};
