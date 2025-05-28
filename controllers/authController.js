// ✅ authController.js (อัปเดตเพื่อแนบ branch, position, user info เข้ากับ profile)
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const generateToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

const register = async (req, res) => {
  const { email, password, name, phone } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'มีบัญชีนี้อยู่แล้ว' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'customer',
        enabled: true,
        customerProfile: {
          create: {
            name,
            phone,
          },
        },
      },
      include: {
        customerProfile: true,
      },
    });

    const token = generateToken(newUser);

    res.status(201).json({
      token,
      role: newUser.role,
      profile: newUser.customerProfile,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        customerProfile: true,
        employeeProfile: {
          include: { branch: true, position: true },
        },
      },
    });
    
    if (!user || !user.enabled) {
      return res.status(401).json({ message: 'บัญชีไม่มีสิทธิ์เข้าใช้งาน' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    const profile = user.customerProfile || user.employeeProfile;

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        profileId: profile?.id || null,
        branchId: user.employeeProfile?.branchId || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      role: user.role,
      profile: {
        ...profile,
        branch: user.employeeProfile?.branch || null,
        position: user.employeeProfile?.position || null,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          position: true,

        },
      },
    });
  } catch (error) {
    console.error('🔥 Login error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

module.exports = {
  register,
  login,
};

