const { GoogleGenerativeAI } = require('@google/generative-ai');

async function main() {
  try {
    // ป้องกันกรณีลืมตั้งค่าคีย์
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY environment variable");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // บังคับใช้โมเดลระดับท็อปที่เข้าใจโค้ดสถาปัตยกรรมดีที่สุด
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
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