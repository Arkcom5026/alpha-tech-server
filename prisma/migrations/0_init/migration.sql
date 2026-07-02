-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('CUSTOMER', 'EMPLOYEE', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "public"."EmployeeRole" AS ENUM ('OWNER', 'MANAGER', 'CASHIER');

-- CreateEnum
CREATE TYPE "public"."PurchaseOrderStatus" AS ENUM ('PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'PAID', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."StockStatus" AS ENUM ('IN_STOCK', 'SOLD', 'RETURNED', 'DAMAGED', 'LOST', 'CLAIMED', 'USED', 'MISSING_PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "public"."ServiceStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ReceiptStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'WAITING_APPROVAL');

-- CreateEnum
CREATE TYPE "public"."PaymentSlipStatus" AS ENUM ('NONE', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."LoginType" AS ENUM ('PHONE', 'EMAIL', 'SOCIAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."RefundMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'STORE_CREDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SaleType" AS ENUM ('NORMAL', 'GOVERNMENT', 'WHOLESALE');

-- CreateEnum
CREATE TYPE "public"."SaleStatus" AS ENUM ('DRAFT', 'DELIVERED', 'FINALIZED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ReturnType" AS ENUM ('REFUND', 'CLAIM', 'EXCHANGE', 'CREDIT_NOTE', 'INTERNAL_USE', 'STOCK_ERROR');

-- CreateEnum
CREATE TYPE "public"."PaymentType" AS ENUM ('ADVANCE', 'RECEIPT_BASED', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "public"."OrderOnlineStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."OrderSource" AS ENUM ('POS', 'ONLINE');

-- CreateEnum
CREATE TYPE "public"."CustomerType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "public"."BarcodeStatus" AS ENUM ('READY', 'SN_RECEIVED', 'USED', 'VOID');

-- CreateEnum
CREATE TYPE "public"."BusinessType" AS ENUM ('GENERAL', 'IT', 'ELECTRONICS', 'CONSTRUCTION', 'GROCERY');

-- CreateEnum
CREATE TYPE "public"."ProductMode" AS ENUM ('SIMPLE', 'STRUCTURED');

-- CreateEnum
CREATE TYPE "public"."StockMovementType" AS ENUM ('RECEIVE', 'SALE', 'ADJUST', 'TRANSFER', 'RESERVE', 'UNRESERVE', 'RETURN', 'LOSS');

-- CreateEnum
CREATE TYPE "public"."ReceiptSource" AS ENUM ('PO', 'QUICK');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'QR', 'E_WALLET', 'CHEQUE', 'OTHER', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "public"."DepositStatus" AS ENUM ('ACTIVE', 'USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."SaleReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."CombinedBillingStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."BarcodeKind" AS ENUM ('SN', 'LOT');

-- CreateEnum
CREATE TYPE "public"."StockAuditMode" AS ENUM ('READY', 'FULL');

-- CreateEnum
CREATE TYPE "public"."StockAuditStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."SimpleLotStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."CustomerReceiptStatus" AS ENUM ('ACTIVE', 'FULLY_ALLOCATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."InputTaxFilingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "public"."SalesTaxFilingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VOIDED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "loginId" TEXT,
    "loginType" "public"."LoginType" NOT NULL DEFAULT 'PHONE',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmployeeProfile" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "userId" INTEGER NOT NULL,
    "branchId" INTEGER,
    "positionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "passwordHashV2" TEXT,
    "v2Role" "public"."EmployeeRole" NOT NULL DEFAULT 'CASHIER',

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Branch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "RBACEnabled" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "subdistrictCode" TEXT,
    "businessType" "public"."BusinessType" NOT NULL DEFAULT 'GENERAL',
    "features" JSONB,
    "branchCode" VARCHAR(5),
    "isHeadOffice" BOOLEAN NOT NULL DEFAULT false,
    "taxId" VARCHAR(13),
    "slug" TEXT,
    "categoryId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GlobalProductType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductTypeBrand" (
    "id" SERIAL NOT NULL,
    "productTypeId" INTEGER NOT NULL,
    "brandId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTypeBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" INTEGER,
    "guideExamples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "normalizedName" TEXT,
    "pathCached" TEXT,
    "slug" TEXT NOT NULL,
    "branchId" INTEGER,
    "globalProductTypeId" INTEGER NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Brand" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "noSN" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "mode" "public"."ProductMode" NOT NULL DEFAULT 'STRUCTURED',
    "trackSerialNumber" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" INTEGER,
    "productTypeId" INTEGER,
    "brandId" INTEGER,
    "codeType" TEXT,
    "productConfig" JSONB,
    "unitId" INTEGER,
    "warrantyDays" INTEGER,
    "templateProductId" INTEGER,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BranchPrice" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "expiredDate" TIMESTAMP(3),
    "note" TEXT,
    "updatedBy" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL,
    "priceOnline" INTEGER,
    "priceRetail" INTEGER,
    "priceTechnician" INTEGER,
    "priceWholesale" INTEGER,

    CONSTRAINT "BranchPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockBalance" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "avgCost" DECIMAL(12,2),
    "lastReceivedCost" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockMovement" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "qty" DECIMAL(12,2) NOT NULL,
    "type" "public"."StockMovementType" NOT NULL,
    "refType" TEXT,
    "refId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simpleLotId" INTEGER,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductImage" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secure_url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "caption" TEXT,
    "isCover" BOOLEAN,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Unit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockItem" (
    "id" SERIAL NOT NULL,
    "barcode" TEXT NOT NULL,
    "serialNumber" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warrantyDays" INTEGER,
    "expiredAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "remark" TEXT,
    "productId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."StockStatus" NOT NULL DEFAULT 'IN_STOCK',
    "purchaseOrderReceiptItemId" INTEGER,
    "batchNumber" TEXT,
    "checkedBy" TEXT,
    "locationCode" TEXT,
    "qrCodeData" TEXT,
    "source" TEXT,
    "tag" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedByEmployeeId" INTEGER,
    "color" TEXT,
    "costPrice" DECIMAL(12,2),

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."V2StockAudit" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "auditorId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "V2StockAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."V2StockAuditItem" (
    "id" SERIAL NOT NULL,
    "stockAuditId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "actualQty" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,

    CONSTRAINT "V2StockAuditItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactPerson" TEXT,
    "country" TEXT DEFAULT 'Thailand',
    "creditLimit" DECIMAL(12,2) DEFAULT 0,
    "email" TEXT,
    "notes" TEXT,
    "paymentTerms" INTEGER DEFAULT 0,
    "phone" TEXT,
    "postalCode" TEXT,
    "province" TEXT,
    "taxId" TEXT,
    "accountNumber" TEXT,
    "accountType" TEXT,
    "bankId" INTEGER,
    "branchId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "creditBalance" DECIMAL(12,2) DEFAULT 0,
    "taxBranchCode" TEXT DEFAULT '00000',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Bank" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "status" "public"."PurchaseOrderStatus" NOT NULL DEFAULT 'PENDING',
    "supplierId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseOrderItem" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseOrderReceipt" (
    "id" SERIAL NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "purchaseOrderId" INTEGER,
    "branchId" INTEGER NOT NULL,
    "receivedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "printed" BOOLEAN NOT NULL DEFAULT false,
    "paidAmount" DECIMAL(12,2),
    "totalAmount" DECIMAL(12,2),
    "statusPayment" "public"."PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "statusReceipt" "public"."ReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "supplierTaxInvoiceDate" TIMESTAMP(3),
    "supplierTaxInvoiceNumber" TEXT,
    "vatRate" DECIMAL(5,2) DEFAULT 7,
    "source" "public"."ReceiptSource" NOT NULL DEFAULT 'PO',
    "supplierId" INTEGER,

    CONSTRAINT "PurchaseOrderReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InputTaxFilingBatch" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "public"."InputTaxFilingStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InputTaxFilingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesTaxFilingBatch" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "public"."SalesTaxFilingStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTaxFilingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesTaxFilingItem" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "saleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesTaxFilingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InputTaxFilingItem" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "purchaseOrderReceiptId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InputTaxFilingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseOrderReceiptItem" (
    "id" SERIAL NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "purchaseOrderItemId" INTEGER,
    "quantity" DECIMAL(12,2) NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productId" INTEGER,

    CONSTRAINT "PurchaseOrderReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" SERIAL NOT NULL,
    "cartTotal" DECIMAL(12,2) NOT NULL,
    "stripePaymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" INTEGER,
    "orderStatus" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductOnOrder" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOnOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cart" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerProfileId" INTEGER,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CartItem" (
    "id" SERIAL NOT NULL,
    "cartId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceAtThatTime" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceOrder" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "branchId" INTEGER,
    "employeeId" INTEGER,
    "receiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."ServiceStatus" NOT NULL DEFAULT 'RECEIVED',
    "description" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceItem" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "productId" INTEGER,
    "serialNumber" TEXT,
    "problem" TEXT,
    "solution" TEXT,
    "cost" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BarcodeCounter" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarcodeCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BarcodeReceiptItem" (
    "id" SERIAL NOT NULL,
    "barcode" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "runningNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "purchaseOrderReceiptId" INTEGER NOT NULL,
    "stockItemId" INTEGER,
    "printed" BOOLEAN NOT NULL DEFAULT false,
    "receiptItemId" INTEGER NOT NULL,
    "status" "public"."BarcodeStatus" NOT NULL DEFAULT 'READY',
    "kind" "public"."BarcodeKind" NOT NULL DEFAULT 'SN',
    "simpleLotId" INTEGER,

    CONSTRAINT "BarcodeReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Sale" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" INTEGER,
    "employeeId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "totalBeforeDiscount" DECIMAL(12,2) NOT NULL,
    "totalDiscount" DECIMAL(12,2) NOT NULL,
    "vat" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "refCode" TEXT,
    "isTaxInvoice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "combinedDocumentId" INTEGER,
    "dueDate" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "officialDocumentNumber" TEXT,
    "saleType" "public"."SaleType" NOT NULL DEFAULT 'NORMAL',
    "status" "public"."SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "combinedBillingId" INTEGER,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "statusPayment" "public"."PaymentStatus" NOT NULL DEFAULT 'UNPAID',

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SaleItem" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "stockItemId" INTEGER NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "documentDescription" TEXT,
    "documentPrefix" TEXT,
    "documentSuffix" TEXT,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SaleItemSimple" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "simpleLotId" INTEGER,
    "unitCost" DECIMAL(12,2),
    "documentDescription" TEXT,
    "documentPrefix" TEXT,
    "documentSuffix" TEXT,

    CONSTRAINT "SaleItemSimple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "saleId" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "combinedDocumentCode" TEXT,
    "employeeProfileId" INTEGER,
    "branchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "cancelNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "id" SERIAL NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentItem" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "slipImage" TEXT,
    "cardRef" TEXT,
    "govImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,

    CONSTRAINT "PaymentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CombinedSaleDocument" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdBy" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "finalAmount" DECIMAL(12,2) NOT NULL,
    "adjustmentNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CombinedSaleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SaleReturn" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "saleId" INTEGER NOT NULL,
    "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" INTEGER NOT NULL,
    "refundedByEmployeeId" INTEGER,
    "branchId" INTEGER NOT NULL,
    "totalRefund" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "returnType" "public"."ReturnType" NOT NULL DEFAULT 'REFUND',
    "reason" TEXT,
    "deductedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isFullyRefunded" BOOLEAN NOT NULL DEFAULT false,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundMethod" "public"."RefundMethod" NOT NULL,
    "status" "public"."SaleReturnStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SaleReturnItem" (
    "id" SERIAL NOT NULL,
    "saleReturnId" INTEGER NOT NULL,
    "saleItemId" INTEGER NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "reasonCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefundTransaction" (
    "id" SERIAL NOT NULL,
    "saleReturnId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundedByEmployeeId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "deducted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "method" "public"."RefundMethod" NOT NULL,

    CONSTRAINT "RefundTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplierPayment" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "note" TEXT,
    "paymentRef" TEXT,
    "paymentProofUrl" TEXT,
    "sourceType" TEXT,
    "sourcePOId" INTEGER,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentType" "public"."PaymentType" NOT NULL DEFAULT 'RECEIPT_BASED',
    "creditAmount" DECIMAL(12,2),
    "debitAmount" DECIMAL(12,2),
    "code" TEXT,
    "amount" DECIMAL(12,2),
    "statusPayment" "public"."PaymentStatus" NOT NULL DEFAULT 'UNPAID',

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplierPaymentReceipt" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderOnline" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "branchId" INTEGER NOT NULL,
    "note" TEXT,
    "status" "public"."OrderOnlineStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedByEmployeeId" INTEGER,
    "shippedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "deliveryDate" TIMESTAMP(3),
    "paymentMethod" "public"."PaymentMethod",
    "source" "public"."OrderSource",
    "trackingCode" TEXT,
    "statusPayment" "public"."PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "code" TEXT NOT NULL,
    "paymentSlipStatus" "public"."PaymentSlipStatus" NOT NULL DEFAULT 'NONE',
    "paymentSlipUrl" TEXT,
    "paymentNote" TEXT,
    "paymentDate" TIMESTAMP(3),

    CONSTRAINT "OrderOnline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderOnlineItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "priceAtPurchase" DECIMAL(12,2),

    CONSTRAINT "OrderOnlineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CombinedBillingDocument" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdBy" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "totalBeforeVat" DECIMAL(12,2),
    "vatAmount" DECIMAL(12,2),
    "totalAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."CombinedBillingStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "CombinedBillingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockAuditSession" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "expectedCount" INTEGER NOT NULL DEFAULT 0,
    "scannedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mode" "public"."StockAuditMode" NOT NULL DEFAULT 'READY',
    "status" "public"."StockAuditStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "StockAuditSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockAuditSnapshotItem" (
    "id" SERIAL NOT NULL,
    "auditSessionId" INTEGER NOT NULL,
    "stockItemId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "expectedStatus" "public"."StockStatus" NOT NULL DEFAULT 'IN_STOCK',
    "isScanned" BOOLEAN NOT NULL DEFAULT false,
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAuditSnapshotItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockAuditScanLog" (
    "id" SERIAL NOT NULL,
    "auditSessionId" INTEGER NOT NULL,
    "stockItemId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byEmployeeId" INTEGER NOT NULL,

    CONSTRAINT "StockAuditScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentCodeCounter" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "yyyymmdd" TEXT NOT NULL,
    "lastNo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaymentCodeCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SimpleLot" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "receiptItemId" INTEGER,
    "barcode" TEXT NOT NULL,
    "qtyInitial" DECIMAL(12,2) NOT NULL,
    "qtyRemaining" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "lastPrintedAt" TIMESTAMP(3),
    "status" "public"."SimpleLotStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "SimpleLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SaleReturnItemSimple" (
    "id" SERIAL NOT NULL,
    "saleReturnId" INTEGER NOT NULL,
    "saleItemSimpleId" INTEGER NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "reasonCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleReturnItemSimple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerReceipts" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "allocatedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "referenceNo" TEXT,
    "note" TEXT,
    "status" "public"."CustomerReceiptStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByEmployeeProfileId" INTEGER,
    "cancelledByEmployeeProfileId" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerReceipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerReceiptAllocations" (
    "id" SERIAL NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "saleId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByEmployeeProfileId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerReceiptAllocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedByTokenId" INTEGER,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerProfile" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "picture" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creditBalance" DECIMAL(12,2) DEFAULT 0,
    "creditLimit" DECIMAL(12,2) DEFAULT 0,
    "paymentTerms" INTEGER,
    "type" "public"."CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "companyName" TEXT,
    "subdistrictCode" TEXT,
    "taxId" TEXT,
    "addressDetail" TEXT,
    "depositBalance_v2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "outstandingDebt_v2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerDeposit" (
    "id" SERIAL NOT NULL,
    "cashAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transferAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "customerId" INTEGER,
    "branchId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cardAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "usedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "usedSaleId" INTEGER,
    "createdBy" INTEGER,
    "status" "public"."DepositStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "CustomerDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepositUsage" (
    "id" SERIAL NOT NULL,
    "customerDepositId" INTEGER NOT NULL,
    "saleId" INTEGER,
    "amountUsed" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" INTEGER,

    CONSTRAINT "DepositUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."V2CustomerDeposit" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionType" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "V2CustomerDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Province" (
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "region" TEXT NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."District" (
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "provinceCode" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "District_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."Subdistrict" (
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "districtCode" TEXT NOT NULL,
    "postcode" TEXT,

    CONSTRAINT "Subdistrict_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."Position" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairJob" (
    "id" SERIAL NOT NULL,
    "jobNo" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "stockItemId" INTEGER,
    "deviceModel" TEXT NOT NULL,
    "reportedSymptoms" TEXT NOT NULL,
    "technicianNotes" TEXT,
    "status" "public"."ServiceStatus" NOT NULL DEFAULT 'RECEIVED',
    "estimatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "depositPaid" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "technicianId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairPartItem" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "qtyUsed" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "RepairPartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WarrantyClaim" (
    "id" SERIAL NOT NULL,
    "claimNo" TEXT NOT NULL,
    "stockItemId" INTEGER NOT NULL,
    "status" "public"."StockStatus" NOT NULL DEFAULT 'CLAIMED',
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "public"."User"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "public"."EmployeeProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_slug_key" ON "public"."Branch"("slug");

-- CreateIndex
CREATE INDEX "Branch_subdistrictCode_idx" ON "public"."Branch"("subdistrictCode");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "public"."Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalProductType_slug_key" ON "public"."GlobalProductType"("slug");

-- CreateIndex
CREATE INDEX "GlobalProductType_categoryId_idx" ON "public"."GlobalProductType"("categoryId");

-- CreateIndex
CREATE INDEX "GlobalProductType_active_idx" ON "public"."GlobalProductType"("active");

-- CreateIndex
CREATE INDEX "ProductTypeBrand_productTypeId_idx" ON "public"."ProductTypeBrand"("productTypeId");

-- CreateIndex
CREATE INDEX "ProductTypeBrand_brandId_idx" ON "public"."ProductTypeBrand"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTypeBrand_productTypeId_brandId_key" ON "public"."ProductTypeBrand"("productTypeId", "brandId");

-- CreateIndex
CREATE INDEX "ProductType_branchId_idx" ON "public"."ProductType"("branchId");

-- CreateIndex
CREATE INDEX "ProductType_globalProductTypeId_idx" ON "public"."ProductType"("globalProductTypeId");

-- CreateIndex
CREATE INDEX "ProductType_categoryId_idx" ON "public"."ProductType"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_branchId_categoryId_slug_key" ON "public"."ProductType"("branchId", "categoryId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_branchId_categoryId_normalizedName_key" ON "public"."ProductType"("branchId", "categoryId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_normalizedName_key" ON "public"."Brand"("normalizedName");

-- CreateIndex
CREATE INDEX "Brand_active_idx" ON "public"."Brand"("active");

-- CreateIndex
CREATE INDEX "Brand_name_idx" ON "public"."Brand"("name");

-- CreateIndex
CREATE INDEX "Product_mode_active_idx" ON "public"."Product"("mode", "active");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "public"."Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_productTypeId_idx" ON "public"."Product"("productTypeId");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "public"."Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_templateProductId_idx" ON "public"."Product"("templateProductId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchPrice_productId_branchId_key" ON "public"."BranchPrice"("productId", "branchId");

-- CreateIndex
CREATE INDEX "StockBalance_branchId_idx" ON "public"."StockBalance"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_productId_branchId_key" ON "public"."StockBalance"("productId", "branchId");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_createdAt_idx" ON "public"."StockMovement"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "public"."StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_type_createdAt_idx" ON "public"."StockMovement"("branchId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_branchId_createdAt_idx" ON "public"."StockMovement"("productId", "branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_public_id_key" ON "public"."ProductImage"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "public"."Unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_barcode_key" ON "public"."StockItem"("barcode");

-- CreateIndex
CREATE INDEX "StockItem_branchId_status_productId_idx" ON "public"."StockItem"("branchId", "status", "productId");

-- CreateIndex
CREATE INDEX "StockItem_productId_status_idx" ON "public"."StockItem"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_serialNumber_productId_key" ON "public"."StockItem"("serialNumber", "productId");

-- CreateIndex
CREATE INDEX "V2StockAudit_branchId_idx" ON "public"."V2StockAudit"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_branchId_name_key" ON "public"."Supplier"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_name_key" ON "public"."Bank"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_code_key" ON "public"."PurchaseOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderReceipt_code_key" ON "public"."PurchaseOrderReceipt"("code");

-- CreateIndex
CREATE INDEX "PurchaseOrderReceipt_branchId_receivedAt_idx" ON "public"."PurchaseOrderReceipt"("branchId", "receivedAt");

-- CreateIndex
CREATE INDEX "PurchaseOrderReceipt_purchaseOrderId_idx" ON "public"."PurchaseOrderReceipt"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderReceipt_source_receivedAt_idx" ON "public"."PurchaseOrderReceipt"("source", "receivedAt");

-- CreateIndex
CREATE INDEX "InputTaxFilingBatch_branchId_year_month_idx" ON "public"."InputTaxFilingBatch"("branchId", "year", "month");

-- CreateIndex
CREATE INDEX "InputTaxFilingBatch_status_idx" ON "public"."InputTaxFilingBatch"("status");

-- CreateIndex
CREATE INDEX "SalesTaxFilingBatch_branchId_year_month_idx" ON "public"."SalesTaxFilingBatch"("branchId", "year", "month");

-- CreateIndex
CREATE INDEX "SalesTaxFilingBatch_status_idx" ON "public"."SalesTaxFilingBatch"("status");

-- CreateIndex
CREATE INDEX "SalesTaxFilingItem_saleId_idx" ON "public"."SalesTaxFilingItem"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTaxFilingItem_batchId_saleId_key" ON "public"."SalesTaxFilingItem"("batchId", "saleId");

-- CreateIndex
CREATE INDEX "InputTaxFilingItem_purchaseOrderReceiptId_idx" ON "public"."InputTaxFilingItem"("purchaseOrderReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "InputTaxFilingItem_batchId_purchaseOrderReceiptId_key" ON "public"."InputTaxFilingItem"("batchId", "purchaseOrderReceiptId");

-- CreateIndex
CREATE INDEX "PurchaseOrderReceiptItem_receiptId_idx" ON "public"."PurchaseOrderReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "PurchaseOrderReceiptItem_productId_idx" ON "public"."PurchaseOrderReceiptItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "public"."CartItem"("cartId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeCounter_branchId_yearMonth_key" ON "public"."BarcodeCounter"("branchId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeReceiptItem_barcode_key" ON "public"."BarcodeReceiptItem"("barcode");

-- CreateIndex
CREATE INDEX "BarcodeReceiptItem_purchaseOrderReceiptId_branchId_idx" ON "public"."BarcodeReceiptItem"("purchaseOrderReceiptId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeReceiptItem_branchId_yearMonth_runningNumber_key" ON "public"."BarcodeReceiptItem"("branchId", "yearMonth", "runningNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_code_key" ON "public"."Sale"("code");

-- CreateIndex
CREATE INDEX "Sale_combinedBillingId_idx" ON "public"."Sale"("combinedBillingId");

-- CreateIndex
CREATE INDEX "Sale_branchId_soldAt_idx" ON "public"."Sale"("branchId", "soldAt");

-- CreateIndex
CREATE INDEX "Sale_branchId_statusPayment_soldAt_idx" ON "public"."Sale"("branchId", "statusPayment", "soldAt");

-- CreateIndex
CREATE INDEX "Sale_branchId_statusPayment_dueDate_idx" ON "public"."Sale"("branchId", "statusPayment", "dueDate");

-- CreateIndex
CREATE INDEX "Sale_isCredit_dueDate_idx" ON "public"."Sale"("isCredit", "dueDate");

-- CreateIndex
CREATE INDEX "Sale_combinedDocumentId_idx" ON "public"."Sale"("combinedDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_stockItemId_key" ON "public"."SaleItem"("stockItemId");

-- CreateIndex
CREATE INDEX "SaleItemSimple_saleId_idx" ON "public"."SaleItemSimple"("saleId");

-- CreateIndex
CREATE INDEX "SaleItemSimple_productId_idx" ON "public"."SaleItemSimple"("productId");

-- CreateIndex
CREATE INDEX "SaleItemSimple_simpleLotId_idx" ON "public"."SaleItemSimple"("simpleLotId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_code_key" ON "public"."Payment"("code");

-- CreateIndex
CREATE INDEX "Payment_saleId_idx" ON "public"."Payment"("saleId");

-- CreateIndex
CREATE INDEX "Payment_branchId_receivedAt_idx" ON "public"."Payment"("branchId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CombinedSaleDocument_code_key" ON "public"."CombinedSaleDocument"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_code_key" ON "public"."SaleReturn"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_code_key" ON "public"."SupplierPayment"("code");

-- CreateIndex
CREATE INDEX "SupplierPayment_branchId_paidAt_idx" ON "public"."SupplierPayment"("branchId", "paidAt");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "public"."SupplierPayment"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPaymentReceipt_paymentId_receiptId_key" ON "public"."SupplierPaymentReceipt"("paymentId", "receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderOnline_code_key" ON "public"."OrderOnline"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CombinedBillingDocument_code_key" ON "public"."CombinedBillingDocument"("code");

-- CreateIndex
CREATE INDEX "StockAuditSession_branchId_status_idx" ON "public"."StockAuditSession"("branchId", "status");

-- CreateIndex
CREATE INDEX "StockAuditSession_startedAt_idx" ON "public"."StockAuditSession"("startedAt");

-- CreateIndex
CREATE INDEX "StockAuditSnapshotItem_auditSessionId_isScanned_idx" ON "public"."StockAuditSnapshotItem"("auditSessionId", "isScanned");

-- CreateIndex
CREATE INDEX "StockAuditSnapshotItem_barcode_idx" ON "public"."StockAuditSnapshotItem"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "StockAuditSnapshotItem_auditSessionId_stockItemId_key" ON "public"."StockAuditSnapshotItem"("auditSessionId", "stockItemId");

-- CreateIndex
CREATE INDEX "StockAuditScanLog_auditSessionId_scannedAt_idx" ON "public"."StockAuditScanLog"("auditSessionId", "scannedAt");

-- CreateIndex
CREATE INDEX "StockAuditScanLog_barcode_idx" ON "public"."StockAuditScanLog"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCodeCounter_branchId_yyyymmdd_key" ON "public"."PaymentCodeCounter"("branchId", "yyyymmdd");

-- CreateIndex
CREATE UNIQUE INDEX "SimpleLot_barcode_key" ON "public"."SimpleLot"("barcode");

-- CreateIndex
CREATE INDEX "SimpleLot_branchId_productId_receivedAt_idx" ON "public"."SimpleLot"("branchId", "productId", "receivedAt");

-- CreateIndex
CREATE INDEX "SimpleLot_branchId_status_idx" ON "public"."SimpleLot"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceipts_code_key" ON "public"."CustomerReceipts"("code");

-- CreateIndex
CREATE INDEX "CustomerReceipts_branchId_receivedAt_idx" ON "public"."CustomerReceipts"("branchId", "receivedAt");

-- CreateIndex
CREATE INDEX "CustomerReceipts_customerId_receivedAt_idx" ON "public"."CustomerReceipts"("customerId", "receivedAt");

-- CreateIndex
CREATE INDEX "CustomerReceipts_status_idx" ON "public"."CustomerReceipts"("status");

-- CreateIndex
CREATE INDEX "CustomerReceiptAllocations_receiptId_allocatedAt_idx" ON "public"."CustomerReceiptAllocations"("receiptId", "allocatedAt");

-- CreateIndex
CREATE INDEX "CustomerReceiptAllocations_saleId_allocatedAt_idx" ON "public"."CustomerReceiptAllocations"("saleId", "allocatedAt");

-- CreateIndex
CREATE INDEX "CustomerReceiptAllocations_createdByEmployeeProfileId_idx" ON "public"."CustomerReceiptAllocations"("createdByEmployeeProfileId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "public"."PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_tokenHash_idx" ON "public"."PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "public"."PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "public"."RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "public"."RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "public"."RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_revokedAt_idx" ON "public"."RefreshToken"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "public"."CustomerProfile"("userId");

-- CreateIndex
CREATE INDEX "CustomerProfile_subdistrictCode_idx" ON "public"."CustomerProfile"("subdistrictCode");

-- CreateIndex
CREATE INDEX "CustomerDeposit_customerId_idx" ON "public"."CustomerDeposit"("customerId");

-- CreateIndex
CREATE INDEX "CustomerDeposit_branchId_idx" ON "public"."CustomerDeposit"("branchId");

-- CreateIndex
CREATE INDEX "CustomerDeposit_branchId_createdAt_idx" ON "public"."CustomerDeposit"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "DepositUsage_paymentId_idx" ON "public"."DepositUsage"("paymentId");

-- CreateIndex
CREATE INDEX "DepositUsage_customerDepositId_idx" ON "public"."DepositUsage"("customerDepositId");

-- CreateIndex
CREATE INDEX "District_provinceCode_idx" ON "public"."District"("provinceCode");

-- CreateIndex
CREATE INDEX "Subdistrict_districtCode_idx" ON "public"."Subdistrict"("districtCode");

-- CreateIndex
CREATE INDEX "Subdistrict_postcode_idx" ON "public"."Subdistrict"("postcode");

-- CreateIndex
CREATE UNIQUE INDEX "Position_name_key" ON "public"."Position"("name");

-- CreateIndex
CREATE INDEX "Position_isActive_idx" ON "public"."Position"("isActive");

-- CreateIndex
CREATE INDEX "Position_name_idx" ON "public"."Position"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RepairJob_jobNo_key" ON "public"."RepairJob"("jobNo");

-- CreateIndex
CREATE INDEX "RepairJob_branchId_idx" ON "public"."RepairJob"("branchId");

-- CreateIndex
CREATE INDEX "RepairJob_stockItemId_idx" ON "public"."RepairJob"("stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_claimNo_key" ON "public"."WarrantyClaim"("claimNo");

-- AddForeignKey
ALTER TABLE "public"."EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "public"."Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_subdistrictCode_fkey" FOREIGN KEY ("subdistrictCode") REFERENCES "public"."Subdistrict"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GlobalProductType" ADD CONSTRAINT "GlobalProductType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductTypeBrand" ADD CONSTRAINT "ProductTypeBrand_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductTypeBrand" ADD CONSTRAINT "ProductTypeBrand_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "public"."ProductType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductType" ADD CONSTRAINT "ProductType_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductType" ADD CONSTRAINT "ProductType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductType" ADD CONSTRAINT "ProductType_globalProductTypeId_fkey" FOREIGN KEY ("globalProductTypeId") REFERENCES "public"."GlobalProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "public"."ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_templateProductId_fkey" FOREIGN KEY ("templateProductId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "public"."Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BranchPrice" ADD CONSTRAINT "BranchPrice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BranchPrice" ADD CONSTRAINT "BranchPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockBalance" ADD CONSTRAINT "StockBalance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockBalance" ADD CONSTRAINT "StockBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_simpleLotId_fkey" FOREIGN KEY ("simpleLotId") REFERENCES "public"."SimpleLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockItem" ADD CONSTRAINT "StockItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockItem" ADD CONSTRAINT "StockItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockItem" ADD CONSTRAINT "StockItem_purchaseOrderReceiptItemId_fkey" FOREIGN KEY ("purchaseOrderReceiptItemId") REFERENCES "public"."PurchaseOrderReceiptItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockItem" ADD CONSTRAINT "StockItem_scannedByEmployeeId_fkey" FOREIGN KEY ("scannedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."V2StockAudit" ADD CONSTRAINT "V2StockAudit_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."V2StockAudit" ADD CONSTRAINT "V2StockAudit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."V2StockAuditItem" ADD CONSTRAINT "V2StockAuditItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."V2StockAuditItem" ADD CONSTRAINT "V2StockAuditItem_stockAuditId_fkey" FOREIGN KEY ("stockAuditId") REFERENCES "public"."V2StockAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Supplier" ADD CONSTRAINT "Supplier_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "public"."Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Supplier" ADD CONSTRAINT "Supplier_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderReceipt" ADD CONSTRAINT "PurchaseOrderReceipt_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderReceipt" ADD CONSTRAINT "PurchaseOrderReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderReceipt" ADD CONSTRAINT "PurchaseOrderReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderReceipt" ADD CONSTRAINT "PurchaseOrderReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InputTaxFilingBatch" ADD CONSTRAINT "InputTaxFilingBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InputTaxFilingBatch" ADD CONSTRAINT "InputTaxFilingBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesTaxFilingBatch" ADD CONSTRAINT "SalesTaxFilingBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesTaxFilingBatch" ADD CONSTRAINT "SalesTaxFilingBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesTaxFilingItem" ADD CONSTRAINT "SalesTaxFilingItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."SalesTaxFilingBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesTaxFilingItem" ADD CONSTRAINT "SalesTaxFilingItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InputTaxFilingItem" ADD CONSTRAINT "InputTaxFilingItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."InputTaxFilingBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InputTaxFilingItem" ADD CONSTRAINT "InputTaxFilingItem_purchaseOrderReceiptId_fkey" FOREIGN KEY ("purchaseOrderReceiptId") REFERENCES "public"."PurchaseOrderReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderReceiptItem" ADD CONSTRAINT "PurchaseOrderReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderReceiptItem" ADD CONSTRAINT "PurchaseOrderReceiptItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "public"."PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderReceiptItem" ADD CONSTRAINT "PurchaseOrderReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."PurchaseOrderReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOnOrder" ADD CONSTRAINT "ProductOnOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOnOrder" ADD CONSTRAINT "ProductOnOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cart" ADD CONSTRAINT "Cart_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "public"."Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceItem" ADD CONSTRAINT "ServiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceItem" ADD CONSTRAINT "ServiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BarcodeCounter" ADD CONSTRAINT "BarcodeCounter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BarcodeReceiptItem" ADD CONSTRAINT "BarcodeReceiptItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BarcodeReceiptItem" ADD CONSTRAINT "BarcodeReceiptItem_purchaseOrderReceiptId_fkey" FOREIGN KEY ("purchaseOrderReceiptId") REFERENCES "public"."PurchaseOrderReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BarcodeReceiptItem" ADD CONSTRAINT "BarcodeReceiptItem_receiptItemId_fkey" FOREIGN KEY ("receiptItemId") REFERENCES "public"."PurchaseOrderReceiptItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BarcodeReceiptItem" ADD CONSTRAINT "BarcodeReceiptItem_simpleLotId_fkey" FOREIGN KEY ("simpleLotId") REFERENCES "public"."SimpleLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BarcodeReceiptItem" ADD CONSTRAINT "BarcodeReceiptItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_combinedBillingId_fkey" FOREIGN KEY ("combinedBillingId") REFERENCES "public"."CombinedBillingDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_combinedDocumentId_fkey" FOREIGN KEY ("combinedDocumentId") REFERENCES "public"."CombinedSaleDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItem" ADD CONSTRAINT "SaleItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItemSimple" ADD CONSTRAINT "SaleItemSimple_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItemSimple" ADD CONSTRAINT "SaleItemSimple_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItemSimple" ADD CONSTRAINT "SaleItemSimple_simpleLotId_fkey" FOREIGN KEY ("simpleLotId") REFERENCES "public"."SimpleLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentItem" ADD CONSTRAINT "PaymentItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CombinedSaleDocument" ADD CONSTRAINT "CombinedSaleDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CombinedSaleDocument" ADD CONSTRAINT "CombinedSaleDocument_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturn" ADD CONSTRAINT "SaleReturn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturn" ADD CONSTRAINT "SaleReturn_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturn" ADD CONSTRAINT "SaleReturn_refundedByEmployeeId_fkey" FOREIGN KEY ("refundedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "public"."SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "public"."SaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefundTransaction" ADD CONSTRAINT "RefundTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefundTransaction" ADD CONSTRAINT "RefundTransaction_refundedByEmployeeId_fkey" FOREIGN KEY ("refundedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefundTransaction" ADD CONSTRAINT "RefundTransaction_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "public"."SaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPaymentReceipt" ADD CONSTRAINT "SupplierPaymentReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."SupplierPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPaymentReceipt" ADD CONSTRAINT "SupplierPaymentReceipt_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."PurchaseOrderReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOnline" ADD CONSTRAINT "OrderOnline_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOnline" ADD CONSTRAINT "OrderOnline_confirmedByEmployeeId_fkey" FOREIGN KEY ("confirmedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOnline" ADD CONSTRAINT "OrderOnline_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOnline" ADD CONSTRAINT "OrderOnline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOnlineItem" ADD CONSTRAINT "OrderOnlineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."OrderOnline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOnlineItem" ADD CONSTRAINT "OrderOnlineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CombinedBillingDocument" ADD CONSTRAINT "CombinedBillingDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CombinedBillingDocument" ADD CONSTRAINT "CombinedBillingDocument_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CombinedBillingDocument" ADD CONSTRAINT "CombinedBillingDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditSession" ADD CONSTRAINT "StockAuditSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditSession" ADD CONSTRAINT "StockAuditSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditSnapshotItem" ADD CONSTRAINT "StockAuditSnapshotItem_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "public"."StockAuditSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditSnapshotItem" ADD CONSTRAINT "StockAuditSnapshotItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditSnapshotItem" ADD CONSTRAINT "StockAuditSnapshotItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditScanLog" ADD CONSTRAINT "StockAuditScanLog_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "public"."StockAuditSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditScanLog" ADD CONSTRAINT "StockAuditScanLog_byEmployeeId_fkey" FOREIGN KEY ("byEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditScanLog" ADD CONSTRAINT "StockAuditScanLog_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentCodeCounter" ADD CONSTRAINT "PaymentCodeCounter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SimpleLot" ADD CONSTRAINT "SimpleLot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SimpleLot" ADD CONSTRAINT "SimpleLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SimpleLot" ADD CONSTRAINT "SimpleLot_receiptItemId_fkey" FOREIGN KEY ("receiptItemId") REFERENCES "public"."PurchaseOrderReceiptItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturnItemSimple" ADD CONSTRAINT "SaleReturnItemSimple_saleItemSimpleId_fkey" FOREIGN KEY ("saleItemSimpleId") REFERENCES "public"."SaleItemSimple"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturnItemSimple" ADD CONSTRAINT "SaleReturnItemSimple_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "public"."SaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReceipts" ADD CONSTRAINT "CustomerReceipts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReceipts" ADD CONSTRAINT "CustomerReceipts_cancelledByEmployeeProfileId_fkey" FOREIGN KEY ("cancelledByEmployeeProfileId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReceipts" ADD CONSTRAINT "CustomerReceipts_createdByEmployeeProfileId_fkey" FOREIGN KEY ("createdByEmployeeProfileId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReceipts" ADD CONSTRAINT "CustomerReceipts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReceiptAllocations" ADD CONSTRAINT "CustomerReceiptAllocations_createdByEmployeeProfileId_fkey" FOREIGN KEY ("createdByEmployeeProfileId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReceiptAllocations" ADD CONSTRAINT "CustomerReceiptAllocations_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."CustomerReceipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReceiptAllocations" ADD CONSTRAINT "CustomerReceiptAllocations_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_replacedByTokenId_fkey" FOREIGN KEY ("replacedByTokenId") REFERENCES "public"."RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerProfile" ADD CONSTRAINT "CustomerProfile_subdistrictCode_fkey" FOREIGN KEY ("subdistrictCode") REFERENCES "public"."Subdistrict"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerDeposit" ADD CONSTRAINT "CustomerDeposit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerDeposit" ADD CONSTRAINT "CustomerDeposit_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerDeposit" ADD CONSTRAINT "CustomerDeposit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositUsage" ADD CONSTRAINT "DepositUsage_customerDepositId_fkey" FOREIGN KEY ("customerDepositId") REFERENCES "public"."CustomerDeposit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositUsage" ADD CONSTRAINT "DepositUsage_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositUsage" ADD CONSTRAINT "DepositUsage_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."V2CustomerDeposit" ADD CONSTRAINT "V2CustomerDeposit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."District" ADD CONSTRAINT "District_provinceCode_fkey" FOREIGN KEY ("provinceCode") REFERENCES "public"."Province"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subdistrict" ADD CONSTRAINT "Subdistrict_districtCode_fkey" FOREIGN KEY ("districtCode") REFERENCES "public"."District"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJob" ADD CONSTRAINT "RepairJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJob" ADD CONSTRAINT "RepairJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJob" ADD CONSTRAINT "RepairJob_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJob" ADD CONSTRAINT "RepairJob_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairPartItem" ADD CONSTRAINT "RepairPartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairPartItem" ADD CONSTRAINT "RepairPartItem_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

