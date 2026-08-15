'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const { createOperationalVerificationService } = require('./operationalVerificationService');

const router = express.Router();
const service = createOperationalVerificationService();
const startedAt = new Date().toISOString();

const first = (...values) => values.find((value) => typeof value === 'string' && value.trim()) || null;
const release = () => ({
  app: 'alpha-tech-server',
  commitSha: first(process.env.RENDER_GIT_COMMIT, process.env.GITHUB_SHA, process.env.GIT_COMMIT_SHA),
  branch: first(process.env.RENDER_GIT_BRANCH, process.env.GITHUB_HEAD_REF, process.env.GITHUB_REF_NAME, process.env.GIT_BRANCH),
  runtime: process.env.RENDER ? 'render' : process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'node',
  node: process.version,
  startedAt,
});

router.get('/release', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, release: release() });
});

router.get('/health/live', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    ok: true,
    status: 'live',
    uptimeSeconds: Math.floor(process.uptime()),
    release: release(),
  });
});

router.get('/health/ready', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    ok: true,
    status: 'ready',
    scope: 'process',
    release: release(),
  });
});

const requireAdministrator = (req, res, next) => {
  const role = String(req.user?.role || '').toUpperCase();
  if (!['ADMIN', 'SUPERADMIN'].includes(role)) {
    return res.status(403).json({
      ok: false,
      code: 'OPERATIONAL_VERIFICATION_ADMIN_REQUIRED',
      message: 'Administrator authority is required',
    });
  }
  return next();
};

router.use(verifyToken, requireAdministrator);

router.get('/', async (_req, res, next) => {
  try {
    const data = await service.run();
    return res.status(data.status === 'FAILED' ? 503 : 200).json({ ok: data.status !== 'FAILED', data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
