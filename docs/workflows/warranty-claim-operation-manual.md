# Warranty Claim Operation Manual

## 1. Overview

- Workflow: Warranty Claim
- Owning module: `repair/claim`
- Business objective: ส่งอุปกรณ์ที่เข้าเงื่อนไขรับประกันหรือบริการภายนอกเข้าสู่กระบวนการเคลม ติดตามสถานะ และบันทึกผลลัพธ์จนปิดรายการอย่างตรวจสอบย้อนกลับได้
- Primary users: พนักงานรับงานซ่อม, ช่าง, ผู้ดูแลงานเคลม, ผู้จัดการร้าน
- Runtime authority:
  - `src/modules/repair/claim/open/openWarrantyClaimService.js`
  - `src/modules/repair/claim/status/updateWarrantyClaimStatusService.js`
  - `src/modules/repair/policies/warrantyClaimPolicy.js`
  - `src/modules/repair/policies/repairTransitionPolicy.js`
  - `src/modules/repair/contracts/repairContract.js`

## 2. Authority and Isolation

Warranty Claim ทุกคำสั่งต้องอยู่ภายใต้ `actor.branchId` ของผู้ใช้ปัจจุบัน

- การค้นหาใบงานซ่อมและรายการเคลมต้องจำกัดเฉพาะร้านปัจจุบัน
- Supplier ที่เลือกต้องเป็น Supplier ที่ Active และอยู่ในร้านเดียวกัน
- Replacement Stock Item ต้องอยู่ในร้านเดียวกัน
- หากไม่พบข้อมูลในร้านปัจจุบัน ระบบต้องตอบว่าไม่พบ แม้ว่ารายการนั้นอาจมีอยู่ในร้านอื่น

ห้ามใช้ข้อมูลข้ามร้านหรือรวมรายการข้ามร้านในหน้าปฏิบัติงานปกติ

## 3. Preconditions for Opening a Claim

ก่อนเปิดงานเคลม ระบบตรวจสอบว่า:

1. มีใบงานซ่อมจริงในร้านปัจจุบัน
2. ใบงานซ่อมยังไม่เป็น `COMPLETED` หรือ `CANCELLED`
3. ใบงานผูกกับอย่างน้อยหนึ่ง Identity ที่ระบบรับรอง:
   - `StockItem`, หรือ
   - `Device`
4. ใบงานยังไม่มี Warranty Claim ที่อยู่ใน Active Status
5. หากเลือก Supplier เอง Supplier ต้อง Active และอยู่ในร้านเดียวกัน
6. หากระบบทราบ Supplier ต้นทางจากประวัติสินค้า Supplier ที่เลือกต้องตรงกับแหล่งรับเข้าตามประวัติ

หากเงื่อนไขใดไม่ผ่าน ห้ามฝืนเปิดรายการเคลมใหม่

## 4. Opening Workflow

```text
ใบงานซ่อมที่ยังดำเนินการอยู่
→ ตรวจพบว่าควรเข้าสู่การรับประกัน/ผู้ให้บริการภายนอก
→ ตรวจ Identity ของอุปกรณ์
→ ตรวจว่าไม่มี Active Claim ซ้ำ
→ ตรวจ Supplier / Service Provider
→ ระบุเหตุผลและข้อมูลอ้างอิง
→ สร้าง Warranty Claim สถานะ DRAFT
```

เมื่อสร้างสำเร็จ ระบบจะ:

- สร้างเลขเคลมที่ไม่ซ้ำ
- ผูกกับใบงานซ่อม
- ผูก Stock Item หรือ Device ที่เกี่ยวข้อง
- บันทึก `repairLinkState = LINKED_VERIFIED`
- บันทึกผู้สร้างและ Lifecycle Event แรก

## 5. Claim Lifecycle

### Status meanings and allowed next actions

