// quick-backup.js
const { Client } = require('pg');
const fs = require('fs');

// ✅ เปลี่ยนมาใช้ DIRECT_URL ตัวจริงที่ได้จากห้องความปลอดภัยของน้าเรียบร้อยแล้ว
const connectionString = "postgresql://postgres.dyumtqejejfrfcxtlfyi:El60IfDkGJxZZPTf@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function runAlphaTechBackup() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('🔌 เชื่อมต่อฐานข้อมูล Supabase (AWS SG Pooler) สำเร็จแล้ว!');
    console.log('⏳ กำลังเริ่มสแกนและกวาดข้อมูลธุรกรรมทุกตารางเพื่อทำ Hardened Backup...');

    // 1. ดึงรายชื่อตารางทั้งหมดในระบบที่อยู่ใน public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `);

    let sqlOutput = `-- 🛡️ AlphaTech Hardened Enterprise Backup\n`;
    sqlOutput += `-- 📅 สร้างเมื่อ: ${new Date().toLocaleString('th-TH')}\n`;
    sqlOutput += `SET statement_timeout = 0;\nSET client_encoding = 'UTF8';\n\n`;
    sqlOutput += `SET CONSTRAINTS ALL DEFERRED;\n\n`;

    // 2. ลุยดึงข้อมูลทีละตารางแล้วแปลงออกมาเป็นคำสั่งสคริปต์ SQL (INSERT INTO)
    for (let row of tablesRes.rows) {
      const tableName = row.table_name;
      if (tableName === '_prisma_migrations') continue;

      console.log(`📦 กำลังประมวลผลกวาดข้อมูลจากตาราง: ${tableName}`);
      
      const dataRes = await client.query(`SELECT * FROM "public"."${tableName}";`);
      
      if (dataRes.rows.length === 0) {
        sqlOutput += `-- ตาราง "${tableName}" ว่างเปล่า (ไม่มีข้อมูล)\n\n`;
        continue;
      }

      sqlOutput += `-- 📋 ข้อมูลจากตาราง: "public"."${tableName}" (${dataRes.rows.length} รายการ)\n`;
      const columns = Object.keys(dataRes.rows[0]).map(col => `"${col}"`).join(', ');

      for (let dataRow of dataRes.rows) {
        const values = Object.values(dataRow).map(val => {
          if (val === null) return 'NULL';
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        }).join(', ');

        sqlOutput += `INSERT INTO "public"."${tableName}" (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
      }
      sqlOutput += `\n`;
    }

    // 3. บันทึกไฟล์ลงเครื่องโลคอล
    const fileName = `alphatech_secure_backup_${new Date().toISOString().split('T')[0]}.sql`;
    fs.writeFileSync(fileName, sqlOutput, 'utf8');
    
    console.log(`\n🎉 [สำเร็จสูงสุด] เกราะป้องกันข้อมูลของน้าเสร็จสมบูรณ์แล้ว!`);
    console.log(`💾 ไฟล์สำรองข้อมูลถูกบันทึกไว้ที่: ${fileName}`);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในระบบสำรองข้อมูลด่วน:', error);
  } finally {
    await client.end();
  }
}

runAlphaTechBackup();