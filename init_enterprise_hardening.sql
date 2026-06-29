-- DropForeignKey
ALTER TABLE "public"."EmployeeProfile" DROP CONSTRAINT "EmployeeProfile_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmployeeProfile" DROP CONSTRAINT "EmployeeProfile_positionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GlobalProductType" DROP CONSTRAINT "GlobalProductType_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BranchPrice" DROP CONSTRAINT "BranchPrice_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BranchPrice" DROP CONSTRAINT "BranchPrice_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockBalance" DROP CONSTRAINT "StockBalance_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockBalance" DROP CONSTRAINT "StockBalance_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockMovement" DROP CONSTRAINT "StockMovement_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockMovement" DROP CONSTRAINT "StockMovement_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockItem" DROP CONSTRAINT "StockItem_scannedByEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockItem" DROP CONSTRAINT "StockItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockItem" DROP CONSTRAINT "StockItem_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockItem" DROP CONSTRAINT "StockItem_purchaseOrderReceiptItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."V2StockAudit" DROP CONSTRAINT "V2StockAudit_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Supplier" DROP CONSTRAINT "Supplier_bankId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Supplier" DROP CONSTRAINT "Supplier_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseOrderItem" DROP CONSTRAINT "PurchaseOrderItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseOrderReceipt" DROP CONSTRAINT "PurchaseOrderReceipt_receivedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseOrderReceipt" DROP CONSTRAINT "PurchaseOrderReceipt_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InputTaxFilingBatch" DROP CONSTRAINT "InputTaxFilingBatch_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InputTaxFilingBatch" DROP CONSTRAINT "InputTaxFilingBatch_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."SalesTaxFilingBatch" DROP CONSTRAINT "SalesTaxFilingBatch_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SalesTaxFilingBatch" DROP CONSTRAINT "SalesTaxFilingBatch_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."SalesTaxFilingItem" DROP CONSTRAINT "SalesTaxFilingItem_saleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InputTaxFilingItem" DROP CONSTRAINT "InputTaxFilingItem_purchaseOrderReceiptId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductOnOrder" DROP CONSTRAINT "ProductOnOrder_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceOrder" DROP CONSTRAINT "ServiceOrder_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceOrder" DROP CONSTRAINT "ServiceOrder_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceOrder" DROP CONSTRAINT "ServiceOrder_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceItem" DROP CONSTRAINT "ServiceItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BarcodeReceiptItem" DROP CONSTRAINT "BarcodeReceiptItem_stockItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BarcodeReceiptItem" DROP CONSTRAINT "BarcodeReceiptItem_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Sale" DROP CONSTRAINT "Sale_combinedDocumentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Sale" DROP CONSTRAINT "Sale_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Sale" DROP CONSTRAINT "Sale_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Sale" DROP CONSTRAINT "Sale_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Sale" DROP CONSTRAINT "Sale_combinedBillingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SaleItem" DROP CONSTRAINT "SaleItem_stockItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SaleItemSimple" DROP CONSTRAINT "SaleItemSimple_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_saleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_employeeProfileId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CombinedSaleDocument" DROP CONSTRAINT "CombinedSaleDocument_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."CombinedSaleDocument" DROP CONSTRAINT "CombinedSaleDocument_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SaleReturn" DROP CONSTRAINT "SaleReturn_saleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SaleReturn" DROP CONSTRAINT "SaleReturn_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SaleReturn" DROP CONSTRAINT "SaleReturn_refundedByEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SaleReturn" DROP CONSTRAINT "SaleReturn_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SaleReturnItem" DROP CONSTRAINT "SaleReturnItem_saleItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RefundTransaction" DROP CONSTRAINT "RefundTransaction_refundedByEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RefundTransaction" DROP CONSTRAINT "RefundTransaction_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SupplierPayment" DROP CONSTRAINT "SupplierPayment_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SupplierPayment" DROP CONSTRAINT "SupplierPayment_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SupplierPayment" DROP CONSTRAINT "SupplierPayment_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SupplierPaymentReceipt" DROP CONSTRAINT "SupplierPaymentReceipt_receiptId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderOnline" DROP CONSTRAINT "OrderOnline_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderOnline" DROP CONSTRAINT "OrderOnline_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderOnline" DROP CONSTRAINT "OrderOnline_confirmedByEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderOnline" DROP CONSTRAINT "OrderOnline_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderOnlineItem" DROP CONSTRAINT "OrderOnlineItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CombinedBillingDocument" DROP CONSTRAINT "CombinedBillingDocument_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."CombinedBillingDocument" DROP CONSTRAINT "CombinedBillingDocument_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CombinedBillingDocument" DROP CONSTRAINT "CombinedBillingDocument_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockAuditSession" DROP CONSTRAINT "StockAuditSession_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockAuditSession" DROP CONSTRAINT "StockAuditSession_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockAuditSnapshotItem" DROP CONSTRAINT "StockAuditSnapshotItem_stockItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockAuditSnapshotItem" DROP CONSTRAINT "StockAuditSnapshotItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockAuditScanLog" DROP CONSTRAINT "StockAuditScanLog_stockItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockAuditScanLog" DROP CONSTRAINT "StockAuditScanLog_byEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SimpleLot" DROP CONSTRAINT "SimpleLot_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SimpleLot" DROP CONSTRAINT "SimpleLot_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SaleReturnItemSimple" DROP CONSTRAINT "SaleReturnItemSimple_saleItemSimpleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomerProfile" DROP CONSTRAINT "CustomerProfile_subdistrictCode_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomerDeposit" DROP CONSTRAINT "CustomerDeposit_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomerDeposit" DROP CONSTRAINT "CustomerDeposit_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomerDeposit" DROP CONSTRAINT "CustomerDeposit_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."DepositUsage" DROP CONSTRAINT "DepositUsage_customerDepositId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RepairJob" DROP CONSTRAINT "RepairJob_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RepairJob" DROP CONSTRAINT "RepairJob_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RepairPartItem" DROP CONSTRAINT "RepairPartItem_productId_fkey";

