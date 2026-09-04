import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dbConnect from './db';
import Staff from '@/models/Staff';
import Role from '@/models/Role';
import { escapeHtml } from './sanitize';

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
});

/**
 * Send Email Verification to New Customer
 */
export async function sendEmailVerification(toEmail, name, verificationUrl) {
  const firstName = name?.split(' ')[0] || 'there';

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 560px; margin: auto; color: #1a1a1a; background: #fff;">
      <div style="background: #1a1a1a; padding: 28px 32px; text-align: center;">
        <h1 style="color: #fff; margin: 0; letter-spacing: 6px; font-size: 22px; font-weight: 800; text-transform: uppercase;">PAIRO</h1>
        <p style="color: #888; margin: 6px 0 0; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">Lifestyle Collection</p>
      </div>
      <div style="padding: 48px 40px; background: #fff;">
        <h2 style="font-size: 24px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.5px;">Verify Your Email</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.7; margin: 0 0 32px;">
          Hi ${firstName}, welcome to PAIRO Lifestyle.<br/>
          Please verify your email address to activate your account and start shopping.
        </p>
        <div style="text-align: center; margin: 36px 0;">
          <a href="${verificationUrl}"
             style="display: inline-block; background: #1a1a1a; color: #fff; padding: 16px 40px; border-radius: 3px; font-size: 12px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; text-decoration: none;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #999; font-size: 12px; line-height: 1.6; border-top: 1px solid #f0f0f0; padding-top: 24px; margin: 0;">
          This link expires in <strong>24 hours</strong>.<br/>
          If you did not create an account at PAIRO, you can safely ignore this email.
        </p>
        <p style="color: #bbb; font-size: 11px; margin-top: 12px;">
          Or copy this link into your browser:<br/>
          <span style="color: #555; word-break: break-all;">${verificationUrl}</span>
        </p>
      </div>
      <div style="border-top: 1px solid #eee; padding: 18px 32px; text-align: center; background: #fafafa;">
        <p style="font-size: 11px; color: #bbb; text-transform: uppercase; letter-spacing: 2px; margin: 0;">
          PAIRO Lifestyle • pairolifestyle.com
        </p>
      </div>
    </div>
  `;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Verification Email → ${toEmail} | URL: ${verificationUrl}`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"PAIRO Lifestyle" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Verify your email — PAIRO Lifestyle`,
      html,
    });
    console.log(`[Email] ✅ Verification email sent to ${toEmail} | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send verification email:', err.message);
    throw err;
  }
}

/**
 * Send Email Verification to New Affiliate Applicant
 */
export async function sendAffiliateEmailVerification(toEmail, name, verificationUrl) {
  const firstName = name?.split(' ')[0] || 'there';

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 560px; margin: auto; color: #1a1a1a; background: #fff;">
      <div style="background: #1a1a1a; padding: 28px 32px; text-align: center;">
        <h1 style="color: #fff; margin: 0; letter-spacing: 6px; font-size: 22px; font-weight: 800; text-transform: uppercase;">PAIRO</h1>
        <p style="color: #888; margin: 6px 0 0; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">Affiliate Partners</p>
      </div>
      <div style="padding: 48px 40px; background: #fff;">
        <h2 style="font-size: 24px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.5px;">Verify Your Email</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.7; margin: 0 0 32px;">
          Hi ${firstName}, thank you for applying to the PAIRO Affiliate Program.<br/>
          Please verify your email address to submit your application for review.
        </p>
        <div style="text-align: center; margin: 36px 0;">
          <a href="${verificationUrl}"
             style="display: inline-block; background: #1a1a1a; color: #fff; padding: 16px 40px; border-radius: 3px; font-size: 12px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; text-decoration: none;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #999; font-size: 12px; line-height: 1.6; border-top: 1px solid #f0f0f0; padding-top: 24px; margin: 0;">
          This link expires in <strong>24 hours</strong>.<br/>
          If you did not apply for the Pairo Affiliate Program, you can safely ignore this email.
        </p>
        <p style="color: #bbb; font-size: 11px; margin-top: 12px;">
          Or copy this link into your browser:<br/>
          <span style="color: #555; word-break: break-all;">${verificationUrl}</span>
        </p>
      </div>
      <div style="border-top: 1px solid #eee; padding: 18px 32px; text-align: center; background: #fafafa;">
        <p style="font-size: 11px; color: #bbb; text-transform: uppercase; letter-spacing: 2px; margin: 0;">
          PAIRO Lifestyle • pairolifestyle.com
        </p>
      </div>
    </div>
  `;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Affiliate Verification Email → ${toEmail} | URL: ${verificationUrl}`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"PAIRO Affiliates" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Verify your email — PAIRO Affiliates`,
      html,
    });
    console.log(`[Email] ✅ Affiliate verification email sent to ${toEmail} | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send affiliate verification email:', err.message);
    throw err;
  }
}


/**
 * Send Order Confirmation Email to Customer
 */
