const nodemailer = require('nodemailer');

const SMTP_HOST = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true';
const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = (process.env.SMTP_PASS || '').trim();
const MAIL_FROM_NAME = (process.env.MAIL_FROM_NAME || 'SaduakSabuy').trim();
const MAIL_FROM_EMAIL = (process.env.MAIL_FROM_EMAIL || SMTP_USER).trim();

let cachedTransporter = null;

const getMissingMailConfig = () => {
  const missing = [];

  if (!SMTP_HOST) missing.push('SMTP_HOST');
  if (!SMTP_PORT) missing.push('SMTP_PORT');
  if (!SMTP_USER) missing.push('SMTP_USER');
  if (!SMTP_PASS) missing.push('SMTP_PASS');
  if (!MAIL_FROM_EMAIL) missing.push('MAIL_FROM_EMAIL');

  return missing;
};

const assertMailConfig = () => {
  const missing = getMissingMailConfig();

  if (missing.length > 0) {
    throw new Error(`Mail configuration is incomplete: ${missing.join(', ')}`);
  }
};

const createTransporter = () => {
  assertMailConfig();

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const getTransporter = () => {
  if (!cachedTransporter) {
    cachedTransporter = createTransporter();
  }

  return cachedTransporter;
};

const getFromAddress = () => {
  if (!MAIL_FROM_NAME) {
    return MAIL_FROM_EMAIL;
  }

  return `"${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`;
};

const verifyMailTransportAction = async () => {
  const transporter = getTransporter();
  await transporter.verify();
  return true;
};

const sendMailAction = async ({ to, subject, text, html, replyTo }) => {
  assertMailConfig();

  if (!to || !String(to).trim()) {
    throw new Error('Recipient email is required');
  }

  if (!subject || !String(subject).trim()) {
    throw new Error('Email subject is required');
  }

  if (!text && !html) {
    throw new Error('Email content is required');
  }

  const transporter = getTransporter();

  const mailOptions = {
    from: getFromAddress(),
    to: String(to).trim(),
    subject: String(subject).trim(),
    text: text ? String(text) : undefined,
    html: html ? String(html) : undefined,
    replyTo: replyTo ? String(replyTo).trim() : undefined,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    return {
      messageId: info.messageId,
      accepted: info.accepted || [],
      rejected: info.rejected || [],
      response: info.response || '',
    };
  } catch (error) {
    console.error('❌ sendMailAction error:', error);
    throw error;
  }
};

module.exports = {
  verifyMailTransportAction,
  sendMailAction,
};
