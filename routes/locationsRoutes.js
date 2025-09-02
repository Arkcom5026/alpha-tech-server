const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');

// Public + simple caching for reference data
router.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=60');
  next();
});

// GET /api/locations/provinces
router.get('/provinces', async (_req, res) => {
  try {
    const items = await prisma.province.findMany({
      orderBy: { nameTh: 'asc' },
      select: { code: true, nameTh: true, region: true },
    });
    res.json({ items });
  } catch (err) {
    console.error('❌ [locations.provinces] error', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /api/locations/districts?provinceCode=xx
router.get('/districts', async (req, res) => {
  try {
    const provinceCode = String(req.query?.provinceCode || '').trim();
    if (!provinceCode) return res.status(400).json({ message: 'provinceCode is required' });
    const items = await prisma.district.findMany({
      where: { provinceCode },
      orderBy: { nameTh: 'asc' },
      select: { code: true, nameTh: true },
    });
    res.json({ items });
  } catch (err) {
    console.error('❌ [locations.districts] error', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /api/locations/subdistricts?districtCode=xxx
router.get('/subdistricts', async (req, res) => {
  try {
    const districtCode = String(req.query?.districtCode || '').trim();
    if (!districtCode) return res.status(400).json({ message: 'districtCode is required' });
    const items = await prisma.subdistrict.findMany({
      where: { districtCode },
      orderBy: { nameTh: 'asc' },
      select: { code: true, nameTh: true, postcode: true },
    });
    res.json({ items });
  } catch (err) {
    console.error('❌ [locations.subdistricts] error', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
