const { Prisma } = require('@prisma/client');

/**
 * ส่ง 409 พร้อมรายละเอียดของรายการที่ชน unique
 * @param {Response} res
 * @param {Object} params { level, parentField, parentId, prisma, whereExisting, pathField }
 */
async function respondUniqueConflict(res, { level, parentField, parentId, prisma, whereExisting, pathField = 'pathCached' }) {
  try {
    // พยายามดึงของเดิม (อิง normalizedName + parentId)
    const existing = await whereExisting();
    return res.status(409).json({
      error: 'DUPLICATE',
      message: 'พบรายการเดิม',
      level,                          // 'type' | 'profile' | 'template'
      parentField,                    // 'categoryId' | 'productTypeId' | 'productProfileId'
      parentId,
      conflictId: existing?.id ?? null,
      name: existing?.name ?? null,
      slug: existing?.slug ?? null,
      normalizedName: existing?.normalizedName ?? null,
      path: existing?.[pathField] ?? null,
    });
  } catch (e) {
    // fallback: ไม่สามารถค้นย้อน ก็ส่งปกติ
    return res.status(409).json({
      error: 'DUPLICATE',
      message: 'พบรายการเดิม',
      level,
      parentField,
      parentId,
    });
  }
}

function isPrismaUniqueError(err) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

module.exports = { respondUniqueConflict, isPrismaUniqueError };