export async function sendOrderConfirmation(order) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Confirmation → ${order.customer?.email}`);
    return;
  }

  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td style="padding: 12px 10px; border-bottom: 1px solid #eee;">
        <strong>${item.name}</strong><br/>
        <small style="color:#666;">${item.selectedVariant?.title || ''}</small>
      </td>
      <td style="padding: 12px 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px 10px; border-bottom: 1px solid #eee; text-align: right;">$${((item.priceAtPurchase || 0) * (item.quantity || 1)).toLocaleString()}</td>
    </tr>
  `).join('');

  const accountSectionHtml = order.guestAccount?.created && order.guestAccount?.temporaryPassword
    ? `
      <div style="margin-top: 32px; background: linear-gradient(135deg, #f8f5f0 0%, #fff 100%); border: 1px solid #e7dfd3; border-radius: 14px; padding: 24px;">
        <h3 style="margin: 0 0 10px; font-size: 18px; color: #1a1a1a;">Your Customer Account Has Been Created</h3>
        <p style="margin: 0 0 14px; color: #5f574d; line-height: 1.6;">
          Thank you for your order! We created your customer account so you can track orders, view your order history, save addresses, and checkout faster next time.
        </p>
        <div style="background: #fff; border: 1px solid #efe6da; border-radius: 10px; padding: 16px;">
          <p style="margin: 0 0 8px; color: #222; font-size: 14px;"><strong>Login Email:</strong> ${order.guestAccount.loginEmail || order.customer?.email}</p>
          <p style="margin: 0 0 8px; color: #222; font-size: 14px;"><strong>Temporary Password:</strong> <span style="font-family: monospace; background: #f6f2ec; padding: 2px 6px; border-radius: 4px;">${order.guestAccount.temporaryPassword}</span></p>
          <p style="margin: 12px 0 0;">
            <a href="${order.guestAccount.loginUrl || 'https://yourdomain.com/login'}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 999px; font-weight: 600;">Log in to your account</a>
          </p>
        </div>
        <p style="margin: 12px 0 0; color: #7a705f; font-size: 13px;">For security, we recommend changing your password after your first login.</p>
      </div>
    ` : '';

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: auto; color: #1a1a1a;">
      <div style="background: #1a1a1a; padding: 30px; text-align: center;">
        <h1 style="color: #fff; margin: 0; letter-spacing: -1px; font-size: 28px;">PAIRO</h1>
      </div>
      <div style="padding: 40px 30px;">
        <h2 style="font-size: 20px; margin-bottom: 8px;">Order Confirmed ✓</h2>
        <p style="color: #555; margin-bottom: 24px;">
          Hi ${order.shippingAddress?.fullName?.split(' ')[0] || 'there'}, thank you for your acquisition.<br/>
          Your order <strong>#${order.orderNumber}</strong> has been confirmed and is being prepared for dispatch.
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; color: #888;">Product</th>
              <th style="padding: 10px; font-size: 11px; text-transform: uppercase; color: #888;">Qty</th>
              <th style="text-align: right; padding: 10px; font-size: 11px; text-transform: uppercase; color: #888;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 14px 10px; text-align: right; font-weight: 700;">Total Paid</td>
              <td style="padding: 14px 10px; text-align: right; font-weight: 700;">$${(order.financials?.total || 0).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
        ${accountSectionHtml}
        <div style="background: #f9f9f9; border-left: 4px solid #1a1a1a; padding: 20px; border-radius: 4px; margin-top: 30px;">
          <h3 style="margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Shipping To</h3>
          <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #333;">
            ${order.shippingAddress?.fullName || ''}<br/>
            ${order.shippingAddress?.street || ''}<br/>
            ${order.shippingAddress?.city || ''}, ${order.shippingAddress?.zip || ''}<br/>
            ${order.shippingAddress?.country || ''}
          </p>
        </div>
      </div>
      <div style="border-top: 1px solid #eee; padding: 20px 30px; text-align: center;">
        <p style="font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 2px; margin: 0;">
          Pairo Excellence • Global Acquisition Logistics
        </p>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"PAIRO Store" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: order.customer?.email,
      subject: `Order Confirmed: #${order.orderNumber}`,
      html,
    });
    console.log(`[Email] ✅ Confirmation sent to ${order.customer?.email} | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send confirmation:', err.message);
    throw err;
  }
}

/**
 * Send Admin Notification for New Order
 */
export async function sendAdminOrderNotification(order) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Admin notified of Order ${order.orderNumber}`);
    return;
  }

  let adminEmail = process.env.ADMIN_EMAIL;

  // Fallback: If ADMIN_EMAIL is not set, try to find the Super Admin
  if (!adminEmail) {
    try {
        await dbConnect();
        const superAdminRole = await Role.findOne({ slug: 'super-admin' });
        if (superAdminRole) {
            const superAdmin = await Staff.findOne({ roleId: superAdminRole._id });
            if (superAdmin) adminEmail = superAdmin.email;
        }
    } catch (e) {
        console.error("Failed to fetch super admin for email fallback:", e.message);
    }
  }

  if (!adminEmail) {
    console.warn('[Email] ADMIN_EMAIL and Super Admin not found — skipping admin notification.');
    return;
  }

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 500px; margin: auto; color: #1a1a1a;">
      <div style="background: #1a1a1a; padding: 20px 30px;">
        <h2 style="color: #fff; margin: 0; font-size: 18px;">🛍 New Order Received</h2>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border: 1px solid #eee;">
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #666;">Order Number</td><td style="padding: 8px 0; font-weight: 700;">#${order.orderNumber}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Customer</td><td style="padding: 8px 0;">${order.shippingAddress?.fullName || 'N/A'}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;">${order.customer?.email || 'N/A'}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Items</td><td style="padding: 8px 0;">${(order.items || []).length}</td></tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 700; font-size: 16px;">Total</td>
            <td style="padding: 12px 0; font-weight: 700; font-size: 16px;">$${(order.financials?.total || 0).toLocaleString()}</td>
          </tr>
        </table>
        <div style="margin-top: 24px;">
          <a href="${process.env.NEXTAUTH_URL}/admin/orders/${order._id}"
             style="background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 700;">
            View Order in Dashboard →
          </a>
        </div>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"PAIRO System" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `🛍 New Order: #${order.orderNumber} — $${(order.financials?.total || 0).toLocaleString()}`,
      html,
    });
    console.log(`[Email] ✅ Admin notified (${adminEmail}) | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send admin notification:', err.message);
    throw err;
  }
}

/**
 * Send CRM Reply to Customer Submission
 */
export async function sendSubmissionReply(toEmail, subject, message, customerName) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] CRM Reply → ${toEmail} | Subject: ${subject}`);
    return;
  }

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: auto; color: #1a1a1a; line-height: 1.6;">
      <div style="background: #1a1a1a; padding: 25px; text-align: center;">
        <h1 style="color: #fff; margin: 0; letter-spacing: 2px; font-size: 20px; font-weight: 300;">PAIRO CONCIERGE</h1>
      </div>
      <div style="padding: 40px 30px; background: #fff;">
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">Dear ${customerName || 'Customer'},</p>
        <div style="font-size: 15px; color: #1a1a1a; white-space: pre-wrap;">${message}</div>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
          <p style="font-size: 13px; color: #888; margin: 0;">Kind Regards,</p>
          <p style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin: 5px 0;">The Pairo Team</p>
        </div>
      </div>
      <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">
        © ${new Date().getFullYear()} PAIRO — Artisanal Heritage • Modern Lifestyle
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"PAIRO Support" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      html,
    });
    console.log(`[Email] ✅ CRM Reply sent to ${toEmail} | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send CRM reply:', err.message);
    throw err;
  }
}

/**
 * Send Affiliate Application Received email
 */
export async function sendAffiliateApplicationReceived(toEmail, affiliateName) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Affiliate Application Received → ${toEmail}`);
    return;
  }

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: auto; color: #1a1a1a; line-height: 1.6;">
      <div style="background: #1a1a1a; padding: 25px; text-align: center;">
        <h1 style="color: #fff; margin: 0; letter-spacing: 2px; font-size: 20px; font-weight: 300;">PAIRO AFFILIATES</h1>
      </div>
      <div style="padding: 40px 30px; background: #fff;">
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">Hi ${affiliateName},</p>
        <p style="font-size: 15px; color: #1a1a1a;">
          Thank you for applying to the Pairo Affiliate Program! We have received your application and identity documents.
        </p>
        <p style="font-size: 15px; color: #1a1a1a; margin-top: 15px;">
          Our review team is auditing your details. You will receive an email update with your login credentials as soon as your account is approved.
        </p>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
          <p style="font-size: 13px; color: #888; margin: 0;">Kind Regards,</p>
          <p style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin: 5px 0;">The Pairo Team</p>
        </div>
      </div>
      <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">
        © ${new Date().getFullYear()} PAIRO — Artisanal Heritage • Modern Lifestyle
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"PAIRO Affiliates" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Affiliate Application Received — Pairo Lifestyle",
      html,
    });
    console.log(`[Email] ✅ Affiliate Application Received sent to ${toEmail}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send application received email:', err.message);
  }
}

/**
 * Send Affiliate Application Approved email
 */
export async function sendAffiliateApplicationApproved(toEmail, affiliateName, referralCode, tempPassword, commissionType = 'Percentage', commissionRate = 5) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Affiliate Application Approved → ${toEmail} | Temp Pass: ${tempPassword}`);
    return;
  }

  const loginUrl = `${process.env.NEXTAUTH_URL || "https://pairolifestyle.com"}/affiliate-login`;

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: auto; color: #1a1a1a; line-height: 1.6;">
      <div style="background: #1a1a1a; padding: 25px; text-align: center;">
        <h1 style="color: #fff; margin: 0; letter-spacing: 2px; font-size: 20px; font-weight: 300;">PAIRO AFFILIATES</h1>
      </div>
      <div style="padding: 40px 30px; background: #fff;">
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">Dear ${affiliateName},</p>
        <p style="font-size: 15px; color: #1a1a1a; font-weight: bold;">
          Congratulations! Your application has been approved.
        </p>
        <p style="font-size: 15px; color: #1a1a1a; margin-top: 15px;">
          You can now log in to your dedicated Affiliate Portal to start generating links, tracking conversions, and viewing commissions.
        </p>
        
        <div style="background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 4px; border-left: 4px solid #1a1a1a;">
          <h4 style="margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Account Details</h4>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Portal Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Login Email Address:</strong> ${toEmail}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Temporary Password:</strong> <code style="background:#eee; padding:2px 6px; font-weight:bold; font-size:14px; border-radius:3px; font-family:monospace;">${tempPassword}</code></p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Referral Code:</strong> ${referralCode}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Commission rate:</strong> ${commissionType === 'Fixed' ? `$${commissionRate} Fixed per product sold` : `${commissionRate}% on all delivered orders`}</p>
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
          <p style="font-size: 13px; color: #888; margin: 0;">Kind Regards,</p>
          <p style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin: 5px 0;">The Pairo Team</p>
        </div>
      </div>
      <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">
        © ${new Date().getFullYear()} PAIRO — Artisanal Heritage • Modern Lifestyle
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"PAIRO Affiliates" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Affiliate Account Approved! — Pairo Lifestyle",
      html,
    });
    console.log(`[Email] ✅ Affiliate Application Approved sent to ${toEmail}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send application approved email:', err.message);
  }
}

/**
 * Send Affiliate Application Rejected email
 */
export async function sendAffiliateApplicationRejected(toEmail, affiliateName, reason) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Affiliate Application Rejected → ${toEmail}`);
    return;
  }

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: auto; color: #1a1a1a; line-height: 1.6;">
      <div style="background: #1a1a1a; padding: 25px; text-align: center;">
        <h1 style="color: #fff; margin: 0; letter-spacing: 2px; font-size: 20px; font-weight: 300;">PAIRO AFFILIATES</h1>
      </div>
      <div style="padding: 40px 30px; background: #fff;">
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">Dear ${affiliateName},</p>
        <p style="font-size: 15px; color: #1a1a1a;">
          Thank you for your interest in the Pairo Affiliate Program.
        </p>
        <p style="font-size: 15px; color: #1a1a1a; margin-top: 15px;">
          After reviewing your application details and marketing channels, we regret to inform you that we are unable to accept your application at this time.
        </p>
        ${reason ? `
        <div style="background: #fff5f5; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0; border-radius: 4px; font-size: 14px; color: #991b1b;">
          <strong>Review Notes:</strong> ${reason}
        </div>
        ` : ''}
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
          <p style="font-size: 13px; color: #888; margin: 0;">Kind Regards,</p>
          <p style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin: 5px 0;">The Pairo Team</p>
        </div>
      </div>
      <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">
        © ${new Date().getFullYear()} PAIRO — Artisanal Heritage • Modern Lifestyle
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"PAIRO Affiliates" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Affiliate Application Update — Pairo Lifestyle",
      html,
    });
    console.log(`[Email] ✅ Affiliate Application Rejected sent to ${toEmail}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send application rejected email:', err.message);
  }
}

/**
 * Send Affiliate Payout Update email
 */
export async function sendAffiliatePayoutUpdate(toEmail, affiliateName, amount, status, notes) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Affiliate Payout Update → ${toEmail}`);
    return;
  }

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: auto; color: #1a1a1a; line-height: 1.6;">
      <div style="background: #1a1a1a; padding: 25px; text-align: center;">
        <h1 style="color: #fff; margin: 0; letter-spacing: 2px; font-size: 20px; font-weight: 300;">PAIRO AFFILIATES</h1>
      </div>
      <div style="padding: 40px 30px; background: #fff;">
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">Dear ${affiliateName},</p>
        <p style="font-size: 15px; color: #1a1a1a;">
          This is an update regarding your affiliate payout request of <strong>$${amount.toLocaleString()}</strong>.
        </p>
        <p style="font-size: 15px; color: #1a1a1a; margin-top: 10px;">
          Status: <strong style="text-transform: uppercase;">${status}</strong>
        </p>
        ${notes ? `
        <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #1a1a1a; margin: 20px 0; border-radius: 4px; font-size: 14px; color: #374151;">
          <strong>Notes:</strong> ${notes}
        </div>
        ` : ''}
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
          <p style="font-size: 13px; color: #888; margin: 0;">Kind Regards,</p>
          <p style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin: 5px 0;">The Pairo Team</p>
        </div>
      </div>
      <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">
        © ${new Date().getFullYear()} PAIRO — Artisanal Heritage • Modern Lifestyle
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"PAIRO Affiliates" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Affiliate Payout Update: $${amount} — Pairo Lifestyle`,
      html,
    });
    console.log(`[Email] ✅ Affiliate Payout Update sent to ${toEmail}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send payout update email:', err.message);
  }
}

