// src/modules/sales/contracts/saleDocument.include.js

const SALE_DOCUMENT_INCLUDE = {
    branch: true,
  
    customer: {
      include: {
        user: {
          select: {
            loginId: true,
          },
        },
      },
    },
  
    employee: true,
  
    items: {
      include: {
        stockItem: {
          include: {
            product: {
              include: {
                unit: true,
                template: {
                  include: {
                    unit: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  
    simpleItems: {
      include: {
        product: {
          include: {
            unit: true,
            template: {
              include: {
                unit: true,
              },
            },
          },
        },
      },
    },
  };
  
  module.exports = {
    SALE_DOCUMENT_INCLUDE,
  };