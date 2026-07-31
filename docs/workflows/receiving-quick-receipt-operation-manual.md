# Receiving / Quick Receipt Operation Manual

## 1. Overview

- Workflow: Receiving without Purchase Order / Quick Receipt
- Owning runtime module: `product/quickStock`
- Business objective: รับสินค้าตามใบส่งของโดยไม่ต้องมี PO รองรับทั้งงานเล็กที่ยืนยันครั้งเดียวและงานหลายรายการที่บันทึกค้างแล้วกลับมารับต่อได้
- Primary users: พนักงานรับสินค้า, ผู้ดูแลคลัง, ผู้จัดการร้าน
- Runtime authority:
  - `src/modules/product/quickStock/services/QuickReceiptSessionService.js`
  - `src/modules/product/quickStock/services/QuickReceiptCompleteService.js`
  - `src/modules/product/quickStock/routes/quickStockRoutes.js`
  - `src/modules/inventory/policies/productInventoryMutationPolicy.js`

## 2. Authority and Branch Isolation

Quick Receipt ทุกคำสั่งต้องอยู่ภายใต้ `branchId` ของผู้ใช้ปัจจุบัน

- รายการรับค้นหาและเปิดได้เฉพาะร้านปัจจุบัน
- Product ต้องเป็น Operational Product ของร้านปัจจุบัน
- Supplier และข้อมูลใบรับต้องใช้ในบริบทร้านปัจจุบัน
- Stock Item, Simple Lot, Stock Movement, Stock Balance และราคาสาขาถูกสร้างหรือปรับเฉพาะร้านปัจจุบัน
- หากมีข้อมูลหมายเลขเดียวกันในร้านอื่น ห้ามนำมาแสดงหรือแก้ไขในร้านปัจจุบัน

## 3. Document Identity

หัวเอกสารบังคับ:

- Supplier
- Delivery Note Number

ระบบ Normalize เลขใบส่งของโดย:

- ตัดช่องว่าง
- แปลงเป็นตัวพิมพ์ใหญ่

ภายในร้านและ Supplier เดียวกัน ห้ามมีเลขใบส่งของเดียวกันซ้ำในสถานะ:

- `DRAFT`
- `FINALIZING`
- `COMPLETED`

การค้นหา Draft รองรับ Supplier และ Delivery Note Number โดยยังจำกัดตามร้านปัจจุบัน

## 4. Two Operating Modes

### 4.1 Resumable Session

เหมาะกับใบส่งของที่มีหลายประเภทสินค้า หรือต้องหยุดและกลับมารับต่อภายหลัง

```text
กรอก Supplier และเลขใบส่งของ
→ เพิ่มสินค้าทีละประเภทไว้ในรายการ
→ บันทึกเป็น Server DRAFT
→ กลับมาเปิด Draft เดิมจาก Supplier หรือเลขใบส่งของ
→ เพิ่ม/ลบ/แก้หัวเอกสารต่อ
→ ยืนยันรับสินค้าครบ
→ FINALIZING
→ COMPLETED
```

### 4.2 One-shot Complete

เหมาะกับงานขนาดเล็กที่มีข้อมูลครบและพร้อมยืนยันในครั้งเดียว

```text
กรอกหัวเอกสารและสินค้าทั้งหมด
→ ส่งคำสั่ง Complete พร้อม X-Idempotency-Key
→ Server สร้าง Draft ภายใน
→ เพิ่มสินค้า
→ Finalize ใน transaction
→ COMPLETED
```

หากขั้นเตรียม One-shot ล้มเหลว ระบบพยายามยกเลิก Draft ที่ยังคงเป็น `DRAFT` เพื่อไม่ให้ผู้ใช้กลับมาเปิดต่อโดยไม่ตั้งใจ หาก cleanup ไม่สำเร็จ Draft ที่เหลือยังเป็นรายการตรวจสอบและกู้คืนได้

## 5. Local Draft Versus Server Draft

### Local Draft

ก่อนมี `receipt.id` Client เก็บหัวเอกสารและรายการสินค้าไว้ใน Local Storage ของ Browser

- ใช้ช่วยรักษาข้อมูลระหว่างการทำงานใน Browser เครื่องเดิม
- ยังไม่ใช่ข้อมูลที่ Server รับรอง
- ไม่สามารถค้นหาจากเครื่องอื่น
- การล้าง Browser storage หรือเปลี่ยนเครื่องอาจทำให้ข้อมูลหาย

### Server Draft

เมื่อกด “เก็บไว้รับต่อภายหลัง” ระบบจะ:

1. ตรวจ Supplier และเลขใบส่งของ
2. สร้างหรือแก้หัวเอกสาร `DRAFT`
3. อัปโหลดรายการสินค้าที่ค้างใน Local Draft
4. แสดง Draft ในรายการค้นหาเพื่อเปิดรับต่อ

