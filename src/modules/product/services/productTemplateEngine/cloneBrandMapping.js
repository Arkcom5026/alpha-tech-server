// src/modules/product/services/productTemplateEngine/cloneBrandMapping.js
// Safe Transaction Edition
//
// เหตุผล:
// ห้ามใช้ try/catch ครอบ productTypeBrand.create() เพื่อกลืน P2002 ภายใน PostgreSQL transaction
// เพราะเมื่อ statement แรก error แล้ว transaction จะถูก mark เป็น aborted
// และคำสั่งถัดไปจะเจอ 25P02 current transaction is aborted
//
// แนวทาง:
// - อ่าน mapping ต้นทาง
// - อ่าน mapping ปลายทางที่มีอยู่แล้ว
// - insert เฉพาะ brandId ที่ยังไม่มี
// - ใช้ createMany({ skipDuplicates: true }) เป็นชั้นป้องกันสุดท้าย

const cloneBrandMapping = async (tx, { sourceProductTypeId, targetProductTypeId }) => {
  const sourceId = Number(sourceProductTypeId);
  const targetId = Number(targetProductTypeId);

  if (!sourceId || !targetId) {
    return;
  }

  const sourceRows = await tx.productTypeBrand.findMany({
    where: { productTypeId: sourceId },
    select: { brandId: true },
  });

  if (!sourceRows.length) {
    return;
  }

  const uniqueSourceBrandIds = [
    ...new Set(
      sourceRows
        .map((row) => Number(row.brandId))
        .filter((brandId) => Number.isInteger(brandId) && brandId > 0)
    ),
  ];

  if (!uniqueSourceBrandIds.length) {
    return;
  }

  const existingRows = await tx.productTypeBrand.findMany({
    where: {
      productTypeId: targetId,
      brandId: { in: uniqueSourceBrandIds },
    },
    select: { brandId: true },
  });

  const existingBrandIdSet = new Set(
    existingRows.map((row) => Number(row.brandId))
  );

  const rowsToCreate = uniqueSourceBrandIds
    .filter((brandId) => !existingBrandIdSet.has(brandId))
    .map((brandId) => ({
      productTypeId: targetId,
      brandId,
    }));

  if (!rowsToCreate.length) {
    return;
  }

  await tx.productTypeBrand.createMany({
    data: rowsToCreate,
    skipDuplicates: true,
  });
};

module.exports = { cloneBrandMapping };
