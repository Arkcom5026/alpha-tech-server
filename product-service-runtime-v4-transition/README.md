# AlphaTech Product Service Runtime v4 — Transitional Foundation

แพ็กนี้เป็น **Transitional / Data-Preserving Foundation** สำหรับเชื่อม Warranty Claim เดิมเข้าสู่ Repair Runtime โดยไม่ลบข้อมูลใช้งานจริง

## Authority

- Repair Intake / Repair Job เป็นจุดเริ่มของ Warranty Claim ใหม่
- Warranty Claim เป็น Child Process ของ Repair Job
- Sale Return เป็น Workflow อิสระ และเริ่มหลัง Repair Job ปิด
- Cross-flow relation ใช้เป็นหลักฐานอ้างอิงเท่านั้น
- Migration ต้องใช้ลำดับ Add → Backfill → Verify → Constrain → Retire

## สิ่งสำคัญใน schema รุ่นนี้

- `WarrantyClaim.repairJobId` ยังเป็น Nullable เพื่อรองรับข้อมูลเดิม
- `WarrantyClaim.saleReturnItemId` ยังคงอยู่ในสถานะ `LEGACY_READ_ONLY`
- เพิ่ม `WarrantyClaim.repairLinkState` เพื่อแยกรายการที่เชื่อมแล้วและรายการที่ต้องตรวจด้วยคน
- `RepairJob.customerId` เป็น Nullable เพื่อรองรับงานซ่อมสินค้าภายในร้านและข้อมูลเดิมที่ยังพิสูจน์ลูกค้าไม่ได้
- ไม่มีการ Drop คอลัมน์ประวัติเดิมใน Phase นี้

## ห้ามทำ

- ห้าม `prisma migrate reset`
- ห้าม `prisma db push` กับฐานใช้งานจริง
- ห้ามแก้ Migration ที่ Apply แล้ว
- ห้ามตอบรับ Migration Prompt ก่อนตรวจ SQL
- ห้ามทำ `repairJobId` Required ก่อน Backfill และ Reconciliation ผ่าน

## ลำดับใช้งาน

1. แตก ZIP ลงใน repository
2. รัน `scripts/01-capture-safety-evidence.ps1`
3. รัน SQL audit ผ่าน Supabase SQL Editor หรือ psql
4. นำ `schema.prisma` ไปเปรียบเทียบกับ `prisma/schema.prisma`
5. รัน `npx prisma format` และ `npx prisma validate`
6. สร้าง Migration แบบ `--create-only`
7. ส่ง `migration.sql` กลับมาตรวจ **ก่อน Apply**
