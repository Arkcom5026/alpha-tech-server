// src/modules/sales/contracts/saleDocument.include.js

const SALE_DOCUMENT_INCLUDE = {
  branch: {
    include: {
      subdistrict: {
        include: {
          district: {
            include: {
              province: true,
            },
          },
        },
      },
    },
  },

  customer: {
    include: {
      user: {
        select: {
          loginId: true,
        },
      },

      // ✅ Customer address truth:
      // CustomerProfile.addressDetail contains house/building detail only.
      // Full address requires Subdistrict → District → Province.
      subdistrict: {
        include: {
          district: {
            include: {
              province: true,
            },
          },
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
              // ✅ Product.unit is the document/runtime unit truth.
              unit: true,
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
          // ✅ Product.unit is the document/runtime unit truth.
          unit: true,
        },
      },
    },
  },
};

module.exports = {
  SALE_DOCUMENT_INCLUDE,
};