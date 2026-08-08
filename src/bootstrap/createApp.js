'use strict';

const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const { registerCoreMiddleware } = require('./middleware/registerCoreMiddleware');
const { registerRoutes } = require('./routes/registerRoutes');
const { registerErrorHandlers } = require('./errors/registerErrorHandlers');

const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.disable('etag');

  registerCoreMiddleware(app);
  registerRoutes(app);
  registerErrorHandlers(app);

  return app;
};

module.exports = { createApp };
