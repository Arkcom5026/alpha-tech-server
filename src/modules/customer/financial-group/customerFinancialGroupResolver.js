'use strict';

const SUPPORTED_TYPES = new Set(['ORGANIZATION', 'GOVERNMENT']);

const normalizeLegalText = (value) => String(value || '')
  .normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('th-TH');
const normalizeTaxId = (value) => String(value || '').replace(/[^0-9a-z]/gi, '').toLowerCase();

const groupError = (code, message, statusCode = 409) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const sameLegalIdentity = (left, right) => (
  normalizeLegalText(left?.companyName) === normalizeLegalText(right?.companyName)
  && normalizeTaxId(left?.taxId) === normalizeTaxId(right?.taxId)
);

async function resolveFinancialCustomerGroup(client, { customerId, branchId }) {
  const id = Number(customerId);
  const branch = Number(branchId);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(branch) || branch <= 0) {
    throw groupError('INVALID_FINANCIAL_GROUP_CONTEXT', 'Valid customer and branch are required', 400);
  }
  // Keeps lightweight repository/unit adapters backward compatible; the real Prisma client always exposes this model.
  if (!client?.customerProfile?.findFirst || !client?.customerProfile?.findMany) {
    const standalone = { id, branchId: branch, financialOwnerCustomerId: null };
    return { owner: standalone, ownerId: id, members: [standalone], memberIds: [id], selectedCustomer: standalone };
  }
  const selected = await client.customerProfile.findFirst({ where: { id, branchId: branch } });
  if (!selected) throw groupError('CUSTOMER_FINANCIAL_GROUP_NOT_FOUND', 'Customer is not available in this branch', 404);
  const ownerId = selected.financialOwnerCustomerId || selected.id;
  const owner = ownerId === selected.id ? selected : await client.customerProfile.findFirst({
    where: { id: ownerId, branchId: branch, financialOwnerCustomerId: null },
  });
  if (!owner) throw groupError('INVALID_FINANCIAL_OWNER', 'Financial owner must be a root in the same branch');
  if (selected.financialOwnerCustomerId && (
    !SUPPORTED_TYPES.has(selected.type) || selected.type !== owner.type || !sameLegalIdentity(selected, owner)
  )) throw groupError('FINANCIAL_GROUP_IDENTITY_CONFLICT', 'Financial group identity is inconsistent');
  const members = await client.customerProfile.findMany({
    where: { branchId: branch, OR: [{ id: owner.id }, { financialOwnerCustomerId: owner.id }] },
    orderBy: { id: 'asc' },
  });
  if (members.some((member) => member.branchId !== branch || member.type !== owner.type || !sameLegalIdentity(member, owner))) {
    throw groupError('FINANCIAL_GROUP_IDENTITY_CONFLICT', 'Financial group members are inconsistent');
  }
  return { owner, ownerId: owner.id, members, memberIds: members.map((member) => member.id), selectedCustomer: selected };
}

async function validateFinancialOwnerLink(client, { customer, ownerId, branchId }) {
  if (ownerId == null) return null;
  const normalizedOwnerId = Number(ownerId);
  if (normalizedOwnerId === Number(customer.id)) throw groupError('FINANCIAL_GROUP_CYCLE', 'Customer cannot own itself');
  if (!SUPPORTED_TYPES.has(customer.type)) throw groupError('FINANCIAL_GROUP_TYPE_UNSUPPORTED', 'Only organization and government customers can be linked');
  const owner = await client.customerProfile.findFirst({ where: { id: normalizedOwnerId, branchId: Number(branchId) } });
  if (!owner) throw groupError('FINANCIAL_OWNER_NOT_FOUND', 'Financial owner is not available in this branch', 404);
  if (owner.financialOwnerCustomerId) throw groupError('FINANCIAL_GROUP_CHAIN_FORBIDDEN', 'Financial owner must be a root');
  if (owner.type !== customer.type || !sameLegalIdentity(customer, owner)) {
    throw groupError('FINANCIAL_GROUP_IDENTITY_MISMATCH', 'Financial owner must have the same type and legal identity');
  }
  return owner;
}

module.exports = { SUPPORTED_TYPES, normalizeLegalText, normalizeTaxId, sameLegalIdentity, resolveFinancialCustomerGroup, validateFinancialOwnerLink };
