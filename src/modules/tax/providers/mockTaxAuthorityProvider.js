const { assertTaxAuthorityProvider } = require('./taxAuthorityProvider');

const createMockTaxAuthorityProvider = ({
  providerKey = 'MOCK',
  accepted = true,
} = {}) => {
  const submissions = new Map();

  const provider = {
    providerKey,

    async submit(payload) {
      const externalReference = `${providerKey}-${payload.submissionId}`;
      const result = Object.freeze({
        providerKey,
        externalReference,
        status: accepted ? 'ACCEPTED' : 'REJECTED',
        accepted,
        receivedAt: new Date(payload.occurredAt),
      });

      submissions.set(payload.submissionId, result);
      return result;
    },

    async cancel({ submissionId, occurredAt }) {
      const previous = submissions.get(submissionId) ?? null;
      const result = Object.freeze({
        providerKey,
        externalReference: previous?.externalReference ?? `${providerKey}-${submissionId}`,
        status: 'CANCELLED',
        cancelledAt: new Date(occurredAt),
      });

      submissions.set(submissionId, result);
      return result;
    },

    async getStatus({ submissionId }) {
      return submissions.get(submissionId) ?? Object.freeze({
        providerKey,
        externalReference: null,
        status: 'NOT_FOUND',
      });
    },
  };

  return assertTaxAuthorityProvider(provider);
};

module.exports = {
  createMockTaxAuthorityProvider,
};