/**
 * Send Affiliate Password Reset Email
 */
export async function sendAffiliatePasswordReset(toEmail, name, resetUrl) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Password Reset → ${toEmail} | Reset URL: ${resetUrl}`);
    return;
  }

  const firstName = name?.split(' ')[0] || 'Partner';

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 560px; margin: auto; color: #1a1a1a; background: #fff;">
      <div style="background: #1a1a1a; padding: 28px 32px; text-align: center;">
        <h1 style="color: #fff; margin: 0; letter-spacing: 6px; font-size: 20px; font-weight: 800; text-transform: uppercase;">PAIRO</h1>
        <p style="color: #888; margin: 6px 0 0; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">Partner Portal</p>
      </div>
      <div style="padding: 40px 32px;">
        <h2 style="font-size: 22px; font-weight: 700; margin: 0 0 8px;">Reset Your Password</h2>
        <p style="color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 28px;">
          Hi ${firstName}, we received a request to reset the password for your PAIRO Partner account.<br/>
          Click the button below to create a new password. This link expires in <strong>1 hour</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 36px; border-radius: 3px; font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; text-decoration: none;">
            Reset Password
          </a>
        </div>
        <p style="color: #888; font-size: 12px; line-height: 1.6; border-top: 1px solid #eee; padding-top: 20px; margin: 0;">
          If you did not request a password reset, please ignore this email — your account is safe.<br/>
          For security, do not share this link with anyone.
        </p>
      </div>
      <div style="border-top: 1px solid #eee; padding: 18px 32px; text-align: center;">
        <p style="font-size: 11px; color: #bbb; text-transform: uppercase; letter-spacing: 2px; margin: 0;">
          Pairo Excellence • Partner Programme
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"PAIRO Partners" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Reset Your PAIRO Partner Password`,
      html,
    });
    console.log(`[Email] ✅ Password reset email sent to ${toEmail}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send password reset email:', err.message);
    throw err;
  }
}

/**
 * Send Custom Order / Bespoke Design Request Confirmation Email to Customer
 */
export async function sendCustomOrderConfirmation(order) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Custom Order Confirmation → ${order.customer?.email}`);
    return;
  }

  const item = order.items?.[0] || {};
  const c = item.customization || {};

  let customizationsHtml = '';
  if (c.leatherColor && c.leatherColor !== 'None') {
    customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Leather Color:</strong> ${c.leatherColor} ${c.leatherColorNote ? `(${c.leatherColorNote})` : ''}</p>`;
  }
  if (c.leatherType && c.leatherType !== 'None') {
    customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Leather Type:</strong> ${c.leatherType} ${c.leatherTypeNote ? `(${c.leatherTypeNote})` : ''}</p>`;
  }
  if (c.innerLining && c.innerLining !== 'None') {
    customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Inner Lining:</strong> ${c.innerLining} ${c.innerLiningNote ? `(${c.innerLiningNote})` : ''}</p>`;
  }
  if (c.hardwareColor && c.hardwareColor !== 'None') {
    customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Hardware Color:</strong> ${c.hardwareColor} ${c.hardwareColorNote ? `(${c.hardwareColorNote})` : ''}</p>`;
  }
  if (c.fur?.type && c.fur.type !== 'None') {
    customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Fur Type:</strong> ${c.fur.type} ${c.fur.typeNote ? `(${c.fur.typeNote})` : ''}</p>`;
    if (c.fur.color) customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Fur Color:</strong> ${c.fur.color}</p>`;
    if (c.fur.placement?.length) customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Fur Placement:</strong> ${c.fur.placement.join(', ')}</p>`;
    if (c.fur.density) customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Fur Density:</strong> ${c.fur.density}</p>`;
    if (c.fur.removable !== null) customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Removable Fur:</strong> ${c.fur.removable ? 'Yes' : 'No'}</p>`;
  }

  let artworkHtml = '';
  if (c.artwork && Object.values(c.artwork).some(Boolean)) {
    artworkHtml += '<h4 style="margin:15px 0 5px; font-size:12px; text-transform:uppercase; color:#666; letter-spacing:0.5px;">Uploaded Artwork</h4>';
    Object.entries(c.artwork).forEach(([key, art]) => {
      if (art && art.url) {
        artworkHtml += `<p style="margin:4px 0; font-size:13px;"><strong>${key.replace(/([A-Z])/g, ' $1')}:</strong> <a href="${art.url}" style="color:#2271b1; text-decoration:underline;">${art.name || 'View File'}</a></p>`;
      }
    });
  }

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: auto; color: #1a1a1a;">
      <div style="background: #1a1a1a; padding: 30px; text-align: center;">
        <h1 style="color: #fff; margin: 0; letter-spacing: 2px; font-size: 24px;">PAIRO LIFESTYLE</h1>
      </div>
      <div style="padding: 40px 30px; background: #fff; border: 1px solid #eee; border-top: none;">
        <h2 style="font-size: 18px; margin-top:0; margin-bottom: 12px; color:#1a1a1a; font-weight:700;">Bespoke Design Request Received</h2>
        <p style="color: #555; margin-bottom: 24px; font-size:14px; line-height:1.6;">
          Hi ${order.shippingAddress?.fullName?.split(' ')[0] || 'there'}, thank you for your custom design request.<br/>
          We have received your customization parameters for the product <strong>${item.name || ''}</strong>. Your Design Request ID is <strong>#${order.orderNumber}</strong>, submitted on ${new Date(order.createdAt).toLocaleDateString()}.
        </p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 3px; margin-bottom: 24px; border: 1px solid #eee;">
          <h3 style="margin-top: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color:#333; border-bottom:1px solid #eee; padding-bottom:8px;">Custom Selections</h3>
          ${customizationsHtml}
          ${artworkHtml}
          ${order.customerNote ? `<p style="margin:10px 0 0; font-size:13px; border-top:1px dashed #ddd; padding-top:8px;"><strong>Additional Notes:</strong> <em>${order.customerNote}</em></p>` : ''}
        </div>
        <p style="color: #555; font-size:14px; line-height:1.6;">
          Our master artisans and design team are already reviewing your customization. We will contact you via email or phone shortly to discuss pricing, options, and timeline.
        </p>
      </div>
      <div style="background: #f9f9f9; border-top:1px solid #eee; padding: 20px 30px; text-align: center;">
        <p style="font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 2px; margin: 0;">
          Pairo Concierge • Bespoke Artisanal Tailoring & Heritage
        </p>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"PAIRO Custom Design" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: order.customer?.email,
      subject: `PAIRO Bespoke Design Request Received: #${order.orderNumber}`,
      html,
    });
    console.log(`[Email] ✅ Custom confirmation sent to ${order.customer?.email} | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send custom confirmation email:', err.message);
    throw err;
  }
}

/**
 * Send Admin Notification for Custom Order Design Request
 */
export async function sendAdminCustomOrderNotification(order) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Admin notified of Custom Order ${order.orderNumber}`);
    return;
  }

  let adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    try {
        await dbConnect();
        const superAdminRole = await Role.findOne({ slug: 'super-admin' });
        if (superAdminRole) {
            const superAdmin = await Staff.findOne({ roleId: superAdminRole._id });
            if (superAdmin) adminEmail = superAdmin.email;
        }
    } catch (e) {
        console.error("Failed to fetch super admin for email fallback:", e.message);
    }
  }

  if (!adminEmail) {
    console.warn('[Email] ADMIN_EMAIL and Super Admin not found — skipping admin custom notification.');
    return;
  }

  const item = order.items?.[0] || {};
  const c = item.customization || {};

  let customizationsHtml = '';
  if (c.leatherColor && c.leatherColor !== 'None') {
    customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Leather Color:</strong> ${c.leatherColor} ${c.leatherColorNote ? `(${c.leatherColorNote})` : ''}</p>`;
  }
  if (c.leatherType && c.leatherType !== 'None') {
    customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Leather Type:</strong> ${c.leatherType} ${c.leatherTypeNote ? `(${c.leatherTypeNote})` : ''}</p>`;
  }
  if (c.innerLining && c.innerLining !== 'None') {
    customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Inner Lining:</strong> ${c.innerLining} ${c.innerLiningNote ? `(${c.innerLiningNote})` : ''}</p>`;
  }
  if (c.hardwareColor && c.hardwareColor !== 'None') {
    customizationsHtml += `<p style="margin:4px 0; font-size:13px;"><strong>Hardware Color:</strong> ${c.hardwareColor} ${c.hardwareColorNote ? `(${c.hardwareColorNote})` : ''}</p>`;
  }

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 500px; margin: auto; color: #1a1a1a;">
      <div style="background: #8b5cf6; padding: 20px 30px;">
        <h2 style="color: #fff; margin: 0; font-size: 18px;">✨ New Custom Order Request</h2>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border: 1px solid #eee; border-top: none;">
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #666;">Request Number</td><td style="padding: 6px 0; font-weight: 700;">#${order.orderNumber}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Customer</td><td style="padding: 6px 0;">${order.shippingAddress?.fullName || 'N/A'}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Email</td><td style="padding: 6px 0;">${order.customer?.email || 'N/A'}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Phone</td><td style="padding: 6px 0;">${order.shippingAddress?.phone || 'N/A'}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Product</td><td style="padding: 6px 0; font-weight:700;">${item.name || 'N/A'}</td></tr>
        </table>
        <div style="margin-top: 20px; background: #fff; padding: 15px; border: 1px solid #eee; border-radius:3px;">
          <h4 style="margin:0 0 10px; font-size:11px; text-transform:uppercase; color:#888;">Design Specifications</h4>
          ${customizationsHtml}
        </div>
        <div style="margin-top: 24px;">
          <a href="${process.env.NEXTAUTH_URL}/admin/orders/${order._id}"
             style="display:inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 3px; font-size: 12px; font-weight: 700; text-transform:uppercase; letter-spacing:1px;">
            View Order & Specifications →
          </a>
        </div>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"PAIRO System" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `✨ New Custom Order: #${order.orderNumber} by ${order.shippingAddress?.fullName || 'Guest'}`,
      html,
    });
    console.log(`[Email] ✅ Admin notified of custom order (${adminEmail}) | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send admin custom notification:', err.message);
  }
}

/**
 * Send Question Submission Confirmation Email to Customer
 */
export async function sendQuestionConfirmationEmail({ customerEmail, customerName, productName }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Q&A Confirmation → ${customerEmail}`);
    return;
  }

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: auto; color: #1a1a1a; padding: 20px; border: 1px solid #eaeaea;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eaeaea;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 2px;">PAIRO</h1>
      </div>
      <div style="padding: 30px 10px;">
        <p style="font-size: 15px; line-height: 1.6;">Dear ${customerName || 'Customer'},</p>
        <p style="font-size: 15px; line-height: 1.6;">Thank you for your question.</p>
        <p style="font-size: 15px; line-height: 1.6;">We have received your question regarding <strong>${productName}</strong>.</p>
        <p style="font-size: 15px; line-height: 1.6; color: #666;">Our team will review it and get back to you shortly.</p>
      </div>
      <div style="border-top: 1px solid #eaeaea; padding-top: 20px; text-align: center;">
        <p style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 2px; margin: 0;">
          PAIRO Store • Customer Experience Team
        </p>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"PAIRO Store" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `We have received your question regarding ${productName}`,
      html,
    });
    console.log(`[Email] ✅ Q&A confirmation sent to ${customerEmail} | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send Q&A confirmation:', err.message);
  }
}

/**
 * Send Admin Notification for a New Customer Question
 */
export async function sendAdminQuestionNotification({ customerName, customerEmail, productName, questionText }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Admin notified of new question by ${customerName}`);
    return;
  }

  let adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    try {
      await dbConnect();
      const superAdminRole = await Role.findOne({ slug: 'super-admin' });
      if (superAdminRole) {
        const superAdmin = await Staff.findOne({ roleId: superAdminRole._id });
        if (superAdmin) adminEmail = superAdmin.email;
      }
    } catch (e) {
      console.error("Failed to fetch super admin for email fallback:", e.message);
    }
  }

  if (!adminEmail) {
    console.warn('[Email] ADMIN_EMAIL and Super Admin not found — skipping admin Q&A notification.');
    return;
  }

  const dateStr = new Date().toLocaleString();

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 500px; margin: auto; color: #1a1a1a;">
      <div style="background: #1a1a1a; padding: 20px 30px; text-align: center;">
        <h2 style="color: #fff; margin: 0; font-size: 18px; letter-spacing: 1px;">❓ New Product Question</h2>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border: 1px solid #eee; border-top: none;">
        <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 6px 0; color: #666;">Customer Name</td><td style="padding: 6px 0; font-weight: 700;">${customerName}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Customer Email</td><td style="padding: 6px 0;">${customerEmail}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Product Name</td><td style="padding: 6px 0; font-weight: 700;">${productName}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Submitted Date</td><td style="padding: 6px 0;">${dateStr}</td></tr>
        </table>
        <div style="background: #fff; padding: 15px; border: 1px solid #eee; border-radius:3px;">
          <h4 style="margin:0 0 10px; font-size:11px; text-transform:uppercase; color:#888;">Submitted Question</h4>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1a1a1a; font-style: italic;">"${questionText}"</p>
        </div>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${process.env.NEXTAUTH_URL || 'https://pairolifestyle.com'}/admin/products/questions"
             style="display:inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 3px; font-size: 12px; font-weight: 700; text-transform:uppercase; letter-spacing:1px;">
            Moderate Questions & Answers →
          </a>
        </div>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"PAIRO Store System" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `❓ New Q&A Question on ${productName} by ${customerName}`,
      html,
    });
    console.log(`[Email] ✅ Admin notified of new question | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send admin Q&A notification:', err.message);
  }
}

/**
 * Send Question Reply Email to Customer
 */
export async function sendQuestionReplyEmail({ customerEmail, customerName, originalQuestion, replyText, productName, productSlug }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Reply Email → ${customerEmail}`);
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://pairolifestyle.com';
  const productLink = `${siteUrl}/product/${productSlug}`;

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: auto; color: #1a1a1a; padding: 20px; border: 1px solid #eaeaea;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eaeaea;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 2px;">PAIRO</h1>
      </div>
      <div style="padding: 30px 10px;">
        <p style="font-size: 15px; line-height: 1.6;">Dear ${customerName || 'Customer'},</p>
        <p style="font-size: 15px; line-height: 1.6;">We have answered your question regarding <strong>${productName}</strong>.</p>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 3px solid #ccc; font-style: italic;">
          <p style="margin: 0 0 5px 0; font-size: 12px; color: #888; text-transform: uppercase;">Your Question:</p>
          <p style="margin: 0; font-size: 14px; color: #555;">"${originalQuestion}"</p>
        </div>

        <div style="margin: 20px 0; padding: 15px; background-color: #f0f7ff; border-left: 3px solid #0070f3;">
          <p style="margin: 0 0 5px 0; font-size: 12px; color: #0070f3; text-transform: uppercase; font-weight: bold;">PAIRO Store Reply:</p>
          <p style="margin: 0; font-size: 14px; color: #111; font-weight: 500;">${replyText}</p>
        </div>

        <p style="font-size: 14px; margin-top: 30px;">
          You can view this Q&A directly on the product detail page here: <br/>
          <a href="${productLink}" style="color: #0070f3; text-decoration: underline; font-weight: bold;">${productName} Page</a>
        </p>
      </div>
      <div style="border-top: 1px solid #eaeaea; padding-top: 20px; text-align: center;">
        <p style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 2px; margin: 0;">
          PAIRO Store • Customer Experience Team
        </p>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"PAIRO Support" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `Answered: Your question regarding ${productName}`,
      html,
    });
    console.log(`[Email] ✅ Q&A reply email sent to ${customerEmail} | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send Q&A reply email:', err.message);
  }
}

/**
 * Send Password Reset Email to Customer
 */
export async function sendCustomerPasswordReset(toEmail, name, resetUrl) {
  const firstName = name?.split(' ')[0] || 'there';

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 560px; margin: auto; color: #1a1a1a; background: #fff;">
      <div style="background: #1a1a1a; padding: 28px 32px; text-align: center;">
        <h1 style="color: #fff; margin: 0; letter-spacing: 6px; font-size: 22px; font-weight: 800; text-transform: uppercase;">PAIRO</h1>
        <p style="color: #888; margin: 6px 0 0; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">Lifestyle Collection</p>
      </div>
      <div style="padding: 48px 40px; background: #fff;">
        <h2 style="font-size: 24px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.5px;">Reset Your Password</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.7; margin: 0 0 32px;">
          Hi ${firstName},<br/>
          We received a request to reset the password for your PAIRO account. Click the button below to set a new password.
        </p>
        <div style="text-align: center; margin: 36px 0;">
          <a href="${resetUrl}"
             style="display: inline-block; background: #1a1a1a; color: #fff; padding: 16px 40px; border-radius: 3px; font-size: 12px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; text-decoration: none;">
            Reset Password
          </a>
        </div>
        <p style="color: #999; font-size: 12px; line-height: 1.6; border-top: 1px solid #f0f0f0; padding-top: 24px; margin: 0;">
          This link expires in <strong>1 hour</strong>.<br/>
          If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.
        </p>
        <p style="color: #bbb; font-size: 11px; margin-top: 12px;">
          Or copy this link into your browser:<br/>
          <span style="color: #555; word-break: break-all;">${resetUrl}</span>
        </p>
      </div>
      <div style="border-top: 1px solid #eee; padding: 18px 32px; text-align: center; background: #fafafa;">
        <p style="font-size: 11px; color: #bbb; text-transform: uppercase; letter-spacing: 2px; margin: 0;">
          PAIRO Lifestyle • pairolifestyle.com
        </p>
      </div>
    </div>
  `;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Customer Password Reset → ${toEmail} | URL: ${resetUrl}`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"PAIRO Lifestyle" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Reset your password — PAIRO Lifestyle`,
      html,
    });
    console.log(`[Email] ✅ Customer password reset email sent to ${toEmail} | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send customer password reset email:', err.message);
    throw err;
  }
}

// ─── CUSTOM JACKET INQUIRY EMAILS ─────────────────────────────────────────────

/**
 * Send a confirmation email to the customer who submitted a Custom Jacket inquiry.
 */
export async function sendCustomJacketConfirmation(toEmail, firstName, inquiry) {
  const storeEmail = process.env.STORE_EMAIL || process.env.FROM_EMAIL || 'support@pairolifestyle.com';
  const storeName = process.env.STORE_NAME || 'PAIRO Lifestyle';
  const storeUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pairolifestyle.com';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Custom Jacket Inquiry Received</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td style="background:#1a1a1a;padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">${storeName}</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Bespoke Jacket Service</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px;font-weight:700;">Thank you, ${firstName}!</h2>
    <p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.7;">We've received your custom jacket inquiry and are thrilled to help you create something truly special. Our expert team will review your specifications and contact you within <strong>24 hours</strong>.</p>

    <!-- Summary Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;margin:24px 0;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 12px;color:#1a1a1a;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Your Inquiry Summary</p>
        ${inquiry.jacketType ? `<p style="margin:0 0 6px;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Jacket Type:</strong> ${inquiry.jacketType}</p>` : ''}
        ${inquiry.preferredLeather ? `<p style="margin:0 0 6px;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Leather:</strong> ${inquiry.preferredLeather}</p>` : ''}
        ${inquiry.preferredColor ? `<p style="margin:0 0 6px;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Color:</strong> ${inquiry.preferredColor}</p>` : ''}
        ${inquiry.size ? `<p style="margin:0 0 6px;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Size:</strong> ${inquiry.size}</p>` : ''}
        ${inquiry.budget ? `<p style="margin:0 0 0;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Budget:</strong> ${inquiry.budget}</p>` : ''}
      </td></tr>
    </table>

    <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.7;">While you wait, feel free to explore our existing collection for inspiration.</p>
    <a href="${storeUrl}/shop" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 32px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border-radius:4px;">Explore Collection</a>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9f9f9;border-top:1px solid #e8e8e8;padding:24px 40px;text-align:center;">
    <p style="margin:0;color:#999;font-size:12px;">You received this because you submitted an inquiry at <a href="${storeUrl}" style="color:#1a1a1a;">${storeName}</a>.</p>
    <p style="margin:8px 0 0;color:#999;font-size:11px;">&copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: `"${storeName}" <${storeEmail}>`,
      to: toEmail,
      subject: `Your Custom Jacket Inquiry — We'll Be In Touch!`,
      html
    });
    console.log(`[Email] ✅ Custom jacket confirmation sent to ${toEmail} | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send custom jacket confirmation:', err.message);
    throw err;
  }
}

/**
 * Notify admin of a new Custom Jacket inquiry.
 */
export async function sendCustomJacketAdminNotification(inquiry) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.STORE_EMAIL || 'support@pairolifestyle.com';
  const storeEmail = process.env.STORE_EMAIL || process.env.FROM_EMAIL || 'support@pairolifestyle.com';
  const storeName = process.env.STORE_NAME || 'PAIRO Lifestyle';
  const storeUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pairolifestyle.com';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Custom Jacket Inquiry</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.08);">
  <tr><td style="background:#1a1a1a;padding:28px 40px;">
    <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Admin Notification</p>
    <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;font-weight:700;">New Custom Jacket Inquiry</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;margin:0 0 24px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 12px;color:#1a1a1a;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Customer</p>
        <p style="margin:0 0 4px;font-size:14px;color:#1a1a1a;font-weight:700;">${inquiry.firstName} ${inquiry.lastName}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#555;">${inquiry.email}</p>
        ${inquiry.phone ? `<p style="margin:0;font-size:13px;color:#555;">${inquiry.phone}</p>` : ''}
        ${inquiry.country ? `<p style="margin:4px 0 0;font-size:13px;color:#555;">${inquiry.city ? inquiry.city + ', ' : ''}${inquiry.country}</p>` : ''}
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;margin:0 0 24px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 12px;color:#1a1a1a;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Specifications</p>
        ${inquiry.jacketType ? `<p style="margin:0 0 6px;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Type:</strong> ${inquiry.jacketType}</p>` : ''}
        ${inquiry.gender ? `<p style="margin:0 0 6px;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Gender:</strong> ${inquiry.gender}</p>` : ''}
        ${inquiry.preferredLeather ? `<p style="margin:0 0 6px;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Leather:</strong> ${inquiry.preferredLeather}</p>` : ''}
        ${inquiry.preferredColor ? `<p style="margin:0 0 6px;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Color:</strong> ${inquiry.preferredColor}</p>` : ''}
        ${inquiry.size ? `<p style="margin:0 0 6px;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Size:</strong> ${inquiry.size}</p>` : ''}
        ${inquiry.budget ? `<p style="margin:0 0 6px;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Budget:</strong> ${inquiry.budget}</p>` : ''}
        ${inquiry.deadline ? `<p style="margin:0 0 0;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Deadline:</strong> ${inquiry.deadline}</p>` : ''}
      </td></tr>
    </table>
    ${inquiry.additionalNotes ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;margin:0 0 24px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 8px;color:#1a1a1a;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Additional Notes</p>
        <p style="margin:0;font-size:13px;color:#555;line-height:1.7;">${inquiry.additionalNotes}</p>
      </td></tr>
    </table>` : ''}
    ${inquiry.referenceImages?.length > 0 ? `<p style="margin:0 0 16px;font-size:13px;color:#555;"><strong style="color:#1a1a1a;">Reference Images:</strong> ${inquiry.referenceImages.length} uploaded</p>` : ''}
    <a href="${storeUrl}/admin/custom-jacket-inquiries" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 28px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border-radius:4px;">View in Dashboard</a>
  </td></tr>
  <tr><td style="background:#f9f9f9;border-top:1px solid #e8e8e8;padding:20px 40px;text-align:center;">
    <p style="margin:0;color:#999;font-size:11px;">${storeName} Admin Notification &mdash; ${new Date().toLocaleString()}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: `"${storeName}" <${storeEmail}>`,
      to: adminEmail,
      subject: `🧥 New Custom Jacket Inquiry — ${inquiry.firstName} ${inquiry.lastName}`,
      html
    });
    console.log(`[Email] ✅ Admin custom jacket notification sent | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send custom jacket admin notification:', err.message);
    throw err;
  }
}

