const express = require('express');
const router = express.Router();

const { getCart, getBranchPrices } = require('../controllers/cartQueryController');
const {
  addToCart,
  removeFromCart,
  updateCartItem,
} = require('../controllers/cartItemController');
const { clearCart, mergeCart } = require('../controllers/cartLifecycleController');

const verifyToken = require('../../../../../middlewares/verifyToken');
router.use(verifyToken);

router.post('/items', addToCart);
router.delete('/items/:productId', removeFromCart);
router.post('/clear', clearCart);
router.get('/', getCart);
router.post('/merge', mergeCart);
router.patch('/item/:productId', updateCartItem);
router.get('/branch-prices/:branchId', getBranchPrices);

module.exports = router;
