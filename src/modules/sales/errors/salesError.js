class SalesError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'SalesError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = { SalesError };