| Status | ความหมาย | Allowed next actions |
|---|---|---|
| `DRAFT` | สร้างรายการแล้ว แต่ยังไม่ส่งออก | `SUBMITTED`, `CANCELLED` |
| `SUBMITTED` | ส่งคำขอเคลมแล้ว | `IN_TRANSIT`, `RECEIVED_BY_PROVIDER`, `CANCELLED` |
| `IN_TRANSIT` | อุปกรณ์กำลังขนส่ง | `RECEIVED_BY_PROVIDER`, `CANCELLED` |
| `RECEIVED_BY_PROVIDER` | ผู้ให้บริการรับอุปกรณ์แล้ว | `INSPECTING`, `APPROVED`, `REJECTED` |
| `INSPECTING` | ผู้ให้บริการกำลังตรวจสอบ | `APPROVED`, `REJECTED`, `REPAIRING`, `REPLACEMENT_PENDING`, `CREDIT_PENDING` |
| `APPROVED` | ผู้ให้บริการอนุมัติเคลม | `REPAIRING`, `REPLACEMENT_PENDING`, `CREDIT_PENDING`, `RESOLVED` |
| `REJECTED` | ผู้ให้บริการปฏิเสธเคลม | `RESOLVED` |
| `REPAIRING` | ผู้ให้บริการกำลังซ่อม | `RESOLVED` |
| `REPLACEMENT_PENDING` | รอสินค้าทดแทน | `RESOLVED` |
| `CREDIT_PENDING` | รอเครดิต/การชดเชย | `RESOLVED` |
| `RESOLVED` | ปิดผลเคลมสมบูรณ์ | ไม่มี |
| `CANCELLED` | ยกเลิกรายการ | ไม่มี |

ห้ามเปลี่ยนสถานะนอก Transition ที่ระบบกำหนด

## 6. Active and Terminal Status

Active Status:

- `DRAFT`
- `SUBMITTED`
- `IN_TRANSIT`
- `RECEIVED_BY_PROVIDER`
- `INSPECTING`
- `APPROVED`
- `REJECTED`
- `REPAIRING`
- `REPLACEMENT_PENDING`
- `CREDIT_PENDING`

Terminal Status:

- `RESOLVED`
- `CANCELLED`

ใบงานซ่อมหนึ่งใบไม่ควรมี Active Claim มากกว่าหนึ่งรายการ

## 7. Resolution Rules

เมื่อเปลี่ยนสถานะเป็น `RESOLVED` ต้องระบุผลการเคลมหนึ่งค่า:

- `REPAIRED`
- `REPLACED`
- `CREDITED`
- `REFUNDED`
- `RETURNED_UNCHANGED`
- `REJECTED`
- `WRITTEN_OFF`

ข้อบังคับเพิ่มเติม:

- `REPLACED` ต้องระบุ `replacementStockItemId`
- Replacement Stock Item ต้องอยู่ในร้านเดียวกัน
- `CREDITED` ต้องระบุ `creditAmount`
- ระบบบันทึก `resolvedAt` และผู้ปิดผล

ห้ามใช้ `RESOLVED` เพื่อข้ามการบันทึกผลลัพธ์ที่จำเป็น

## 8. Required Operational Evidence

ข้อมูลที่ควรบันทึกตามสถานการณ์:

- เหตุผลส่งเคลม
- Supplier หรือ Service Provider
- External Claim Reference
- Tracking Number
- หมายเหตุแต่ละ Transition
- Resolution และ Resolution Note
- Replacement Stock Item เมื่อเปลี่ยนสินค้า
- Credit Amount เมื่อรับเครดิต

ข้อมูลเหล่านี้ใช้ติดตามงาน แจ้งลูกค้า และตรวจสอบย้อนหลัง

## 9. Operational Checklist

### ก่อนส่งเคลม

- [ ] ตรวจใบงานซ่อมและ Identity ของอุปกรณ์
- [ ] ตรวจว่างานยังไม่ปิดหรือยกเลิก
- [ ] ตรวจว่าไม่มี Active Claim ซ้ำ
- [ ] ตรวจสิทธิ์ประกันและแหล่งรับเข้าสินค้า
- [ ] ตรวจ Supplier / Service Provider
- [ ] ระบุเหตุผลและหลักฐานที่เกี่ยวข้อง

### ตอนส่งและติดตาม

