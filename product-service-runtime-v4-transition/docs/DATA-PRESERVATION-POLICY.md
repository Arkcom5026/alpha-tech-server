# Data Preservation Policy

ข้อมูลใช้งานจริงมี Authority สูงกว่า Blueprint ใหม่

## Mandatory invariants

1. จำนวนแถว WarrantyClaim ก่อนและหลัง Phase 1 ต้องเท่ากัน
2. `claimNo`, `branchId`, `stockItemId`, จำนวนเงิน และ timestamp เดิมต้องไม่เปลี่ยน
3. WarrantyClaimEvent และ WarrantyClaimCompletionCommand ต้องไม่หาย
4. `saleReturnItemId` เดิมต้องคงอยู่จนกว่าจะย้ายเป็น immutable evidence และพิสูจน์ครบ
5. รายการที่เชื่อม Repair Job ไม่ได้ต้องเป็น `MANUAL_REVIEW_REQUIRED` ไม่ใช่ถูกลบหรือเดา
6. ห้าม Cross-branch linkage
7. ทุก Migration ต้องมี pre-check และ post-check
8. การ Retire legacy column ต้องเป็น Migration คนละรอบหลัง Runtime เลิกอ่านแล้ว
