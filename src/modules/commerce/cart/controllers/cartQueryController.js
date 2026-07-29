const { prisma } = require('../../../../../lib/prisma');
const { toInt, toNum } = require('../shared/cartControllerSupport');

const getCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    const branchId = toInt(req.user?.branchId) || toInt(req.query?.branchId);
    if (!userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเพื่อดูตะกร้า' });

    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: {
        cartItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                productImages: { where: { isCover: true }, select: { secure_url: true } },
                branchPrice: branchId
                  ? { where: { branchId }, select: { priceOnline: true } }
                  : { select: { priceOnline: true } },
              },
            },
          },
        },
      },
    });

    if (!cart) return res.json({ cartItems: [], cartTotal: 0 });

    const cartItemsWithOnlinePrice = cart.cartItems.map((item) => {
      const branchPrice = item.product?.branchPrice?.[0];
      const onlinePrice = toNum(branchPrice?.priceOnline ?? item.priceAtThatTime ?? 0);
      return { ...item, priceAtThatTime: onlinePrice };
    });

    const cartTotal = cartItemsWithOnlinePrice.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.priceAtThatTime || 0),
      0
    );

    return res.json({ cartItems: cartItemsWithOnlinePrice, cartTotal });
  } catch (err) {
    console.error('❌ getCart error:', err);
    return res.status(500).json({ error: 'Failed to fetch cart' });
  }
};

const getBranchPrices = async (req, res) => {
  try {
    const branchId = toInt(req.params?.branchId) || toInt(req.user?.branchId);
    if (!branchId) return res.status(400).json({ error: 'Missing branchId' });

    const prices = await prisma.branchPrice.findMany({
      where: { branchId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productImages: { where: { isCover: true }, select: { secure_url: true } },
          },
        },
      },
    });

    return res.json(
      prices.map((price) => ({
        ...price,
        priceOnline: toNum(price.priceOnline),
      }))
    );
  } catch (err) {
    console.error('❌ getBranchPrices error:', err);
    return res.status(500).json({ error: 'Failed to fetch branch prices' });
  }
};

module.exports = {
  getCart,
  getBranchPrices,
};
