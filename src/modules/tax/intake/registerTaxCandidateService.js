'use strict';

const { prisma } = require('../../../../lib/prisma');
const { buildTaxCandidateRegistration } = require('../candidates/contracts/taxCandidateContract');
const candidateRepository = require('../candidates/repository/taxCandidateRepository');

const registerTaxCandidate = async (input) => {
  const registration = buildTaxCandidateRegistration(input);

  return prisma.$transaction(async (tx) => {
    const existingCandidate = await candidateRepository.findByRegistrationKey(
      registration.registrationKey,
      tx,
    );

    if (existingCandidate) {
      return Object.freeze({ replayed: true, candidate: existingCandidate, document: null });
    }

    const candidate = await candidateRepository.create(registration, tx);
    return Object.freeze({ replayed: false, candidate, document: null });
  });
};

module.exports = Object.freeze({ registerTaxCandidate });
