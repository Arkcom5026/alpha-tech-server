'use strict';

const { commitProductReservation } = require('./productReservationCommitmentService');

const readSessionToken = (req) => req.get('X-Anonymous-Session-Token') || req.cookies?.anonymousShoppingSessionToken;
const readProofToken = (req) => req.get('X-Commerce-Identity-Proof');
const readIdempotencyKey = (req) => req.get('X-Idempotency-Key');

const commitController = async (req, res, next) => {
  try {
    const result = await commitProductReservation({
      slug: req.params.slug,
      sessionToken: readSessionToken(req),
      identityProofToken: readProofToken(req),
      idempotencyKey: readIdempotencyKey(req),
    });
    return res.status(result.replayed ? 200 : 201).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ commitController });
