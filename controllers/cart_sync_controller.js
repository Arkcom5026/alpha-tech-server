const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ✅ Sync cart items from client to server after login (for online shopping)
const syncCartItems = async (req, res) => {
  const customerId = req.user?.id; // ต้องผ่าน JWT middleware แล้วเท่านั้น
  const items = req.body.items; // [{ productId, quantity }]
  console.log('syncCartItems : ', req.body);
  if (!customerId) {
    return res.status(401).json({ error: "Unauthorized: Customer not logged in" });
  }

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "Invalid cart items" });
  }

  try {
    // 🔄 ลบ cart เดิมของลูกค้าทิ้งทั้งหมดก่อน
    await prisma.cartSync.deleteMany({ where: { customerId } });

    // 🆕 เพิ่มข้อมูลใหม่ทั้งหมด
    const created = await prisma.cartSync.createMany({
      data: items.map((item) => ({
        customerId,
        productId: item.productId,
        quantity: item.quantity || 1,
      })),
    });

    res.json({ message: "Cart synced successfully", count: created.count });
  } catch (err) {
    console.error("❌ syncCartItems error:", err);
    res.status(500).json({ error: "Failed to sync cart" });
  }
};

// ✅ Remove specific item from server-side cart
const removeCartItem = async (req, res) => {
  const customerId = req.user?.id;
  const productId = parseInt(req.params.productId);

  if (!customerId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await prisma.cartSync.deleteMany({ where: { customerId, productId } });
    res.json({ message: "Item removed from cart" });
  } catch (err) {
    console.error("❌ removeCartItem error:", err);
    res.status(500).json({ error: "Failed to remove cart item" });
  }
};

// ✅ Update quantity of a specific cart item
const updateCartItemQuantity = async (req, res) => {
  const customerId = req.user?.id;
  const productId = parseInt(req.params.productId);
  const { quantity } = req.body;

  if (!customerId || !productId || typeof quantity !== 'number') {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const updated = await prisma.cartSync.updateMany({
      where: { customerId, productId },
      data: { quantity },
    });

    res.json({ message: "Quantity updated", count: updated.count });
  } catch (err) {
    console.error("❌ updateCartItemQuantity error:", err);
    res.status(500).json({ error: "Failed to update quantity" });
  }
};

module.exports = {
  syncCartItems,
  removeCartItem,
  updateCartItemQuantity,
};
