class SaleCompletionError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'SaleCompletionError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = { SaleCompletionError };
