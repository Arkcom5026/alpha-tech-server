const { GoogleGenerativeAI } = require('@google/generative-ai');

async function main() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY environment variable");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // เปลี่ยนมาใช้โมเดลเจเนอเรชันใหม่ล่าสุดที่เสถียรที่สุดบน SDK ปัจจุบัน
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `คุณคือสถาปนิกซอฟต์แวร์มืออาชีพ (Software Architect) จงวิเคราะห์และสรุปแนวทางการปรับโครงสร้างจากโปรเจกต์นี้ ซึ่งประกอบไปด้วยโฟลเดอร์ api, controllers, routes, prisma, และ middlewares แนะนำแนวทางการจัดกลุ่มโฟลเดอร์ใหม่ให้เป็นระเบียบตามมาตรฐานสากล (เช่น Clean Architecture หรือ Module-based) สรุปออกมาเป็นข้อๆ และร่างไดอะแกรมโครงสร้างใหม่ที่แนะนำมาให้ดูด้วย`;

    const response = await model.generateContent(prompt);
    
    console.log('=======================================================');
    console.log('🏗️ BLUEPRINT REPORT FROM GEMINI ARCHITECT:');
    console.log('=======================================================');
    console.log(response.response.text());
    console.log('=======================================================');
  } catch (error) {
    console.error('❌ Scanner Execution Error:', error.message);
    process.exit(1);
  }
}

main();