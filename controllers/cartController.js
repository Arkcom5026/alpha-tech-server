// ✅ CartController.js (รองรับ guest: ตรวจสอบ req.user.id ภายในฟังก์ชัน)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเพื่อดูตะกร้า' });

    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: {
        cartItems: {
          include: { product: true }
        }
      }
    });

    if (!cart) {
      return res.json({ cartItems: [], cartTotal: 0 });
    }

    const cartTotal = cart.cartItems.reduce(
      (sum, item) => sum + item.quantity * item.priceAtThatTime,
      0
    );

    res.json({ cartItems: cart.cartItems, cartTotal });
  } catch (err) {
    console.error('❌ getCart error:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเพื่อเพิ่มสินค้าในตะกร้า' });

    const { productId, quantity, priceAtThatTime } = req.body;

    let cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    const existing = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId }
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity }
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          priceAtThatTime
        }
      });
    }

    res.json({ message: 'เพิ่มสินค้าสำเร็จ' });
  } catch (err) {
    console.error('❌ addToCart error:', err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเพื่อจัดการตะกร้า' });

    const productId = parseInt(req.params.productId);
    const cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId }
    });

    res.json({ message: 'ลบสินค้าเรียบร้อย' });
  } catch (err) {
    console.error('❌ removeFromCart error:', err);
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเพื่อจัดการตะกร้า' });

    const cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    res.json({ message: 'ล้างตะกร้าแล้ว' });
  } catch (err) {
    console.error('❌ clearCart error:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
};

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
};
