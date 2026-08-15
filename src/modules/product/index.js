const productRoutes = require('./routes/productRoutes')
const templateProductSearchRoutes = require('./templateSearch/routes/templateProductSearchRoutes')
const { productTraceRoutes } = require('./trace')
const quickStockRoutes = require('./quickStock/routes/quickStockRoutes')
const productCreateRoutes = require('./create/routes/productCreateRoutes')
const uploadProductRoutes = require('./media/routes/uploadProductRoutes')

const mountProductModule = (app) => {
  app.use('/api/products/template', templateProductSearchRoutes)
  app.use('/api/products/trace', productTraceRoutes)
  app.use('/api/products', uploadProductRoutes)
  app.use('/api/products', productRoutes)
  app.use('/api/quick-stock', quickStockRoutes)
  app.use('/api/product-create', productCreateRoutes)
}

module.exports = {
  mountProductModule,
  productRoutes,
  templateProductSearchRoutes,
  productTraceRoutes,
  quickStockRoutes,
  productCreateRoutes,
  uploadProductRoutes,
}
