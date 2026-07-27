const intakeSearchRepository = require('./intakeSearchRepository');
const { validateLookup } = require('../../validators/repairValidator');

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
    id: device.id,
    barcode: device.barcode,
    serialNumber: device.serialNumber,
    serviceTag: device.tag,
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
    soldAt: sale?.soldAt || null,
  };
};

class IntakeSearchService {
  constructor(repository = intakeSearchRepository) {
    this.repository = repository;
  }

  async execute(actor, rawQuery) {
    const query = validateLookup(rawQuery);
    const result = await this.repository.search(actor.branchId, query, 10);
    const devices = (result.devices || [])
      .map((device) => projectDevice(device, query))
      .sort((a, b) => Number(b.exactIdentifierMatch) - Number(a.exactIdentifierMatch));
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
module.exports.projectCustomer = projectCustomer;
