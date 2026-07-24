# Migration Phases

## Phase 0 — Evidence
เก็บ backup, checksum, row counts, orphan/duplicate report และ relation snapshot

## Phase 1 — Additive Foundation
สร้าง Repair tables และเพิ่ม nullable relation เท่านั้น  
คง `WarrantyClaim.saleReturnItemId` ไว้

## Phase 2 — Conservative Backfill
สร้าง/เชื่อม Repair Job เฉพาะรายการที่พิสูจน์ branch, stock item และ source context ได้  
รายการคลุมเครือ → `MANUAL_REVIEW_REQUIRED`

## Phase 3 — Runtime Cutover
Claim ใหม่ต้องเริ่มจาก Repair Job  
หยุดเขียน `saleReturnItemId` แต่ยังอ่านเพื่อ Trace ได้

## Phase 4 — Constraint
เมื่อ Claim ทุกแถวเชื่อมแล้วและ reconciliation ผ่าน จึงพิจารณา `repairJobId` Required

## Phase 5 — Retire
ย้าย legacy relation เป็น immutable evidence, ยืนยันไม่มี runtime/report ใช้ แล้วจึง Drop ใน Migration แยก