-- DropIndex
DROP INDEX "public"."ProductType_categoryId_idx";

-- DropIndex
DROP INDEX "public"."ProductType_branchId_categoryId_slug_key";

-- DropIndex
DROP INDEX "public"."ProductType_branchId_categoryId_normalizedName_key";

-- AlterTable
ALTER TABLE "public"."CustomerProfile" ALTER COLUMN "subdistrictCode" SET DATA TYPE CHAR(6),
ALTER COLUMN "paymentTerms" SET DEFAULT 0,
ALTER COLUMN "outstandingDebt_v2" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "depositBalance_v2" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."District" DROP COLUMN "created_at";

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_branchId_globalProductTypeId_normalizedName_key" ON "public"."ProductType"("branchId" ASC, "globalProductTypeId" ASC, "normalizedName" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_branchId_globalProductTypeId_slug_key" ON "public"."ProductType"("branchId" ASC, "globalProductTypeId" ASC, "slug" ASC);

-- AddForeignKey
ALTER TABLE "public"."BarcodeReceiptItem" ADD CONSTRAINT "BarcodeReceiptItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BarcodeReceiptItem" ADD CONSTRAINT "BarcodeReceiptItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BranchPrice" ADD CONSTRAINT "BranchPrice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BranchPrice" ADD CONSTRAINT "BranchPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CombinedBillingDocument" ADD CONSTRAINT "CombinedBillingDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CombinedBillingDocument" ADD CONSTRAINT "CombinedBillingDocument_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CombinedBillingDocument" ADD CONSTRAINT "CombinedBillingDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CombinedSaleDocument" ADD CONSTRAINT "CombinedSaleDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CombinedSaleDocument" ADD CONSTRAINT "CombinedSaleDocument_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerDeposit" ADD CONSTRAINT "CustomerDeposit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerDeposit" ADD CONSTRAINT "CustomerDeposit_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerDeposit" ADD CONSTRAINT "CustomerDeposit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerProfile" ADD CONSTRAINT "CustomerProfile_subdistrictCode_fkey" FOREIGN KEY ("subdistrictCode") REFERENCES "public"."Subdistrict"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositUsage" ADD CONSTRAINT "DepositUsage_customerDepositId_fkey" FOREIGN KEY ("customerDepositId") REFERENCES "public"."CustomerDeposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "public"."Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GlobalProductType" ADD CONSTRAINT "GlobalProductType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InputTaxFilingBatch" ADD CONSTRAINT "InputTaxFilingBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InputTaxFilingBatch" ADD CONSTRAINT "InputTaxFilingBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InputTaxFilingItem" ADD CONSTRAINT "InputTaxFilingItem_purchaseOrderReceiptId_fkey" FOREIGN KEY ("purchaseOrderReceiptId") REFERENCES "public"."PurchaseOrderReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOnline" ADD CONSTRAINT "OrderOnline_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOnline" ADD CONSTRAINT "OrderOnline_confirmedByEmployeeId_fkey" FOREIGN KEY ("confirmedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOnline" ADD CONSTRAINT "OrderOnline_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOnline" ADD CONSTRAINT "OrderOnline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderOnlineItem" ADD CONSTRAINT "OrderOnlineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOnOrder" ADD CONSTRAINT "ProductOnOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderReceipt" ADD CONSTRAINT "PurchaseOrderReceipt_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderReceipt" ADD CONSTRAINT "PurchaseOrderReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefundTransaction" ADD CONSTRAINT "RefundTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefundTransaction" ADD CONSTRAINT "RefundTransaction_refundedByEmployeeId_fkey" FOREIGN KEY ("refundedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJob" ADD CONSTRAINT "RepairJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJob" ADD CONSTRAINT "RepairJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairPartItem" ADD CONSTRAINT "RepairPartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_combinedBillingId_fkey" FOREIGN KEY ("combinedBillingId") REFERENCES "public"."CombinedBillingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_combinedDocumentId_fkey" FOREIGN KEY ("combinedDocumentId") REFERENCES "public"."CombinedSaleDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItem" ADD CONSTRAINT "SaleItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItemSimple" ADD CONSTRAINT "SaleItemSimple_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturn" ADD CONSTRAINT "SaleReturn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturn" ADD CONSTRAINT "SaleReturn_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturn" ADD CONSTRAINT "SaleReturn_refundedByEmployeeId_fkey" FOREIGN KEY ("refundedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "public"."SaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleReturnItemSimple" ADD CONSTRAINT "SaleReturnItemSimple_saleItemSimpleId_fkey" FOREIGN KEY ("saleItemSimpleId") REFERENCES "public"."SaleItemSimple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesTaxFilingBatch" ADD CONSTRAINT "SalesTaxFilingBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesTaxFilingBatch" ADD CONSTRAINT "SalesTaxFilingBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesTaxFilingItem" ADD CONSTRAINT "SalesTaxFilingItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceItem" ADD CONSTRAINT "ServiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SimpleLot" ADD CONSTRAINT "SimpleLot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SimpleLot" ADD CONSTRAINT "SimpleLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditScanLog" ADD CONSTRAINT "StockAuditScanLog_byEmployeeId_fkey" FOREIGN KEY ("byEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditScanLog" ADD CONSTRAINT "StockAuditScanLog_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditSession" ADD CONSTRAINT "StockAuditSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditSession" ADD CONSTRAINT "StockAuditSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditSnapshotItem" ADD CONSTRAINT "StockAuditSnapshotItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAuditSnapshotItem" ADD CONSTRAINT "StockAuditSnapshotItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockBalance" ADD CONSTRAINT "StockBalance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockBalance" ADD CONSTRAINT "StockBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockItem" ADD CONSTRAINT "StockItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockItem" ADD CONSTRAINT "StockItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockItem" ADD CONSTRAINT "StockItem_purchaseOrderReceiptItemId_fkey" FOREIGN KEY ("purchaseOrderReceiptItemId") REFERENCES "public"."PurchaseOrderReceiptItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockItem" ADD CONSTRAINT "StockItem_scannedByEmployeeId_fkey" FOREIGN KEY ("scannedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Supplier" ADD CONSTRAINT "Supplier_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "public"."Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Supplier" ADD CONSTRAINT "Supplier_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPaymentReceipt" ADD CONSTRAINT "SupplierPaymentReceipt_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."PurchaseOrderReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."V2StockAudit" ADD CONSTRAINT "V2StockAudit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

