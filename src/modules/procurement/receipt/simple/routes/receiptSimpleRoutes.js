const express = require('express');

const router = express.Router();
const { create, preview } = require('../receiptSimpleController');
const verifyToken = require('../../../../../../middlewares/verifyToken');

router.use(verifyToken);

router.post('/preview', preview);
router.post('/', create);

module.exports = router;
