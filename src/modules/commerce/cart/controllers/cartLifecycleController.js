const { prisma } = require('../../../../../lib/prisma');
const { toInt, toNum } = require('../shared/cartControllerSupport');

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

const mergeCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเพื่อ merge cart' });

    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items) return res.status(400).json({ error: 'Invalid items' });

    await prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findFirst({ where: { userId } });
      if (!cart) cart = await tx.cart.create({ data: { userId } });

      for (const item of items) {
        const productId = toInt(item?.productId);
        const quantity = toInt(item?.quantity) || 1;
        const priceAtThatTime = toNum(item?.priceAtThatTime);
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

module.exports = {
  clearCart,
  mergeCart,
};
