const cloneImages = async (tx, { templateProduct, newProductId }) => {
    const images = templateProduct.productImages || []
  
    if (!images.length) return
  
    await tx.productImage.createMany({
      data: images.map((img) => ({
        productId: Number(newProductId),
        url: img.url,
        secure_url: img.secure_url,
        public_id: img.public_id ? `${img.public_id}_clone_${newProductId}` : null,
        caption: img.caption,
        isCover: img.isCover,
        active: img.active,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      skipDuplicates: true,
    })
  }
  
  module.exports = { cloneImages }