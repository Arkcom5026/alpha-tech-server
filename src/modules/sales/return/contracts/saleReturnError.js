class SaleReturnError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'SaleReturnError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = { SaleReturnError };