Server Draft เป็น Authority สำหรับการ Resume และสามารถเปิดจากเครื่องอื่นได้ภายใต้ร้านเดียวกัน

## 6. Lifecycle

| Status | ความหมาย | Allowed operations |
|---|---|---|
| `DRAFT` | ใบรับยังแก้ไขและรับต่อได้ | แก้หัวเอกสาร, เพิ่ม/ลบสินค้า, Finalize, Cancel |
| `FINALIZING` | Server กำลังเปลี่ยนรายการเป็นสต๊อกใน transaction | ห้ามแก้ไขหรือยืนยันซ้ำด้วยข้อมูลใหม่ |
| `COMPLETED` | รับสินค้าเข้า Stock สำเร็จแล้ว | อ่านผลและเริ่มใบรับใหม่ |
| `CANCELLED` | ยกเลิก Draft แล้ว | อ่านเหตุผลและเริ่มใบรับใหม่ |

`COMPLETED` และ `CANCELLED` เป็นสถานะล็อกบน Client

## 7. Line Requirements

แต่ละ Product Line ต้องมี:

- Product ID
- Quantity มากกว่า 0
- Cost Price มากกว่า 0
- Retail Price มากกว่า 0

ราคา Wholesale, Technician และ Online เป็นข้อมูลเสริม

### Structured Product

- จำนวน Barcode ต้องตรงกับ Quantity
- Barcode ห้ามซ้ำภายในใบรับ
- Barcode ห้ามมีอยู่ในระบบแล้ว
- Serial Number ห้ามซ้ำภายในใบรับ
- Serial Number ห้ามมีอยู่ในระบบแล้ว
- เมื่อสำเร็จ Server สร้าง Stock Item ต่อหน่วยในสถานะ `IN_STOCK`

### Simple Product

- Server สร้าง Simple Lot ตาม Quantity และ Unit Cost
- ไม่สร้าง Stock Item ต่อหน่วยแบบ Structured

ทุก Product Line สร้าง Stock Movement ประเภท `RECEIVE` และปรับ Stock Balance ของร้าน

## 8. Finalize Transaction

Finalize ต้องมี `X-Idempotency-Key`

Server ดำเนินการภายใน transaction:

1. Lock Receipt ตาม Receipt ID และ Branch ID
2. ตรวจ Idempotency Command เดิม
3. ตรวจสถานะต้องเป็น `DRAFT` หรือคืนผลเดิมหาก `COMPLETED`
4. ตรวจว่ามีสินค้าอย่างน้อยหนึ่งรายการ
5. ตรวจ Product และ Product Mode
6. ตรวจ Barcode และ Serial collision
7. เปลี่ยนเป็น `FINALIZING`
8. Upsert ราคาสาขา
9. สร้าง Stock Item หรือ Simple Lot
10. สร้าง Stock Movement
11. ปรับ Stock Balance
12. บันทึก Finalize Command
13. เปลี่ยนเป็น `COMPLETED`

หากขั้นใดล้มเหลว transaction ต้อง rollback เพื่อไม่ให้เกิด Stock บางส่วน

## 9. Idempotency

Client สร้าง Command Key ตาม Payload fingerprint และเก็บ Key เดิมไว้ระหว่างคำขอที่ยังไม่สำเร็จ

- Retry Payload เดิมด้วย Key เดิมต้องคืนผลเดิมหรือดำเนินการเพียงครั้งเดียว
- Key เดิมกับ Payload คนละชุดใน One-shot Complete ต้องถูกปฏิเสธด้วย Conflict
- ห้ามสร้าง Key ใหม่ซ้ำ ๆ เพื่อข้ามข้อผิดพลาดที่ยังไม่ได้แก้

เมื่อเกิด timeout หรือไม่แน่ใจว่าคำสั่งสำเร็จหรือไม่ ให้รีเฟรช/ค้นหาใบรับเดิมก่อนเริ่มใหม่

## 10. Tax Document Capture Boundary

Quick Receipt รองรับการบันทึกข้อมูลเอกสารภาษีที่มากับสินค้า เช่น:

- Tax Document Mode
- Supplier Tax Invoice Number
- Supplier Tax Invoice Date
- Tax Pricing Mode
- Document Subtotal
- VAT Amount
- Document Total Amount

การบันทึกข้อมูลเหล่านี้ไม่ได้หมายความว่าเอกสารถูกยื่นหรือผ่านการตรวจภาษีแล้ว การคัดเลือกและควบคุมภาษีซื้อเป็น Authority ของ Input Tax workflow แยกต่างหาก

## 11. Operational Checklist

### ก่อนเริ่ม

