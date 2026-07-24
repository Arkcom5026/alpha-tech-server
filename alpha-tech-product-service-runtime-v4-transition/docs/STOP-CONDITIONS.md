# Stop Conditions

หยุดทันทีและห้าม Apply ต่อเมื่อพบข้อใดข้อหนึ่ง:

- Backup หรือ restore test ยังไม่ผ่าน
- Prisma เสนอ Drop ตาราง/คอลัมน์ที่มีข้อมูล
- Migration ทำ `repairJobId` NOT NULL ใน Phase 1
- Migration ลบ `saleReturnItemId`
- Row count ลดลง
- เกิด orphan ใหม่
- Claim ถูกผูก Repair Job ข้าม branch
- SQL มี `DELETE`, `TRUNCATE`, `DROP TABLE`, `DROP COLUMN` หรือ destructive enum rewrite ที่ยังไม่อนุมัติ
- มีข้อมูลที่ตีความไม่ได้แต่สคริปต์พยายามเดา
