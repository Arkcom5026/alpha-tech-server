'use strict';

const crypto = require('crypto');
const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { traceRequest } = require('../../../middlewares/authTrace');

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://saduaksabuy.com',
  'https://www.saduaksabuy.com',
  'https://alpha-tech-client.vercel.app',
  'https://alpha-tech-client-git-main-arkcoms-projects.vercel.app',
];

const allowedOriginRegexes = [
  /^https:\/\/alpha-tech-client-[a-z0-9-]+\.vercel\.app$/i,
  /^https:\/\/alpha-tech-client-git-[a-z0-9-]+-arkcoms-projects\.vercel\.app$/i,
  /.*arkcoms-projects\.vercel\.app$/i,
];

const normalizeOrigin = (value) => {
  if (!value || typeof value !== 'string') return null;
  return value.trim().replace(/\/$/, '').toLowerCase();
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;
  if (allowedOrigins.map(normalizeOrigin).includes(normalized)) return true;
  const raw = origin.trim().replace(/\/$/, '');
  return allowedOriginRegexes.some((candidate) => candidate.test(raw));
};

const corsOptions = {
  origin(origin, callback) {
    if (process.env.CORS_ALLOW_ALL === 'true') return callback(null, true);
    if (!origin || isAllowedOrigin(origin)) return callback(null, true);
    console.warn(`🚨 CORS Blocked for origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Idempotency-Key',
    'X-Finalize-Token',
    'X-Anonymous-Session-Token',
    'X-Commerce-Identity-Proof',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['X-Request-Id', 'X-Anonymous-Session-Token', 'X-Commerce-Identity-Proof'],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

const registerCoreMiddleware = (app) => {
  app.use((req, res, next) => {
    req.id = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  morgan.token('reqId', (req) => req.id);
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms - reqId=:reqId'));

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  app.use('/api', traceRequest);
};

module.exports = { corsOptions, isAllowedOrigin, registerCoreMiddleware };
