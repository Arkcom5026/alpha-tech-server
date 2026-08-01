'use strict';

const express = require('express');
const controller = require('./taxExpenseCategoryController');

const router = express.Router();
router.get('/', controller.listCategories);
router.post('/', controller.createCategory);

module.exports = router;
