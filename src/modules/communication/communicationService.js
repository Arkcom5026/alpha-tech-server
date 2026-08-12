const prisma = require('../../database/prisma/client');
const AppError = require('../../shared/errors/AppError');

const CHANNEL_TYPES = new Set(['PHONE', 'SMS', 'EMAIL', 'LINE', 'FACEBOOK', 'OTHER']);
const CONSENT_STATUSES = new Set(['UNKNOWN', 'GRANTED', 'REVOKED']);
const ACTIVITY_TYPES = new Set(['CALL', 'MESSAGE', 'RECEIPT_SENT', 'STATUS_SENT', 'CUSTOMER_REPLY', 'NOTE']);
const DIRECTIONS = new Set(['OUTBOUND', 'INBOUND', 'INTERNAL']);

const positiveId = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new AppError(`${field} is invalid`, 400);
  return parsed;
};
const text = (value, field, required = false) => {
  const normalized = String(value || '').trim();
  if (required && !normalized) throw new AppError(`${field} is required`, 400);
  if (normalized.length > 500) throw new AppError(`${field} is too long`, 400);
  return normalized || null;
};
const channelType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!CHANNEL_TYPES.has(normalized)) throw new AppError('channelType is invalid', 400);
  return normalized;
};

class CommunicationService {
  constructor(client = prisma) { this.prisma = client; }

  listProfiles(branchId) {
    return this.prisma.communicationProfile.findMany({ where: { branchId }, orderBy: [{ enabled: 'desc' }, { displayName: 'asc' }] });
  }

  saveProfile(branchId, input = {}) {
    const type = channelType(input.channelType);
    const displayName = text(input.displayName, 'displayName', true);
    return this.prisma.communicationProfile.upsert({
      where: { branchId_channelType_displayName: { branchId, channelType: type, displayName } },
      create: { branchId, channelType: type, displayName, address: text(input.address, 'address'), publicUri: text(input.publicUri, 'publicUri'), qrPayload: text(input.qrPayload, 'qrPayload'), integrationRef: text(input.integrationRef, 'integrationRef'), enabled: input.enabled !== false },
      update: { address: text(input.address, 'address'), publicUri: text(input.publicUri, 'publicUri'), qrPayload: text(input.qrPayload, 'qrPayload'), integrationRef: text(input.integrationRef, 'integrationRef'), enabled: input.enabled !== false },
    });
  }

  async listCustomerChannels(branchId, customerIdInput) {
    const customerId = positiveId(customerIdInput, 'customerId');
    const customer = await this.prisma.customerProfile.findFirst({ where: { id: customerId, branchId } });
    if (!customer) throw new AppError('Customer not found in this branch', 404);
    return this.prisma.customerContactChannel.findMany({ where: { branchId, customerId, active: true }, orderBy: { createdAt: 'asc' } });
  }

  async saveCustomerChannel(branchId, customerIdInput, input = {}) {
    const customerId = positiveId(customerIdInput, 'customerId');
    const customer = await this.prisma.customerProfile.findFirst({ where: { id: customerId, branchId } });
    if (!customer) throw new AppError('Customer not found in this branch', 404);
    const type = channelType(input.channelType);
    const address = text(input.address, 'address', true);
    const consentStatus = String(input.consentStatus || 'UNKNOWN').toUpperCase();
    if (!CONSENT_STATUSES.has(consentStatus)) throw new AppError('consentStatus is invalid', 400);
    return this.prisma.customerContactChannel.upsert({
      where: { branchId_customerId_channelType_address: { branchId, customerId, channelType: type, address } },
      create: { branchId, customerId, channelType: type, address, displayLabel: text(input.displayLabel, 'displayLabel'), consentStatus, active: true },
      update: { displayLabel: text(input.displayLabel, 'displayLabel'), consentStatus, active: true },
    });
  }

  async getPreference(branchId, repairJobIdInput) {
    const repairJobId = positiveId(repairJobIdInput, 'repairJobId');
    return this.prisma.repairCommunicationPreference.findFirst({ where: { branchId, repairJobId }, include: { contactChannel: true, profile: true } });
  }

  async savePreference(branchId, repairJobIdInput, input = {}) {
    const repairJobId = positiveId(repairJobIdInput, 'repairJobId');
    const job = await this.prisma.repairJob.findFirst({ where: { id: repairJobId, branchId }, select: { id: true, customerId: true } });
    if (!job) throw new AppError('Repair job not found in this branch', 404);
    const type = channelType(input.channelType);
    const contactChannelId = input.contactChannelId ? positiveId(input.contactChannelId, 'contactChannelId') : null;
    const profileId = input.profileId ? positiveId(input.profileId, 'profileId') : null;
    let contactChannel = null;
    if (contactChannelId) {
      contactChannel = await this.prisma.customerContactChannel.findFirst({ where: { id: contactChannelId, branchId, customerId: job.customerId, active: true } });
      if (!contactChannel || contactChannel.channelType !== type) throw new AppError('Contact channel is not available for this repair', 409);
    }
    if (profileId) {
      const profile = await this.prisma.communicationProfile.findFirst({ where: { id: profileId, branchId, enabled: true } });
      if (!profile || profile.channelType !== type) throw new AppError('Communication profile is not available in this branch', 409);
    }
    const data = { branchId, repairJobId, channelType: type, contactChannelId, profileId, destinationSnapshot: text(input.destinationSnapshot || contactChannel?.address, 'destinationSnapshot'), displayLabelSnapshot: text(input.displayLabelSnapshot || contactChannel?.displayLabel, 'displayLabelSnapshot'), consentGranted: input.consentGranted === true };
    return this.prisma.repairCommunicationPreference.upsert({ where: { repairJobId }, create: data, update: data, include: { contactChannel: true, profile: true } });
  }

  async listRepairActivities(branchId, repairJobIdInput) {
    const repairJobId = positiveId(repairJobIdInput, 'repairJobId');
    const job = await this.prisma.repairJob.findFirst({ where: { id: repairJobId, branchId }, select: { id: true } });
    if (!job) throw new AppError('Repair job not found in this branch', 404);
    return this.prisma.repairCommunicationActivity.findMany({ where: { branchId, repairJobId }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] });
  }

  async recordRepairActivity(branchId, repairJobIdInput, actorEmployeeIdInput, input = {}) {
    const repairJobId = positiveId(repairJobIdInput, 'repairJobId');
    const actorEmployeeId = positiveId(actorEmployeeIdInput, 'actorEmployeeId');
    const job = await this.prisma.repairJob.findFirst({ where: { id: repairJobId, branchId }, select: { id: true } });
    if (!job) throw new AppError('Repair job not found in this branch', 404);
    const activityType = String(input.activityType || '').trim().toUpperCase();
    const direction = String(input.direction || 'OUTBOUND').trim().toUpperCase();
    if (!ACTIVITY_TYPES.has(activityType)) throw new AppError('activityType is invalid', 400);
    if (!DIRECTIONS.has(direction)) throw new AppError('direction is invalid', 400);
    return this.prisma.repairCommunicationActivity.create({ data: {
      branchId, repairJobId, actorEmployeeId, channelType: channelType(input.channelType), direction, activityType,
      destinationSnapshot: text(input.destinationSnapshot, 'destinationSnapshot'), note: text(input.note, 'note'),
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
    } });
  }
}

module.exports = new CommunicationService();
module.exports.CommunicationService = CommunicationService;
