'use strict';

const {
  requestCommitmentIdentity,
  verifyCommitmentIdentity,
} = require('./commerceIdentityService');

const readSessionToken = (req) => req.get('X-Anonymous-Session-Token') || req.cookies?.anonymousShoppingSessionToken;

const requestController = async (req, res, next) => {
  try {
    const data = await requestCommitmentIdentity({
      slug: req.params.slug,
      sessionToken: readSessionToken(req),
      phone: req.body?.phone,
    });
    return res.status(202).json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const verifyController = async (req, res, next) => {
  try {
    const result = await verifyCommitmentIdentity({
      slug: req.params.slug,
      sessionToken: readSessionToken(req),
      challengeId: req.body?.challengeId,
      otp: req.body?.otp,
    });
    res.setHeader('X-Commerce-Identity-Proof', result.proofToken);
    return res.json({ ok: true, data: result.proof });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ requestController, verifyController });
