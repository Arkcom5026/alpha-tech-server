const { prisma, Prisma } = require('../../../../../lib/prisma');
const { toInt, toNum } = require('../shared/cartControllerSupport');

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
  addToCart,
  removeFromCart,
  updateCartItem,
};