// ─── CUSTOM ORDER: PAYMENT LINK & INVOICE EMAILS ──────────────────────────────

/**
 * Email a Stripe Payment Link to the customer for an admin-finalized Custom Order.
 */
export async function sendPaymentLinkEmail(order, paymentLinkUrl) {
  const storeEmail = process.env.STORE_EMAIL || process.env.FROM_EMAIL || 'info@pairolifestyle.com';
  const storeName = process.env.STORE_NAME || 'PAIRO Lifestyle';
  const firstName = escapeHtml((order.shippingAddress?.fullName || '').split(' ')[0] || 'there');
  const item = order.items?.[0] || {};
  const total = order.financials?.total || 0;
  const currency = order.financials?.currency || 'USD';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Complete Your Payment</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.08);">
  <tr><td style="background:#1a1a1a;padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">${storeName}</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Bespoke Jacket Service</p>
  </td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px;font-weight:700;">Hi ${firstName}, your jacket is ready to order!</h2>
    <p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.7;">Your bespoke <strong>${escapeHtml(item.name || 'Custom Jacket')}</strong> has been finalized. Please complete your payment below to confirm and begin production of Order <strong>#${order.orderNumber}</strong>.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;margin:24px 0;">
      <tr><td style="padding:20px;text-align:center;">
        <p style="margin:0 0 6px;color:#999;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Amount Due</p>
        <p style="margin:0;color:#1a1a1a;font-size:32px;font-weight:800;">${currency} ${total.toLocaleString()}</p>
      </td></tr>
    </table>

    <div style="text-align:center;margin:32px 0;">
      <a href="${paymentLinkUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:16px 40px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border-radius:4px;">Pay Now</a>
    </div>

    <p style="margin:0;color:#999;font-size:12px;line-height:1.6;">If the button above doesn't work, copy and paste this link into your browser:<br/><a href="${paymentLinkUrl}" style="color:#1a1a1a;word-break:break-all;">${paymentLinkUrl}</a></p>
  </td></tr>
  <tr><td style="background:#f9f9f9;border-top:1px solid #e8e8e8;padding:24px 40px;text-align:center;">
    <p style="margin:0;color:#999;font-size:12px;">Questions about your order? Reply to this email and our team will assist you.</p>
    <p style="margin:8px 0 0;color:#999;font-size:11px;">&copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: `"${storeName}" <${storeEmail}>`,
      to: order.customer?.email,
      subject: `Complete Your Payment — Order #${order.orderNumber}`,
      html
    });
    console.log(`[Email] ✅ Payment link sent to ${order.customer?.email} | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send payment link email:', err.message);
    throw err;
  }
}

/**
 * Email an HTML invoice to the customer for an order (used for admin-triggered "Send Invoice").
 */
export async function sendOrderInvoiceEmail(order) {
  const storeEmail = process.env.STORE_EMAIL || process.env.FROM_EMAIL || 'info@pairolifestyle.com';
  const storeName = process.env.STORE_NAME || 'PAIRO Lifestyle';
  const currency = order.financials?.currency || 'USD';
  const fullName = escapeHtml(order.shippingAddress?.fullName || 'Customer');

  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eee;font-size:13px;color:#1a1a1a;">${escapeHtml(item.name || '')}</td>
      <td style="padding:12px 0;border-bottom:1px solid #eee;font-size:13px;color:#555;text-align:center;">${item.quantity || 1}</td>
      <td style="padding:12px 0;border-bottom:1px solid #eee;font-size:13px;color:#1a1a1a;text-align:right;font-weight:700;">${currency} ${((item.priceAtPurchase || 0) * (item.quantity || 1)).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice #${order.orderNumber}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.08);">
  <tr><td style="background:#1a1a1a;padding:32px 40px;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">${storeName}</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.5);font-size:12px;">Invoice for Order #${order.orderNumber}</p>
  </td></tr>
  <tr><td style="padding:40px;">
    <div style="margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#999;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Billed To</p>
      <p style="margin:0;color:#1a1a1a;font-size:14px;font-weight:700;">${fullName}</p>
      <p style="margin:2px 0 0;color:#555;font-size:13px;">${order.customer?.email || ''}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <thead>
        <tr>
          <th style="text-align:left;padding-bottom:8px;border-bottom:2px solid #1a1a1a;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Item</th>
          <th style="text-align:center;padding-bottom:8px;border-bottom:2px solid #1a1a1a;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Qty</th>
          <th style="text-align:right;padding-bottom:8px;border-bottom:2px solid #1a1a1a;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:4px 0;font-size:13px;color:#555;">Subtotal</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;text-align:right;">${currency} ${(order.financials?.subtotal || 0).toLocaleString()}</td></tr>
      ${order.financials?.shippingCost ? `<tr><td style="padding:4px 0;font-size:13px;color:#555;">Shipping</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;text-align:right;">${currency} ${order.financials.shippingCost.toLocaleString()}</td></tr>` : ''}
      ${order.financials?.tax ? `<tr><td style="padding:4px 0;font-size:13px;color:#555;">Tax</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;text-align:right;">${currency} ${order.financials.tax.toLocaleString()}</td></tr>` : ''}
      <tr><td style="padding:12px 0 0;font-size:15px;font-weight:800;color:#1a1a1a;border-top:2px solid #1a1a1a;">Total</td><td style="padding:12px 0 0;font-size:15px;font-weight:800;color:#1a1a1a;text-align:right;border-top:2px solid #1a1a1a;">${currency} ${(order.financials?.total || 0).toLocaleString()}</td></tr>
    </table>

    <p style="margin:24px 0 0;color:#999;font-size:12px;">Payment status: <strong style="color:#1a1a1a;">${order.payment?.status || 'Pending'}</strong></p>

    ${order.payment?.status !== 'Paid' && order.paymentLink?.url ? `
    <div style="text-align:center;margin:28px 0 4px;padding-top:24px;border-top:1px solid #eee;">
      <a href="${order.paymentLink.url}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 36px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border-radius:4px;">Pay Now</a>
      <p style="margin:12px 0 0;color:#999;font-size:11px;line-height:1.6;">Or copy this link into your browser:<br/><a href="${order.paymentLink.url}" style="color:#1a1a1a;word-break:break-all;">${order.paymentLink.url}</a></p>
    </div>` : ''}
  </td></tr>
  <tr><td style="background:#f9f9f9;border-top:1px solid #e8e8e8;padding:20px 40px;text-align:center;">
    <p style="margin:0;color:#999;font-size:11px;">&copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: `"${storeName}" <${storeEmail}>`,
      to: order.customer?.email,
      subject: `Invoice — Order #${order.orderNumber}`,
      html
    });
    console.log(`[Email] ✅ Invoice sent to ${order.customer?.email} | MsgID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] ❌ Failed to send invoice email:', err.message);
    throw err;
  }
}
