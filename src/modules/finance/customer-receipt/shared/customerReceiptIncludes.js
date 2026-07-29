const branchAddressInclude = {
  subdistrict: {
    include: {
      district: {
        include: {
          province: true,
        },
      },
    },
  },
};

const receiptInclude = {
  branch: {
    include: branchAddressInclude,
  },
  customer: true,
  createdByEmployeeProfile: true,
  cancelledByEmployeeProfile: true,
  allocations: {
    include: {
      sale: {
        include: {
          branch: {
            include: branchAddressInclude,
          },
          items: {
            include: {
              stockItem: {
                include: {
                  product: {
                    include: {
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
                  unit: true,
                },
              },
            },
          },
        },
      },
      createdByEmployeeProfile: true,
    },
    orderBy: { id: 'asc' },
  },
};

const receiptListInclude = {
  branch: true,
  customer: true,
  createdByEmployeeProfile: true,
  cancelledByEmployeeProfile: true,
  _count: {
    select: {
      allocations: true,
    },
  },
  allocations: {
    include: {
      sale: {
        select: {
          id: true,
          code: true,
          totalAmount: true,
          paidAmount: true,
          statusPayment: true,
          items: {
            include: {
              stockItem: {
                include: {
                  product: {
                    include: {
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
                  unit: true,
                },
              },
            },
          },
        },
      },
      createdByEmployeeProfile: true,
    },
    orderBy: { id: 'asc' },
  },
};

module.exports = {
  branchAddressInclude,
  receiptInclude,
  receiptListInclude,
};
