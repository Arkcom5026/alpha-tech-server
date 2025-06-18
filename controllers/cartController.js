// ✅ CartController.js (รองรับ guest: ตรวจสอบ req.user.id ภายในฟังก์ชัน)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getCart = async (req, res) => {
  try {
    console.log('req.user?.id : ', req.user?.id);

    const userId = req.user?.id;
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
                productImages: {
                  where: { isCover: true },
                  select: { secure_url: true }
                }
              }
            }
          }
        }
      }
    });

    if (!cart) {
      return res.json({ cartItems: [], cartTotal: 0 });
    }

    const cartTotal = cart.cartItems.reduce(
      (sum, item) => sum + item.quantity * (item.priceAtThatTime || 0),
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
        data: {
          quantity: existing.quantity + quantity,
          priceAtThatTime: priceAtThatTime || existing.priceAtThatTime || 0 // ✅ fallback
        }
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          priceAtThatTime: priceAtThatTime || 0 // ✅ fallback
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

    // ✅ ลบ cart หากไม่มี cartItem เหลืออยู่
    const remainingItems = await prisma.cartItem.count({ where: { cartId: cart.id } });
    if (remainingItems === 0) {
      await prisma.cart.delete({ where: { id: cart.id } });
    }

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

const mergeCart = async (req, res) => {
  try {
    console.log('req.body mergeCart : ', req.body)
    const userId = req.user?.id;
    console.log('mergeCart userId : ', userId);
    console.log('mergeCart req.body : ', req.body);
    if (!userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเพื่อ merge cart' });

    const { items } = req.body; // [{ productId, quantity, priceAtThatTime }]
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid items' });
    }

    let cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    for (const item of items) {
      const existing = await prisma.cartItem.findFirst({
        where: { cartId: cart.id, productId: item.productId },
      });

      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + item.quantity,
            priceAtThatTime: item.priceAtThatTime || existing.priceAtThatTime || 0, // ✅ fallback
          },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: item.productId,
            quantity: item.quantity,
            priceAtThatTime: item.priceAtThatTime || 0, // ✅ fallback
          },
        });
      }
    }

    res.json({ message: 'Merge cart สำเร็จ' });
  } catch (err) {
    console.error('❌ mergeCart error:', err);
    res.status(500).json({ error: 'Failed to merge cart' });
  }
};

const updateCartItem = async (req, res) => {
  try {
    
    const userId = req.user?.id;
    const productId = parseInt(req.params.productId);
    const { quantity } = req.body;



    if (!userId || !productId || !quantity || quantity < 1) {
      return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
    }

    console.log('updateCartItem req.body : ',req.body)
    console.log('updateCartItem userId : ',userId)

    const cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    
    console.log('updateCartItem cart : ',cart)

    const existing = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId }
    });
    console.log('updateCartItem existing : ',existing)
    if (!existing) return res.status(404).json({ error: 'Cart item not found' });

    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity }
    });

    res.json({ message: 'อัปเดตจำนวนสินค้าแล้ว' });
  } catch (err) {
    console.error('❌ updateCartItem error:', err);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
};

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  mergeCart,
  updateCartItem,
};
