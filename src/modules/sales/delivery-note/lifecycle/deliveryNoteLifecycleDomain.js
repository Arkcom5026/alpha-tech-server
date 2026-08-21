'use strict';

const DELIVERY_NOTE_LIFECYCLE_STATE = Object.freeze({
  ACTIVE: 'ACTIVE',
  ADJUSTED: 'ADJUSTED',
  SUPERSEDED: 'SUPERSEDED',
  CONSOLIDATED: 'CONSOLIDATED',
  CANCELLED: 'CANCELLED',
});

const money = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const round2 = (value) => Number(money(value).toFixed(2));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const projectStockLine = (item = {}) => {
  const originalQuantity = 1;
  const returnedQuantity = clamp(money(item.returnedQuantity), 0, originalQuantity);
  const activeQuantity = round2(originalQuantity - returnedQuantity);
  const originalLineAmount = round2(item.price);
  const returnedAmount = round2(originalLineAmount * returnedQuantity);
  const activeLineAmount = round2(originalLineAmount - returnedAmount);

  return Object.freeze({
    lineType: 'STOCK',
    sourceLineId: Number(item.id),
    originalQuantity,
    returnedQuantity,
    activeQuantity,
    originalLineAmount,
    returnedAmount,
    activeLineAmount,
    fullyReturned: activeQuantity <= 0,
  });
};

const projectSimpleLine = (item = {}) => {
  const originalQuantity = Math.max(0, money(item.quantity));
  const returnedQuantity = clamp(money(item.returnedQuantity), 0, originalQuantity);
  const activeQuantity = round2(originalQuantity - returnedQuantity);
  const originalLineAmount = round2(item.price);
  const returnedAmount = originalQuantity > 0
    ? round2(originalLineAmount * (returnedQuantity / originalQuantity))
    : 0;
  const activeLineAmount = round2(Math.max(0, originalLineAmount - returnedAmount));

  return Object.freeze({
    lineType: 'SIMPLE',
    sourceLineId: Number(item.id),
    originalQuantity,
    returnedQuantity,
    activeQuantity,
    originalLineAmount,
    returnedAmount,
    activeLineAmount,
    fullyReturned: activeQuantity <= 0,
  });
};

const projectDeliveryNoteLineState = (sale = {}) => {
  const lines = Object.freeze([
    ...(Array.isArray(sale.items) ? sale.items.map(projectStockLine) : []),
    ...(Array.isArray(sale.simpleItems) ? sale.simpleItems.map(projectSimpleLine) : []),
  ]);
  const activeLines = Object.freeze(lines.filter((line) => line.activeQuantity > 0 && line.activeLineAmount >= 0));
  const originalAmount = round2(lines.reduce((sum, line) => sum + line.originalLineAmount, 0));
  const returnedAmount = round2(lines.reduce((sum, line) => sum + line.returnedAmount, 0));
  const activeAmount = round2(lines.reduce((sum, line) => sum + line.activeLineAmount, 0));

  return Object.freeze({
    lines,
    activeLines,
    totals: Object.freeze({ originalAmount, returnedAmount, activeAmount }),
    hasReturn: returnedAmount > 0 || lines.some((line) => line.returnedQuantity > 0),
    fullyReturned: lines.length > 0 && activeLines.length === 0,
  });
};

const assertLifecycleFacts = ({ hasSuccessor = false, hasActiveConsolidation = false } = {}) => {
  if (hasSuccessor && hasActiveConsolidation) {
    const error = new Error('A Delivery Note cannot be simultaneously superseded and actively consolidated');
    error.code = 'DELIVERY_NOTE_LIFECYCLE_CONSUMPTION_CONFLICT';
    error.statusCode = 409;
    throw error;
  }
};

const resolveDeliveryNoteLifecycleState = ({
  sale,
  lineState = projectDeliveryNoteLineState(sale),
  hasSuccessor = false,
  hasActiveConsolidation = false,
} = {}) => {
  assertLifecycleFacts({ hasSuccessor, hasActiveConsolidation });

  if (String(sale?.status || '').toUpperCase() === 'CANCELLED') {
    return DELIVERY_NOTE_LIFECYCLE_STATE.CANCELLED;
  }
  if (hasSuccessor) return DELIVERY_NOTE_LIFECYCLE_STATE.SUPERSEDED;
  if (hasActiveConsolidation) return DELIVERY_NOTE_LIFECYCLE_STATE.CONSOLIDATED;
  if (lineState?.hasReturn) return DELIVERY_NOTE_LIFECYCLE_STATE.ADJUSTED;
  return DELIVERY_NOTE_LIFECYCLE_STATE.ACTIVE;
};

const resolveDeliveryNoteActions = ({
  state,
  activeAmount = 0,
  taxIssued = false,
} = {}) => {
  const currentDocumentState = [
    DELIVERY_NOTE_LIFECYCLE_STATE.ACTIVE,
    DELIVERY_NOTE_LIFECYCLE_STATE.ADJUSTED,
  ].includes(state);
  const hasActiveValue = money(activeAmount) > 0;
  const statutoryLocked = Boolean(taxIssued);

  return Object.freeze({
    historicalReadable: true,
    canPrintCurrent: currentDocumentState,
    canCreateAdjustedRevision:
      state === DELIVERY_NOTE_LIFECYCLE_STATE.ADJUSTED && hasActiveValue && !statutoryLocked,
    canConsolidate: currentDocumentState && hasActiveValue && !statutoryLocked,
    canTaxHandoff: currentDocumentState && hasActiveValue && !statutoryLocked,
    requiresStatutoryCorrection: statutoryLocked && state === DELIVERY_NOTE_LIFECYCLE_STATE.ADJUSTED,
  });
};

const resolveLegacySaleBackedDeliveryNote = ({
  sale,
  hasSuccessor = false,
  hasActiveConsolidation = false,
  taxIssued = false,
} = {}) => {
  if (!sale) {
    const error = new Error('Sale-backed Delivery Note source is required');
    error.code = 'DELIVERY_NOTE_SOURCE_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const lineState = projectDeliveryNoteLineState(sale);
  const state = resolveDeliveryNoteLifecycleState({
    sale,
    lineState,
    hasSuccessor,
    hasActiveConsolidation,
  });
  const activeAmount = round2(Math.max(0, Math.min(money(sale.totalAmount), lineState.totals.activeAmount)));
  const actions = resolveDeliveryNoteActions({ state, activeAmount, taxIssued });

  return Object.freeze({
    sourceType: 'SALE',
    sourceSaleId: Number(sale.id),
    documentNumber: sale.officialDocumentNumber || null,
    lifecycleState: state,
    grossAmount: round2(sale.totalAmount),
    returnedAmount: round2(lineState.totals.returnedAmount),
    activeAmount,
    lineState,
    actions,
  });
};

module.exports = Object.freeze({
  DELIVERY_NOTE_LIFECYCLE_STATE,
  projectStockLine,
  projectSimpleLine,
  projectDeliveryNoteLineState,
  assertLifecycleFacts,
  resolveDeliveryNoteLifecycleState,
  resolveDeliveryNoteActions,
  resolveLegacySaleBackedDeliveryNote,
});
