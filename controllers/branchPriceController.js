// 📦 branchPriceController.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ✅ 1. ดึงราคาที่ใช้งานอยู่ ณ เวลานี้ (รองรับโปรโมชั่น)
const getActiveBranchPrice = async (req, res) => {
    const { productId } = req.params;
    const branchId = req.user.branchId;
    const now = new Date();

    console.log('getActiveBranchPrice  productId : ', productId);

    try {
        const price = await prisma.branchPrice.findFirst({
            where: {
                branchId,
                productId: parseInt(productId),
                isActive: true,
                OR: [
                    { effectiveDate: null },
                    { effectiveDate: { lte: now } },
                ],
                AND: [
                    { expiredDate: null },
                    { expiredDate: { gte: now } },
                ],
            },
            orderBy: { effectiveDate: "desc" },
        });

        if (!price) {
            return res.status(404).json({ message: "ไม่พบราคาที่ใช้งานได้" });
        }

        res.json(price);
    } catch (err) {
        console.error("❌ getActiveBranchPrice error:", err);
        res.status(500).json({ error: "Server error" });
    }
};

// ✅ 2. สร้างหรืออัปเดตราคาของสาขา (รองรับโปรโมชั่น)
const upsertBranchPrice = async (req, res) => {
    const { productId, price, effectiveDate, expiredDate, note, isActive } = req.body;
    const branchId = req.user.branchId;
    const updatedBy = req.user.id;

    try {
        const result = await prisma.branchPrice.upsert({
            where: {
                productId_branchId: {
                    productId: parseInt(productId),
                    branchId,
                },
            },
            update: {
                price,
                effectiveDate,
                expiredDate,
                note,
                updatedBy,
                isActive,
            },
            create: {
                productId,
                branchId,
                price,
                effectiveDate,
                expiredDate,
                note,
                updatedBy,
                isActive,
            },
        });

        res.json(result);
    } catch (err) {
        console.error("❌ upsertBranchPrice error:", err);
        res.status(500).json({ error: "ไม่สามารถบันทึกราคาได้" });
    }
};

// ✅ 3. ดึงราคาทั้งหมดของสาขา (ใช้ในหน้า list ราคาต่อสาขา)
const getBranchPricesByBranch = async (req, res) => {
    const branchId = req.user.branchId;

    try {
        const prices = await prisma.branchPrice.findMany({
            where: { branchId },
            include: {
                product: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: "desc" },
        });

        res.json(prices);
    } catch (err) {
        console.error("❌ getBranchPricesByBranch error:", err);
        res.status(500).json({ error: "ไม่สามารถดึงรายการราคาได้" });
    }
};

// ✅ 4. ดึงสินค้าทุกชิ้น พร้อมราคา + ราคาทุนล่าสุดจาก StockItem (ลดข้อมูลซ้ำ)
const getAllProductsWithBranchPrice = async (req, res) => {
    const branchId = req.user.branchId;

    try {
        const products = await prisma.product.findMany({
            orderBy: { name: "asc" },
        });

        const prices = await prisma.branchPrice.findMany({
            where: { branchId },
        });

        // ✅ ดึง StockItem ล่าสุดรายการเดียวต่อ productId
        const latestStockItems = await prisma.stockItem.findMany({
            where: { branchId },
            orderBy: { receivedAt: 'desc' },
            distinct: ['productId'],
            select: {
                productId: true,
                costPrice: true,
                salePrice1: true,
                salePrice2: true,
                salePrice3: true,
                receivedAt: true,
            },
        });

        const latestStockMap = latestStockItems.reduce((acc, item) => {
            acc[item.productId] = item;
            return acc;
        }, {});

        const result = products.map((product) => {
            const matchedPrice = prices.find((p) => p.productId === product.id);
            const latestStock = latestStockMap[product.id];

            return {
                product: {
                    id: product.id,
                    name: product.name,
                },
                branchPrice: matchedPrice || null,
                rawPrices: latestStock ? [latestStock] : [],
                latestCostPrice: latestStock?.costPrice || null,
                avgCostPrice: latestStock?.costPrice || null, // ✅ ใช้ตัวเดียวกันเพราะมีรายการเดียว
            };
        });

        console.log(
            'getAllProductsWithBranchPrice : ',
            result.map((r) => ({
                product: r.product.name,
                latestCostPrice: r.latestCostPrice,
                avgCostPrice: r.avgCostPrice,
            }))
        );

        res.json(result);
    } catch (err) {
        console.error("❌ getAllProductsWithBranchPrice error:", err);
        res.status(500).json({ error: "ไม่สามารถโหลดรายการสินค้าได้" });
    }
};



module.exports = {
    getActiveBranchPrice,
    upsertBranchPrice,
    getBranchPricesByBranch,
    getAllProductsWithBranchPrice,
};
