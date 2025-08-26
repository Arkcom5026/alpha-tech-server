// ✅ CartController.js — Prisma singleton, Decimal-safe, transactions, branch-aware pricing
const { prisma, Prisma } = require('../lib/prisma');

// Helpers
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v ?? 0));

// GET /cart
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
                // หมายเหตุ: ชื่อ relation อาจเป็น branchPrices ในบางสคีมา
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
      const bp = item.product?.branchPrice?.[0];
      const onlinePrice = toNum(bp?.priceOnline ?? item.priceAtThatTime ?? 0);
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

// GET /branch-prices/:branchId
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
      prices.map((p) => ({
        ...p,
        priceOnline: toNum(p.priceOnline),
      }))
    );
  } catch (err) {
    console.error('❌ getBranchPrices error:', err);
    return res.status(500).json({ error: 'Failed to fetch branch prices' });
  }
};

// POST /cart/add
const addToCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเพื่อเพิ่มสินค้าในตะกร้า' });

    const productId = toInt(req.body?.productId);
    const quantity = toInt(req.body?.quantity) || 1;
    const priceAtThatTime = toNum(req.body?.priceAtThatTime);

    if (!productId || quantity < 1) {
      return res.status(400).json({ error: 'ข้อมูลสินค้าไม่ถูกต้อง' });
    }

    await prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findFirst({ where: { userId } });
      if (!cart) cart = await tx.cart.create({ data: { userId } });

      const existing = await tx.cartItem.findFirst({ where: { cartId: cart.id, productId } });

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + quantity,
            priceAtThatTime: priceAtThatTime || existing.priceAtThatTime || 0,
          },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity,
            priceAtThatTime: priceAtThatTime || 0,
          },
        });
      }
    });

    return res.json({ message: 'เพิ่มสินค้าสำเร็จ' });
  } catch (err) {
    console.error('❌ addToCart error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return res.status(400).json({ error: 'สินค้าไม่ถูกต้อง หรือมีการอ้างอิงไม่ถูกต้อง' });
    }
    return res.status(500).json({ error: 'Failed to add to cart' });
  }
};

// DELETE /cart/items/:productId
const removeFromCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเพื่อจัดการตะกร้า' });

    const productId = toInt(req.params?.productId);
    if (!productId) return res.status(400).json({ error: 'Product id ไม่ถูกต้อง' });

    const cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
      const remainingItems = await tx.cartItem.count({ where: { cartId: cart.id } });
      if (remainingItems === 0) {
        await tx.cart.delete({ where: { id: cart.id } });
      }
    });

    return res.json({ message: 'ลบสินค้าเรียบร้อย' });
  } catch (err) {
    console.error('❌ removeFromCart error:', err);
    return res.status(500).json({ error: 'Failed to remove from cart' });
  }
};

// DELETE /cart
const clearCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเพื่อจัดการตะกร้า' });

    const cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    return res.json({ message: 'ล้างตะกร้าแล้ว' });
  } catch (err) {
    console.error('❌ clearCart error:', err);
    return res.status(500).json({ error: 'Failed to clear cart' });
  }
};

// POST /cart/merge
const mergeCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเพื่อ merge cart' });

    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items) return res.status(400).json({ error: 'Invalid items' });

    await prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findFirst({ where: { userId } });
      if (!cart) cart = await tx.cart.create({ data: { userId } });

      for (const i of items) {
        const productId = toInt(i?.productId);
        const quantity = toInt(i?.quantity) || 1;
        const priceAtThatTime = toNum(i?.priceAtThatTime);
        if (!productId || quantity < 1) continue;

        const existing = await tx.cartItem.findFirst({ where: { cartId: cart.id, productId } });
        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + quantity,
              priceAtThatTime: priceAtThatTime || existing.priceAtThatTime || 0,
            },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId,
              quantity,
              priceAtThatTime: priceAtThatTime || 0,
            },
          });
        }
      }
    });

    return res.json({ message: 'Merge cart สำเร็จ' });
  } catch (err) {
    console.error('❌ mergeCart error:', err);
    return res.status(500).json({ error: 'Failed to merge cart' });
  }
};

// PATCH /cart/items/:productId
const updateCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    const productId = toInt(req.params?.productId);
    const quantity = toInt(req.body?.quantity);

    if (!userId || !productId || !quantity || quantity < 1) {
      return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
    }

    const cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId } });
    if (!existing) return res.status(404).json({ error: 'Cart item not found' });

    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });

    return res.json({ message: 'อัปเดตจำนวนสินค้าแล้ว' });
  } catch (err) {
    console.error('❌ updateCartItem error:', err);
    return res.status(500).json({ error: 'Failed to update cart item' });
  }
};

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  mergeCart,
  updateCartItem,
  getBranchPrices,
};