- [ ] ยืนยันร้าน/สาขาที่กำลังทำงาน
- [ ] ตรวจ Supplier
- [ ] ตรวจเลขและวันที่ใบส่งของ
- [ ] ตรวจว่าไม่มี Draft หรือ Completed เดิมของ Supplier + เลขใบส่งของเดียวกัน
- [ ] ตรวจว่าจะใช้ Session หรือ One-shot

### ระหว่างรับสินค้า

- [ ] เลือก Product ที่ถูกต้อง
- [ ] ตรวจ Product Mode
- [ ] ตรวจ Quantity, Cost และ Retail Price
- [ ] ตรวจ Barcode และ Serial ของ Structured Product
- [ ] เพิ่มสินค้าแต่ละประเภทเข้ารายการ
- [ ] ใช้ “เก็บไว้รับต่อภายหลัง” เมื่อยังรับไม่ครบ

### ก่อน Finalize

- [ ] ตรวจ Supplier และใบส่งของอีกครั้ง
- [ ] ตรวจรายการสินค้าและจำนวนรวม
- [ ] ตรวจ Barcode/Serial ซ้ำ
- [ ] ตรวจข้อมูลภาษีที่ได้รับจริง
- [ ] ยืนยันว่ารับสินค้าครบตามใบส่งของ
- [ ] กด Finalize เพียงครั้งเดียวและรอผล

### หลัง Completed

- [ ] ตรวจสถานะ `COMPLETED`
- [ ] ตรวจจำนวนสินค้าเข้า Stock
- [ ] ตรวจข้อมูลราคาและ Stock Movement หากพบความผิดปกติ
- [ ] เริ่มใบรับใหม่จากปุ่มที่ระบบกำหนด

## 12. Recovery and Troubleshooting

### Browser ปิดหรือเครื่องดับก่อน Save for Later

เปิด Browser เครื่องเดิมและตรวจ Local Draft หากข้อมูลยังอยู่ ให้ตรวจทานก่อนบันทึก Server Draft

### ต้องการรับต่อจากเครื่องอื่น

ต้องกด “เก็บไว้รับต่อภายหลัง” ให้เกิด Server Draft ก่อน แล้วค้นหาด้วย Supplier หรือเลขใบส่งของ

### พบ Duplicate Delivery Note

ค้นหารายการเดิมก่อน ห้ามเปลี่ยนเลขใบส่งของเพื่อหลบ Duplicate โดยไม่มีเหตุผลทางธุรกิจ

### Barcode Quantity Mismatch

ตรวจว่า Structured Product มี Barcode ครบตาม Quantity

### Barcode หรือ Serial ซ้ำ

ตรวจทั้งรายการในใบรับและประวัติสินค้าเดิม ห้ามแก้โดยสร้างรหัสสุ่มแทนอุปกรณ์จริง

### Finalize timeout หรือไม่ทราบผล

ค้นหา Receipt เดิมและตรวจสถานะก่อน Retry ใช้ Idempotency เดิมสำหรับคำสั่งเดิม

### Receipt อยู่ `FINALIZING` นานผิดปกติ

หยุดแก้ไขหรือสร้างรายการซ้ำ เก็บ Receipt Code, Supplier, Delivery Note และเวลา แล้วส่งให้ผู้ดูแลตรวจ transaction/runtime

### One-shot ล้มเหลวและพบ Draft ค้าง

ตรวจเหตุผลใน Draft หากข้อมูลถูกต้องสามารถพิจารณารับต่อผ่าน Session ได้ แต่หากเป็น Draft จากการเตรียมที่ไม่สมบูรณ์ให้ยกเลิกตามหลักฐานจริง

## 13. FAQ

### รับสินค้าโดยไม่มี PO ได้หรือไม่

ได้ Quick Receipt ถูกออกแบบสำหรับการรับตามใบส่งของโดยไม่ต้องมี Purchase Order

### ใบส่งของหนึ่งใบรับทีละหลาย Product ได้หรือไม่

ได้ Session หนึ่งรายการรวบรวมหลาย Product Line จนกว่าจะรับครบ

### ยังไม่มีใบกำกับภาษีทำอย่างไร

เลือก Tax Document Mode ตามข้อเท็จจริงและแนบเอกสารภายหลังผ่าน Input Tax workflow

### แก้รายการหลัง Completed ได้หรือไม่

ไม่ได้ผ่าน Draft operation ปกติ เพราะ Stock mutation เสร็จแล้ว ต้องใช้ workflow แก้ไข/คืน/ปรับ Stock ที่ได้รับอนุมัติแยกต่างหาก

## 14. Evidence Boundary

เอกสารนี้อธิบาย Runtime Contract จาก Source Code ไม่ใช่หลักฐานว่า Production execution ผ่าน

การรับรอง Production ต้องแยกหลักฐาน:

- Focused contract/test
- Build/CI
- Runtime API result
- Stock mutation evidence
- Human operational verification
