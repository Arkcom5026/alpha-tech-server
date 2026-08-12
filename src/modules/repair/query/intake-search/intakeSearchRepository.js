const prisma = require('../../../../database/prisma/client');
const {
  buildCustomerBranchEvidence,
} = require('../../policies/repairCustomerBranchAccessPolicy');

const deviceSelect = {
  id: true,
  barcode: true,
  serialNumber: true,
  tag: true,
  status: true,
  branchId: true,
  product: {
    select: {
      id: true,
      name: true,
      brand: { select: { id: true, name: true } },
      productType: { select: { id: true, name: true } },
    },
  },
  saleItems: {
    take: 1,
    orderBy: { sale: { soldAt: 'desc' } },
    select: {
      sale: {
        select: {
          customerId: true,
          soldAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              companyName: true,
              departmentName: true,
              user: { select: { loginId: true, email: true } },
            },
          },
        },
      },
    },
  },
  repairJobs: {
    take: 1,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      jobNo: true,
      status: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          companyName: true,
          departmentName: true,
          user: { select: { loginId: true, email: true } },
        },
      },
    },
  },
  _count: { select: { repairJobs: true } },
};

const registeredDeviceSelect = {
  id: true,
  barcode: true,
  serialNumber: true,
  imei: true,
  category: true,
  brand: true,
  model: true,
  status: true,
  branchId: true,
  currentOwner: {
    select: {
      id: true,
      name: true,
      companyName: true,
      departmentName: true,
      user: { select: { loginId: true, email: true } },
    },
  },
  repairJobs: {
    take: 1,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      jobNo: true,
      status: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          companyName: true,
          departmentName: true,
          user: { select: { loginId: true, email: true } },
        },
      },
    },
  },
  _count: { select: { repairJobs: true } },
};

const customerSelect = {
  id: true,
  name: true,
  companyName: true,
  departmentName: true,
  taxId: true,
  type: true,
  addressDetail: true,
  user: { select: { loginId: true, email: true } },
};

const customerIdentityWhere = (insensitive) => ({
  OR: [
    { name: insensitive },
    { companyName: insensitive },
    { taxId: insensitive },
    { user: { loginId: insensitive } },
    { user: { email: insensitive } },
  ],
});

class IntakeSearchRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  async search(branchId, query, limit = 10) {
    const insensitive = { contains: query, mode: 'insensitive' };
    const normalizedBranchId = Number(branchId);
    const customerIdentity = customerIdentityWhere(insensitive);

    const [devices, registeredDevices, customers] = await Promise.all([
      this.prisma.stockItem.findMany({
        where: {
          branchId: normalizedBranchId,
          OR: [
            { barcode: insensitive },
            { serialNumber: insensitive },
            { tag: insensitive },
            { product: { name: insensitive } },
            { product: { brand: { name: insensitive } } },
            { saleItems: { some: { sale: { customer: customerIdentity } } } },
            { repairJobs: { some: { customer: customerIdentity } } },
          ],
        },
        select: deviceSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      this.prisma.device.findMany({
        where: {
          branchId: normalizedBranchId,
          stockItemId: null,
          OR: [
            { barcode: insensitive },
            { serialNumber: insensitive },
            { imei: insensitive },
            { brand: insensitive },
            { model: insensitive },
            { currentOwner: { is: customerIdentity } },
            { repairJobs: { some: { customer: customerIdentity } } },
          ],
        },
        select: registeredDeviceSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      this.prisma.customerProfile.findMany({
        where: {
          AND: [
            buildCustomerBranchEvidence(normalizedBranchId),
            customerIdentity,
          ],
        },
        select: customerSelect,
        orderBy: [{ companyName: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
    ]);

    return { devices, registeredDevices, customers };
  }
}

module.exports = new IntakeSearchRepository();
module.exports.IntakeSearchRepository = IntakeSearchRepository;
module.exports.customerIdentityWhere = customerIdentityWhere;
module.exports.deviceSelect = deviceSelect;
module.exports.registeredDeviceSelect = registeredDeviceSelect;