- [ ] เปลี่ยน `DRAFT` เป็น `SUBMITTED` เมื่อส่งจริง
- [ ] บันทึก External Claim Reference เมื่อได้รับ
- [ ] บันทึก Tracking Number เมื่อมีการขนส่ง
- [ ] เปลี่ยนเป็น `RECEIVED_BY_PROVIDER` เมื่อผู้ให้บริการรับแล้ว
- [ ] บันทึกผลตรวจและสถานะที่ตรงกับเหตุการณ์จริง
- [ ] แจ้งความคืบหน้าแก่ลูกค้าตามนโยบายร้าน

### ก่อนปิดผล

- [ ] ตรวจสถานะปัจจุบันและ Transition ที่อนุญาต
- [ ] ระบุ Resolution
- [ ] ระบุ Replacement Stock Item เมื่อเป็น `REPLACED`
- [ ] ระบุ Credit Amount เมื่อเป็น `CREDITED`
- [ ] บันทึก Resolution Note และหลักฐาน
- [ ] ตรวจผลกระทบต่อใบงานซ่อมและการส่งมอบลูกค้า

## 10. Recovery and Troubleshooting

### เปิดเคลมไม่ได้เพราะงานซ่อมปิดแล้ว

ห้ามเปิดเคลมจากใบงานสถานะ `COMPLETED` หรือ `CANCELLED` ตรวจสอบว่าควรเปิดกระบวนการใหม่ตามนโยบายร้านหรือไม่

### ระบบแจ้งว่าไม่มี Stock Item หรือ Device

ใบงานยังไม่มี Identity ที่ระบบรับรอง ต้องผูกอุปกรณ์ให้ถูกต้องก่อนเปิดเคลม

### ระบบแจ้งว่ามี Active Claim อยู่แล้ว

เปิดรายการเดิมและดำเนินการต่อ ห้ามสร้างรายการซ้ำ

### Supplier ไม่พบ

ตรวจว่า Supplier ยัง Active และอยู่ในร้านปัจจุบัน

### Supplier ไม่ตรงกับประวัติ

ตรวจเอกสารแหล่งรับเข้าสินค้า ห้ามเปลี่ยน Supplier เพื่อหลีกเลี่ยงข้อจำกัดโดยไม่มีหลักฐาน

### เปลี่ยนสถานะไม่ได้

ตรวจสถานะปัจจุบันและ Allowed Next Actions ห้ามข้าม Lifecycle

### ปิดเคลมแบบเปลี่ยนสินค้าไม่ได้

ต้องเลือก Replacement Stock Item ที่อยู่ในร้านเดียวกัน

### ปิดเคลมแบบเครดิตไม่ได้

ต้องระบุ Credit Amount

## 11. FAQ

### งานซ่อมกับงานเคลมเป็นรายการเดียวกันหรือไม่

ไม่ใช่ ทั้งสองมี Lifecycle แยกกัน แต่ Warranty Claim ต้องอ้างอิงใบงานซ่อมและอุปกรณ์เดียวกันอย่างถูกต้อง

### สามารถเปิดเคลมหลายรายการพร้อมกันจากใบงานเดียวได้หรือไม่

ไม่ได้ เมื่อมี Active Claim ระบบจะป้องกันรายการซ้ำ

### สามารถยกเลิกเคลมเมื่อใด

ยกเลิกได้เฉพาะ Transition ที่ระบบอนุญาต ได้แก่ช่วง `DRAFT`, `SUBMITTED` หรือ `IN_TRANSIT`

### Status REJECTED ถือว่าปิดรายการแล้วหรือไม่

ยังไม่ใช่ Terminal Status ต้องเปลี่ยนเป็น `RESOLVED` พร้อม Resolution ที่เหมาะสมเพื่อปิดผลอย่างสมบูรณ์

### คู่มือกำหนดให้ทุกเคลมต้องมี Tracking Number หรือไม่

ไม่บังคับทุกกรณี แต่ต้องบันทึกเมื่อมีการขนส่งหรือเมื่อเลขติดตามมีความสำคัญต่อการตรวจสอบ

## 12. Evidence Boundary

เอกสารนี้อธิบาย Business และ Runtime Contract จาก Source Code ปัจจุบัน ไม่อ้างว่า Browser, Production หรือ Operational E2E ผ่านจากการตรวจ Repository เพียงอย่างเดียว

การเปลี่ยน Lifecycle, Validation, Permission หรือ Error Behavior ต้องอัปเดตคู่มือนี้ใน Increment เดียวกัน
