// src/middlewares/errorHandler.js
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const status = err.status || 'error';
  
    if (!err.isOperational) {
      console.error('[CRITICAL UNHANDLED ERROR LOG]', err);
    }
  
    return res.status(statusCode).json({
      status: status,
      error: {
        message: err.message || 'เกิดความล้มเหลวในการเชื่อมโยงบริการของระบบความปลอดภัย',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  };
  
  module.exports = errorHandler;