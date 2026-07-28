'use strict';

const express = require('express');
const { getPublicStorePolicyController } = require('./publicStorePolicyController');

const router = express.Router();
router.get('/:slug', getPublicStorePolicyController);

module.exports = router;
