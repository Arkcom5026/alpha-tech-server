class TaxAuthorityProviderError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxAuthorityProviderError';
    this.code = code;
    this.details = details;
  }
}

const requireFunction = (provider, method) => {
  if (!provider || typeof provider !== 'object') {
    throw new TaxAuthorityProviderError(
      'INVALID_TAX_AUTHORITY_PROVIDER',
      'Tax authority provider must be an object',
    );
  }

  if (typeof provider[method] !== 'function') {
    throw new TaxAuthorityProviderError(
      'INVALID_TAX_AUTHORITY_PROVIDER',
      `Tax authority provider must implement ${method}()`,
      { method },
    );
  }
};

const assertTaxAuthorityProvider = (provider) => {
  requireFunction(provider, 'submit');
  requireFunction(provider, 'cancel');
  requireFunction(provider, 'getStatus');
  return provider;
};

module.exports = {
  TaxAuthorityProviderError,
  assertTaxAuthorityProvider,
};
