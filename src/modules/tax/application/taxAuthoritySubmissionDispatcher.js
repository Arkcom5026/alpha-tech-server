const { assertTaxAuthorityProvider } = require('../providers/taxAuthorityProvider');

class TaxAuthoritySubmissionDispatcherError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxAuthoritySubmissionDispatcherError';
    this.code = code;
    this.details = details;
  }
}

const createTaxAuthoritySubmissionDispatcher = ({ providers }) => {
  if (!providers || typeof providers !== 'object' || Array.isArray(providers)) {
    throw new TaxAuthoritySubmissionDispatcherError(
      'INVALID_TAX_AUTHORITY_PROVIDER_REGISTRY',
      'providers must be an object keyed by providerKey',
    );
  }

  const registry = new Map(
    Object.entries(providers).map(([providerKey, provider]) => [
      providerKey,
      assertTaxAuthorityProvider(provider),
    ]),
  );

  const resolveProvider = (providerKey) => {
    const provider = registry.get(providerKey);
    if (!provider) {
      throw new TaxAuthoritySubmissionDispatcherError(
        'TAX_AUTHORITY_PROVIDER_NOT_FOUND',
        'Tax authority provider is not registered',
        { providerKey },
      );
    }
    return provider;
  };

  return Object.freeze({
    async dispatch(item) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TaxAuthoritySubmissionDispatcherError(
          'INVALID_TAX_AUTHORITY_DISPATCH_ITEM',
          'Dispatch item must be an object',
        );
      }

      const provider = resolveProvider(item.providerKey);
      return provider.submit(item);
    },

    async cancel(item) {
      const provider = resolveProvider(item.providerKey);
      return provider.cancel(item);
    },

    async getStatus(item) {
      const provider = resolveProvider(item.providerKey);
      return provider.getStatus(item);
    },
  });
};

module.exports = {
  TaxAuthoritySubmissionDispatcherError,
  createTaxAuthoritySubmissionDispatcher,
};
