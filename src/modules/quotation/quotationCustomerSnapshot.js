'use strict';

const text = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const buildCustomerFullAddress = (customer = {}) => {
  const subdistrict = customer?.subdistrict || null;
  const district = subdistrict?.district || null;
  const province = district?.province || null;

  return [
    text(customer?.addressDetail),
    text(subdistrict?.nameTh) ? `ต.${text(subdistrict.nameTh)}` : '',
    text(district?.nameTh) ? `อ.${text(district.nameTh)}` : '',
    text(province?.nameTh) ? `จ.${text(province.nameTh)}` : '',
    text(subdistrict?.postcode),
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || null;
};

const customerFields = (snapshot) => {
  if (!snapshot) return {};
  return {
    customerName: snapshot.name || null,
    customerCompany: snapshot.companyName || null,
    customerDepartment: snapshot.departmentName || null,
    customerContactName: snapshot.name || null,
    customerPhone: snapshot.user?.loginId || null,
    customerTaxId: snapshot.taxId || null,
    customerAddress: buildCustomerFullAddress(snapshot),
    paymentTerms: snapshot.paymentTerms ? `${snapshot.paymentTerms} วัน` : null,
    customerSnapshot: snapshot,
  };
};

module.exports = Object.freeze({
  buildCustomerFullAddress,
  customerFields,
});
