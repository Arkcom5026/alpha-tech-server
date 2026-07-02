AlphaTech Runtime Test Suite

วางไฟล์ทั้งหมดไว้ใน:
server/scripts/

คำสั่งรันทีละตัว:
node scripts/test-template-search.js
node scripts/test-product-template-clone.js
node scripts/test-quick-stock-template.js

คำสั่งรันทั้งหมด:
node scripts/test-runtime-suite.js

Environment ที่ปรับได้ใน Windows CMD:
set TEST_TEMPLATE_BRANCH_CODE=T01
set TEST_TEMPLATE_SEARCH=canon
set TEST_TEMPLATE_PRODUCT_ID=201
set TEST_TARGET_BRANCH_ID=2
set TEST_EMPLOYEE_ID=35
set TEST_UNIT_COST=350
set TEST_BARCODE=QS-TPL-0001
set TEST_SERIAL_NUMBER=SN-0001

หมายเหตุ:
- test-template-search ทดสอบ Product Template Search Service
- test-product-template-clone ทดสอบ Clone Engine + Duplicate Guard
- test-quick-stock-template ทดสอบ QuickStock รับสินค้าโดยใช้ productId จาก T01 แล้ว Auto Clone เข้า Branch จริง
