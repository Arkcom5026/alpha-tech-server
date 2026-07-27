const intakeSearchRepository = require('./intakeSearchRepository');
const { validateSearchQuery } = require('../../validators/repairValidator');

const normalize = (value) => String(value || '').trim().toLocaleLowerCase('th-TH');

const projectCustomer = (customer) => ({
  id: customer.id,
  name: customer.name || '',
  companyName: customer.companyName || '',
  phone: customer.user?.loginId || '',
  email: customer.user?.email || '',
  taxId: customer.taxId || '',
  type: customer.type || 'INDIVIDUAL',
  addressDetail: customer.addressDetail || '',
});

const projectDevice = (device, query) => {
  const sale = device.saleItems?.[0]?.sale || null;
  const exactIdentifierMatch = [device.barcode, device.serialNumber, device.tag]
    .filter(Boolean)
    .some((value) => normalize(value) === normalize(query));

  return {
    sourceType: 'STOCK_ITEM',
    id: device.id,
    barcode: device.barcode,
    serialNumber: device.serialNumber,
    serviceTag: device.tag,
    imei: null,
    status: device.status,
    exactIdentifierMatch,
    product: device.product,
    latestCustomer: sale?.customer
      ? {
          id: sale.customer.id,
          name: sale.customer.name || '',
          companyName: sale.customer.companyName || '',
          phone: sale.customer.user?.loginId || '',
          email: sale.customer.user?.email || '',
        }
      : null,
    latestRepairJob: null,
    soldAt: sale?.soldAt || null,
  };
};

const projectRegisteredDevice = (device, query) => {
  const exactIdentifierMatch = [device.barcode, device.serialNumber, device.imei]
    .filter(Boolean)
    .some((value) => normalize(value) === normalize(query));
  const owner = device.currentOwner;
  const latestRepairJob = device.repairJobs?.[0] || null;

  return {
    sourceType: 'REGISTERED_DEVICE',
    id: device.id,
    barcode: device.barcode,
    serialNumber: device.serialNumber,
    serviceTag: null,
    imei: device.imei,
    status: device.status,
    category: device.category,
    brand: device.brand,
    model: device.model,
    exactIdentifierMatch,
    product: {
      id: null,
      name: device.model || device.category || 'อุปกรณ์ลงทะเบียน',
      brand: device.brand ? { id: null, name: device.brand } : null,
      productType: null,
    },
    latestCustomer: owner
      ? {
          id: owner.id,
          name: owner.name || '',
          companyName: owner.companyName || '',
          phone: owner.user?.loginId || '',
          email: owner.user?.email || '',
        }
      : null,
    latestRepairJob,
    soldAt: null,
  };
};

class IntakeSearchService {
  constructor(repository = intakeSearchRepository) {
    this.repository = repository;
  }

  async execute(actor, rawQuery) {
    const query = validateSearchQuery(rawQuery);
    const result = await this.repository.search(actor.branchId, query, 10);
    const devices = [
      ...(result.devices || []).map((device) => projectDevice(device, query)),
      ...(result.registeredDevices || []).map((device) =>
        projectRegisteredDevice(device, query)
      ),
    ].sort((a, b) => Number(b.exactIdentifierMatch) - Number(a.exactIdentifierMatch));
    const customers = (result.customers || []).map(projectCustomer);

    return {
      query,
      devices,
      customers,
      counts: {
        devices: devices.length,
        customers: customers.length,
        total: devices.length + customers.length,
      },
    };
  }
}

module.exports = new IntakeSearchService();
module.exports.IntakeSearchService = IntakeSearchService;
module.exports.projectDevice = projectDevice;
module.exports.projectRegisteredDevice = projectRegisteredDevice;
module.exports.projectCustomer = projectCustomer;
