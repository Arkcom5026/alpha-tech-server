'use strict';

const { createProductReservationLifecycleService } = require('../lifecycle/productReservationLifecycleService');
const lifecycleRepository = require('../lifecycle/productReservationLifecyclePrismaRepository');
const { findExpiredCandidates } = require('../merchant/productReservationMerchantQueryRepository');

const createExpiryRunner = ({
  repository = lifecycleRepository,
  candidateRepository = { findExpiredCandidates },
  clock = () => new Date(),
} = {}) => {
  const lifecycleService = createProductReservationLifecycleService({ repository, clock });

  const run = async ({ branchId = null, limit = 100 } = {}) => {
    const now = clock();
    const candidates = await candidateRepository.findExpiredCandidates({ branchId, now, limit });
    const results = [];

    for (const candidate of candidates) {
      try {
        const result = await lifecycleService.execute({
          reservationId: candidate.id,
          branchId: candidate.branchId,
          actorId: null,
          commandKey: `expiry:${candidate.id}:${candidate.expiresAt.toISOString()}`,
          commandType: 'EXPIRE',
          reason: 'Reservation expiry reached',
          occurredAt: now,
        });
        results.push({ reservationId: candidate.id, ok: true, result });
      } catch (error) {
        results.push({
          reservationId: candidate.id,
          ok: false,
          error: { code: error.code || 'PRODUCT_RESERVATION_EXPIRY_FAILED', message: error.message },
        });
      }
    }

    return Object.freeze({
      scanned: candidates.length,
      succeeded: results.filter((entry) => entry.ok).length,
      failed: results.filter((entry) => !entry.ok).length,
      results,
    });
  };

  return Object.freeze({ run });
};

module.exports = Object.freeze({ createExpiryRunner });
