const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function testEmail() {
  console.log("Config:", {
    host: process.env.EMAIL_SERVER,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    from: process.env.EMAIL_FROM,
    to: process.env.ADMIN_EMAIL
  });

  const crypto = require('crypto');

  const smtpHost = process.env.AWS_SMTP_HOST || process.env.EMAIL_SERVER || 'email-smtp.eu-north-1.amazonaws.com';
  const smtpPort = parseInt(process.env.AWS_SMTP_PORT || process.env.EMAIL_PORT || '465');

  // Extract AWS SES Region from SMTP Host to derive signing key correctly
  const regionMatch = smtpHost.match(/email-smtp\.(.*?)\.amazonaws\.com/);
  const sesRegion = regionMatch ? regionMatch[1] : 'eu-north-1';

  function getSmtpPassword(secretKey, region) {
    if (!secretKey) return '';
    const date = "11111111";
    const service = "ses";
    const terminal = "aws4_request";
    const message = "SendRawEmail";
    const version = 0x04;

    let signature = crypto.createHmac('sha256', "AWS4" + secretKey).update(date).digest();
    signature = crypto.createHmac('sha256', signature).update(region).digest();
    signature = crypto.createHmac('sha256', signature).update(service).digest();
    signature = crypto.createHmac('sha256', signature).update(terminal).digest();
    signature = crypto.createHmac('sha256', signature).update(message).digest();

    const signatureAndVersion = Buffer.alloc(signature.length + 1);
    signatureAndVersion.writeUInt8(version, 0);
    signature.copy(signatureAndVersion, 1);

    return signatureAndVersion.toString('base64');
  }

  const smtpUser = process.env.AWS_ACCESS_KEY_ID || process.env.EMAIL_USER;
  const smtpPass = process.env.AWS_SECRET_ACCESS_KEY 
    ? getSmtpPassword(process.env.AWS_SECRET_ACCESS_KEY, sesRegion) 
    : process.env.EMAIL_PASS;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
        rejectUnauthorized: false
    }
  });

  try {
    console.log("Verifying transporter...");
    await transporter.verify();
    console.log("✅ Transporter verified!");

    console.log("Sending test mail...");
    const info = await transporter.sendMail({
      from: `"PAIRO Test" <${process.env.EMAIL_FROM}>`,
      to: "support@pairolifestyle.com",
      subject: "PAIRO Email Connectivity Test",
      text: "If you are reading this, your SMTP configuration is working correctly.",
      html: "<b>If you are reading this, your SMTP configuration is working correctly.</b>"
    });

    console.log("✅ Email sent successfully!");
    console.log("Message ID:", info.messageId);
    process.exit(0);
  } catch (err) {
    console.error("❌ Email test failed!");
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
    if (err.code) console.error("Error Code:", err.code);
    if (err.command) console.error("Error Command:", err.command);
    process.exit(1);
  }
}

testEmail();
