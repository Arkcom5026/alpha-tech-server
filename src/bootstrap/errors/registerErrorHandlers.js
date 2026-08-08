'use strict';

const registerErrorHandlers = (app) => {
  app.use((req, res) => {
    res.status(404).json({
      ok: false,
      error: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  app.use((err, req, res, _next) => {
    console.error('❌ Unhandled error:', err);
    const candidateStatusCode = Number(err?.statusCode ?? err?.status);
    const statusCode = Number.isInteger(candidateStatusCode)
      && candidateStatusCode >= 400
      && candidateStatusCode <= 599
      ? candidateStatusCode
      : 500;
    const code = err?.code || 'INTERNAL_SERVER_ERROR';

    res.status(statusCode).json({
      ok: false,
      error: code,
      code,
      message: err?.message || 'Internal server error',
      details: err?.details || null,
      requestId: req.id,
    });
  });
};

module.exports = { registerErrorHandlers };
