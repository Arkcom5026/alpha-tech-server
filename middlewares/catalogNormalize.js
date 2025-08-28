const { normalizeName, slugify } = require('../utils/normalize');

function catalogNormalizeMiddleware(req, res, next) {
  try {
    const body = req.body || {};
    if (typeof body.name === 'string') {
      body.normalizedName = normalizeName(body.name);
      body.slug = slugify(body.name);
    }
    req.body = body;
    return next();
  } catch (err) {
    return res.status(400).json({ error: 'NORMALIZE_FAILED', message: err?.message || 'Normalize failed' });
  }
}

module.exports = { catalogNormalizeMiddleware };
