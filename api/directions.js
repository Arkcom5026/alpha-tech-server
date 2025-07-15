/* eslint-env node */

// /api/directions.js

// นี่คือ Serverless Function ที่จะทำงานบน Vercel
// มันจะทำหน้าที่เป็นตัวกลางในการเรียก Google Maps API อย่างปลอดภัย

export default async function handler(req, res) {
    // ดึงค่า origin และ destination จาก query string ที่ส่งมาจาก frontend
    const { origin, destination } = req.query;
  
    // ตรวจสอบว่าได้รับข้อมูลครบถ้วนหรือไม่
    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }
  
    // ดึงค่า API Key และ Base URL จาก Environment Variables
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const googleApiBaseUrl = process.env.GOOGLE_MAPS_DIRECTIONS_API_URL;
  
    // ตรวจสอบว่ามีการตั้งค่า Environment Variables ครบถ้วนหรือไม่
    if (!apiKey || !googleApiBaseUrl) {
      return res.status(500).json({ error: 'API key or Base URL is not configured on the server' });
    }
  
    // สร้าง URL สำหรับเรียก Google Maps API จากค่าที่ได้มา
    const googleApiUrl = `${googleApiBaseUrl}?origin=${origin}&destination=${destination}&key=${apiKey}`;
  
    try {
      // เรียก API จากฝั่งเซิร์ฟเวอร์
      const apiResponse = await fetch(googleApiUrl);
      const data = await apiResponse.json();
  
      // ตั้งค่า Header เพื่ออนุญาต CORS (จำเป็นสำหรับ Vercel)
      res.setHeader('Access-Control-Allow-Origin', '*'); 
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
      // ส่งผลลัพธ์ที่ได้จาก Google กลับไปให้ Frontend
      res.status(200).json(data);
    } catch (error) {
      console.error('Error calling Google Maps API:', error);
      res.status(500).json({ error: 'Failed to fetch driving distance' });
    }
  }
  