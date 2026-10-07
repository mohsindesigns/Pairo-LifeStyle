import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dbConnect from './db';
import Staff from '@/models/Staff';
import Role from '@/models/Role';
import { escapeHtml } from './sanitize';

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

function resolveSmtpConfig() {
  const emailUser = process.env.EMAIL_USER || '';
  const emailPass = process.env.EMAIL_PASS || '';
  const emailServer = process.env.EMAIL_SERVER || '';
  const emailPort = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : undefined;

  // 1. If Brevo credentials are provided
  if (emailServer.includes('brevo') || emailUser.includes('brevo')) {
    return {
      host: emailServer || 'smtp-relay.brevo.com',
      port: emailPort || 587,
      secure: false,
      auth: { user: emailUser, pass: emailPass },
    };
  }

  // 2. If standard generic SMTP server is explicitly configured
  if (emailServer && emailUser && emailPass) {
    const port = emailPort || 587;
    return {
      host: emailServer,
      port,
      secure: port === 465,
      auth: { user: emailUser, pass: emailPass },
    };
  }

  // 3. If AWS SES is configured and user is an AWS key
  const awsKeyId = process.env.AWS_ACCESS_KEY_ID || (emailUser.startsWith('AKIA') ? emailUser : '');
  const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
  if (awsKeyId && awsSecret) {
    const host = process.env.AWS_SMTP_HOST || 'email-smtp.eu-north-1.amazonaws.com';
    const regionMatch = host.match(/email-smtp\.(.*?)\.amazonaws\.com/);
    const sesRegion = regionMatch ? regionMatch[1] : 'eu-north-1';
    const pass = getSmtpPassword(awsSecret, sesRegion);
    return {
      host,
      port: 465,
      secure: true,
      auth: { user: awsKeyId, pass },
    };
  }

  // 4. Fallback: Gmail or generic user & pass
  if (emailUser && emailPass) {
    const host = emailServer || (emailUser.includes('@gmail.com') ? 'smtp.gmail.com' : 'smtp-relay.brevo.com');
    const port = emailPort || (host === 'smtp.gmail.com' ? 465 : 587);
    return {
      host,
      port,
      secure: port === 465,
      auth: { user: emailUser, pass: emailPass },
    };
  }

  return null;
}

const smtpConfig = resolveSmtpConfig();

const transporter = nodemailer.createTransport({
  ...(smtpConfig || {
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
  }),
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

/**
 * Robust RFC-compliant From address formatter
 */
export function getFromAddress(displayName = 'PAIRO Lifestyle') {
  const storeName = process.env.STORE_NAME || displayName;
  const rawFrom = (
    process.env.STORE_EMAIL ||
    process.env.FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    (process.env.EMAIL_USER && process.env.EMAIL_USER.includes('@') ? process.env.EMAIL_USER : null) ||
    'support@pairolifestyle.com'
  ).trim();

  if (rawFrom.includes('<') && rawFrom.includes('>')) {
    return rawFrom;
  }

  const cleanEmail = rawFrom.replace(/[<>"']/g, '').trim();
  return `"${storeName}" <${cleanEmail}>`;
}

// ─── SHARED BRAND EMAIL DESIGN SYSTEM ─────────────────────────────────────────
// Every email the store sends (customer or admin facing) is built from these
// same pieces, so the look stays identical everywhere instead of each message
// having its own hand-built header/footer. Colors match the storefront's warm
// ink/cream palette rather than generic black-and-grey.

const BRAND = {
  ink: '#4A2E1D',
  paper: '#FFFFFF',
  pageBg: '#F3EFE7',
  surface: '#F6F2EA',
  border: '#E3DACB',
  muted: '#6F655B',
  faint: '#9C9388',
  danger: '#9A3B3B',
};

function isSmtpConfigured() {
  return Boolean(smtpConfig?.auth?.user && smtpConfig?.auth?.pass);
}

/**
 * Wraps a block of content in the standard branded email shell: dark header
 * with the store name, white content card, and a consistent footer. Every
 * send* function below builds its own `bodyHtml` and passes it in here.
 */
function emailShell({ eyebrow, heading, subheading, bodyHtml, preheader = '' }) {
  const storeName = process.env.STORE_NAME || 'PAIRO Lifestyle';
  const storeUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'https://pairolifestyle.com').replace(/\/$/, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(heading || storeName)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BRAND.paper};border-radius:16px;overflow:hidden;border:1px solid ${BRAND.border};">
  <tr><td style="background:${BRAND.ink};padding:36px 40px;text-align:center;">
    <p style="margin:0 0 8px;color:rgba(255,255,255,0.55);font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">${escapeHtml(eyebrow || storeName)}</p>
    <h1 style="margin:0;color:#ffffff;font-size:21px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">${escapeHtml(storeName)}</h1>
  </td></tr>
  <tr><td style="padding:44px 40px 36px;">
    ${heading ? `<h2 style="margin:0 0 14px;color:${BRAND.ink};font-size:21px;font-weight:700;letter-spacing:-0.3px;">${heading}</h2>` : ''}
    ${subheading ? `<p style="margin:0 0 28px;color:${BRAND.muted};font-size:14px;line-height:1.7;">${subheading}</p>` : ''}
    ${bodyHtml || ''}
  </td></tr>
  <tr><td style="background:${BRAND.surface};border-top:1px solid ${BRAND.border};padding:26px 40px;text-align:center;">
    <p style="margin:0;color:${BRAND.ink};font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">${escapeHtml(storeName)}</p>
    <p style="margin:8px 0 0;color:${BRAND.faint};font-size:11px;">&copy; ${new Date().getFullYear()} ${escapeHtml(storeName)} &middot; <a href="${storeUrl}" style="color:${BRAND.faint};text-decoration:underline;">${storeUrl.replace(/^https?:\/\//, '')}</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** A single brand-colored pill button, centered by default. */
function emailButton(url, label, { align = 'center', secondary = false } = {}) {
  const bg = secondary ? BRAND.paper : BRAND.ink;
  const color = secondary ? BRAND.ink : '#ffffff';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:${align === 'center' ? '0 auto' : '0'};"><tr><td style="border-radius:999px;background:${bg};border:1px solid ${BRAND.ink};">
<a href="${url}" style="display:inline-block;padding:15px 38px;font-size:12px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${color};text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function buttonBlock(url, label, opts) {
  return `<div style="text-align:center;margin:30px 0;">${emailButton(url, label, opts)}</div>`;
}

/** A soft bordered card used for order details, specs, notes, credentials, etc. */
function emailPanel(innerHtml, { title, accentColor } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:10px;margin:0 0 24px;${accentColor ? `border-left:4px solid ${accentColor};` : ''}">
<tr><td style="padding:20px 22px;">
${title ? `<p style="margin:0 0 12px;color:${BRAND.ink};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(title)}</p>` : ''}
${innerHtml}
</td></tr></table>`;
}

/** One label/value row for the field tables used inside panels. `value` may contain trusted HTML. */
function fieldRow(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `<tr><td style="padding:6px 0;color:${BRAND.muted};font-size:13px;width:38%;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;color:${BRAND.ink};font-size:13px;font-weight:600;">${value}</td></tr>`;
}

function fieldTable(rowsHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rowsHtml}</table>`;
}

/**
 * Looks up the admin notification address: ADMIN_EMAIL env var, falling back
 * to whichever staff account holds the super-admin role.
 */
async function resolveAdminEmail(label) {
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
      console.error('Failed to fetch super admin for email fallback:', e.message);
    }
  }
  if (!adminEmail) {
    console.warn(`[Email] ADMIN_EMAIL and Super Admin not found — skipping ${label}.`);
  }
  return adminEmail;
}

/**
 * Single send path for every email in this file: simulates (logs only) when
 * no SMTP provider is configured, otherwise sends and logs the result the
 * same way everywhere. `critical: true` rethrows on failure, matching the
 * functions that previously threw so callers can react to a hard failure.
 */
async function dispatchEmail({ to, subject, html, from, label, critical = false }) {
  if (!to) {
    console.warn(`[Email] ${label}: no recipient address — skipped.`);
    return null;
  }
  if (!isSmtpConfigured()) {
    console.log(`[Email Simulation] ${label} → ${to}`);
    return null;
  }
  try {
    const info = await transporter.sendMail({ from: from || getFromAddress(), to, subject, html });
    console.log(`[Email] ✅ ${label} sent to ${to} | MsgID: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[Email] ❌ Failed to send ${label}:`, err.message);
    if (critical) throw err;
    return null;
  }
}

// ─── ACCOUNT EMAILS ────────────────────────────────────────────────────────────

/**
 * Send Email Verification to New Customer
 */
export async function sendEmailVerification(toEmail, name, verificationUrl) {
  const firstName = name?.split(' ')[0] || 'there';
  const storeName = process.env.STORE_NAME || 'PAIRO Lifestyle';

  const html = emailShell({
    eyebrow: 'Lifestyle Collection',
    heading: 'Verify Your Email',
    subheading: `Hi ${escapeHtml(firstName)}, welcome to ${escapeHtml(storeName)}. Please verify your email address to activate your account and start shopping.`,
    bodyHtml: `
      ${buttonBlock(verificationUrl, 'Verify Email Address')}
      <p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;border-top:1px solid ${BRAND.border};padding-top:24px;">
        This link expires in <strong>24 hours</strong>. If you did not create an account at ${escapeHtml(storeName)}, you can safely ignore this email.
      </p>
      <p style="margin:12px 0 0;color:${BRAND.faint};font-size:11px;word-break:break-all;">${verificationUrl}</p>
    `,
    preheader: 'Verify your email to activate your account.',
  });

  await dispatchEmail({
    to: toEmail,
    subject: `Verify your email — ${storeName}`,
    html,
    from: getFromAddress(storeName),
    label: 'Verification email',
    critical: true,
  });
}

/**
 * Send Email Verification to New Affiliate Applicant
 */
export async function sendAffiliateEmailVerification(toEmail, name, verificationUrl) {
  const firstName = name?.split(' ')[0] || 'there';

  const html = emailShell({
    eyebrow: 'Affiliate Partners',
    heading: 'Verify Your Email',
    subheading: `Hi ${escapeHtml(firstName)}, thank you for applying to the PAIRO Affiliate Program. Please verify your email address to submit your application for review.`,
    bodyHtml: `
      ${buttonBlock(verificationUrl, 'Verify Email Address')}
      <p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;border-top:1px solid ${BRAND.border};padding-top:24px;">
        This link expires in <strong>24 hours</strong>. If you did not apply for the Pairo Affiliate Program, you can safely ignore this email.
      </p>
      <p style="margin:12px 0 0;color:${BRAND.faint};font-size:11px;word-break:break-all;">${verificationUrl}</p>
    `,
    preheader: 'Verify your email to submit your affiliate application.',
  });

  await dispatchEmail({
    to: toEmail,
    subject: 'Verify your email — PAIRO Affiliates',
    html,
    from: getFromAddress('PAIRO Affiliates'),
    label: 'Affiliate verification email',
    critical: true,
  });
}

/**
 * Send Password Reset Email to Customer
 */
export async function sendCustomerPasswordReset(toEmail, name, resetUrl) {
  const firstName = name?.split(' ')[0] || 'there';

  const html = emailShell({
    eyebrow: 'Lifestyle Collection',
    heading: 'Reset Your Password',
    subheading: `Hi ${escapeHtml(firstName)}, we received a request to reset the password for your PAIRO account. This link expires in <strong>1 hour</strong>.`,
    bodyHtml: `
      ${buttonBlock(resetUrl, 'Reset Password')}
      <p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;border-top:1px solid ${BRAND.border};padding-top:24px;">
        If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.
      </p>
      <p style="margin:12px 0 0;color:${BRAND.faint};font-size:11px;word-break:break-all;">${resetUrl}</p>
    `,
    preheader: 'Reset your PAIRO account password.',
  });

  await dispatchEmail({
    to: toEmail,
    subject: 'Reset your password — PAIRO Lifestyle',
    html,
    from: getFromAddress('PAIRO Lifestyle'),
    label: 'Customer password reset',
    critical: true,
  });
}

/**
 * Send Affiliate Password Reset Email
 */
export async function sendAffiliatePasswordReset(toEmail, name, resetUrl) {
  const firstName = name?.split(' ')[0] || 'Partner';

  const html = emailShell({
    eyebrow: 'Partner Portal',
    heading: 'Reset Your Password',
    subheading: `Hi ${escapeHtml(firstName)}, we received a request to reset the password for your PAIRO Partner account. This link expires in <strong>1 hour</strong>.`,
    bodyHtml: `
      ${buttonBlock(resetUrl, 'Reset Password')}
      <p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;border-top:1px solid ${BRAND.border};padding-top:24px;">
        If you did not request a password reset, please ignore this email — your account is safe. For security, do not share this link with anyone.
      </p>
    `,
    preheader: 'Reset your PAIRO Partner account password.',
  });

  await dispatchEmail({
    to: toEmail,
    subject: 'Reset Your PAIRO Partner Password',
    html,
    from: getFromAddress('PAIRO Partners'),
    label: 'Affiliate password reset',
    critical: true,
  });
}

// ─── ORDER EMAILS ──────────────────────────────────────────────────────────────

/**
 * Send Order Confirmation Email to Customer
 */
export async function sendOrderConfirmation(order) {
  const itemsRows = (order.items || []).map((item) => `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};">
        <strong style="color:${BRAND.ink};">${escapeHtml(item.name || '')}</strong><br/>
        <span style="color:${BRAND.muted};font-size:12px;">${escapeHtml(item.selectedVariant?.title || '')}</span>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};text-align:center;color:${BRAND.ink};">${item.quantity}</td>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};text-align:right;color:${BRAND.ink};font-weight:700;">$${((item.priceAtPurchase || 0) * (item.quantity || 1)).toLocaleString()}</td>
    </tr>`).join('');

  const itemsTable = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:8px;">
      <thead><tr style="background:${BRAND.surface};">
        <th style="text-align:left;padding:10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};">Product</th>
        <th style="padding:10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};">Qty</th>
        <th style="text-align:right;padding:10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};">Total</th>
      </tr></thead>
      <tbody>${itemsRows}</tbody>
      <tfoot><tr>
        <td colspan="2" style="padding:16px 10px;text-align:right;font-weight:700;color:${BRAND.ink};border-top:2px solid ${BRAND.ink};">Total Paid</td>
        <td style="padding:16px 10px;text-align:right;font-weight:800;color:${BRAND.ink};border-top:2px solid ${BRAND.ink};">$${(order.financials?.total || 0).toLocaleString()}</td>
      </tr></tfoot>
    </table>`;

  const accountSectionHtml = order.guestAccount?.created && order.guestAccount?.temporaryPassword
    ? emailPanel(`
        <p style="margin:0 0 14px;color:${BRAND.muted};font-size:13px;line-height:1.6;">Thank you for your order! We created your customer account so you can track orders, view your order history, save addresses, and checkout faster next time.</p>
        ${fieldTable(
          fieldRow('Login Email', escapeHtml(order.guestAccount.loginEmail || order.customer?.email || '')) +
          fieldRow('Temporary Password', `<span style="font-family:monospace;background:${BRAND.paper};border:1px solid ${BRAND.border};padding:3px 8px;border-radius:4px;">${escapeHtml(order.guestAccount.temporaryPassword)}</span>`)
        )}
        <div style="margin-top:14px;">${emailButton(order.guestAccount.loginUrl || 'https://pairolifestyle.com/login', 'Log In To Your Account', { align: 'left' })}</div>
      `, { title: 'Your Customer Account Has Been Created' })
    : '';

  const shippingHtml = emailPanel(`
    <p style="margin:0;font-size:14px;line-height:1.8;color:${BRAND.ink};">
      ${escapeHtml(order.shippingAddress?.fullName || '')}<br/>
      ${escapeHtml(order.shippingAddress?.street || '')}<br/>
      ${escapeHtml(order.shippingAddress?.city || '')}${order.shippingAddress?.zip ? `, ${escapeHtml(order.shippingAddress.zip)}` : ''}<br/>
      ${escapeHtml(order.shippingAddress?.country || '')}
    </p>
  `, { title: 'Shipping To', accentColor: BRAND.ink });

  const html = emailShell({
    eyebrow: 'Order Confirmed',
    heading: 'Thank You For Your Order',
    subheading: `Hi ${escapeHtml(order.shippingAddress?.fullName?.split(' ')[0] || 'there')}, your order <strong>#${escapeHtml(order.orderNumber)}</strong> has been confirmed and is being prepared for dispatch.`,
    bodyHtml: `${itemsTable}<div style="margin-top:28px;">${accountSectionHtml}${shippingHtml}</div>`,
    preheader: `Your order #${order.orderNumber} has been confirmed.`,
  });

  await dispatchEmail({
    to: order.customer?.email,
    subject: `Order Confirmed: #${order.orderNumber}`,
    html,
    from: getFromAddress('PAIRO Store'),
    label: `Order confirmation (#${order.orderNumber})`,
    critical: true,
  });
}

/**
 * Send Admin Notification for New Order
 */
export async function sendAdminOrderNotification(order) {
  if (!isSmtpConfigured()) {
    console.log(`[Email Simulation] Admin notified of Order ${order.orderNumber}`);
    return;
  }

  const adminEmail = await resolveAdminEmail(`order notification #${order.orderNumber}`);
  if (!adminEmail) return;

  const dashboardUrl = `${process.env.NEXTAUTH_URL || 'https://pairolifestyle.com'}/admin/orders/${order._id}`;
  const html = emailShell({
    eyebrow: 'Admin Notification',
    heading: 'New Order Received',
    subheading: `Order <strong>#${escapeHtml(order.orderNumber)}</strong> has just been placed.`,
    bodyHtml: `
      ${emailPanel(fieldTable(
        fieldRow('Order Number', `#${escapeHtml(order.orderNumber)}`) +
        fieldRow('Customer', escapeHtml(order.shippingAddress?.fullName || 'N/A')) +
        fieldRow('Email', escapeHtml(order.customer?.email || 'N/A')) +
        fieldRow('Items', String((order.items || []).length)) +
        fieldRow('Total', `<span style="font-size:16px;font-weight:800;">$${(order.financials?.total || 0).toLocaleString()}</span>`)
      ))}
      ${buttonBlock(dashboardUrl, 'View Order In Dashboard')}
    `,
  });

  await dispatchEmail({
    to: adminEmail,
    subject: `New Order: #${order.orderNumber} — $${(order.financials?.total || 0).toLocaleString()}`,
    html,
    from: getFromAddress('PAIRO System'),
    label: `Admin order notification (#${order.orderNumber})`,
  });
}

/**
 * Send a reply to a customer submission (CRM / contact form thread)
 */
export async function sendSubmissionReply(toEmail, subject, message, customerName) {
  const storeName = process.env.STORE_NAME || 'PAIRO Lifestyle';
  const html = emailShell({
    eyebrow: 'Concierge',
    heading: 'A Message From Our Team',
    bodyHtml: `
      <p style="margin:0 0 20px;color:${BRAND.muted};font-size:14px;">Dear ${escapeHtml(customerName || 'Customer')},</p>
      <div style="font-size:15px;color:${BRAND.ink};line-height:1.8;white-space:pre-wrap;">${escapeHtml(message)}</div>
      <div style="margin-top:36px;padding-top:20px;border-top:1px solid ${BRAND.border};">
        <p style="margin:0;color:${BRAND.muted};font-size:13px;">Kind regards,</p>
        <p style="margin:4px 0 0;color:${BRAND.ink};font-size:14px;font-weight:700;">The ${escapeHtml(storeName)} Team</p>
      </div>
    `,
    preheader: (message || '').slice(0, 120),
  });

  await dispatchEmail({ to: toEmail, subject, html, from: getFromAddress('PAIRO Support'), label: 'CRM reply' });
}

// ─── AFFILIATE EMAILS ──────────────────────────────────────────────────────────

/**
 * Send Affiliate Application Received email
 */
export async function sendAffiliateApplicationReceived(toEmail, affiliateName) {
  const html = emailShell({
    eyebrow: 'Affiliate Partners',
    heading: 'Application Received',
    bodyHtml: `
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:14px;">Hi ${escapeHtml(affiliateName)},</p>
      <p style="margin:0 0 14px;color:${BRAND.ink};font-size:15px;line-height:1.7;">Thank you for applying to the Pairo Affiliate Program. We have received your application and identity documents.</p>
      <p style="margin:0;color:${BRAND.ink};font-size:15px;line-height:1.7;">Our review team is auditing your details. You will receive an email update with your login credentials as soon as your account is approved.</p>
      <div style="margin-top:36px;padding-top:20px;border-top:1px solid ${BRAND.border};">
        <p style="margin:0;color:${BRAND.muted};font-size:13px;">Kind regards,</p>
        <p style="margin:4px 0 0;color:${BRAND.ink};font-size:14px;font-weight:700;">The Pairo Team</p>
      </div>
    `,
  });

  await dispatchEmail({ to: toEmail, subject: 'Affiliate Application Received — Pairo Lifestyle', html, from: getFromAddress('PAIRO Affiliates'), label: 'Affiliate application received' });
}

/**
 * Send Affiliate Application Approved email
 */
export async function sendAffiliateApplicationApproved(toEmail, affiliateName, referralCode, tempPassword, commissionType = 'Percentage', commissionRate = 5) {
  const loginUrl = `${process.env.NEXTAUTH_URL || 'https://pairolifestyle.com'}/affiliate-login`;

  const html = emailShell({
    eyebrow: 'Affiliate Partners',
    heading: 'Your Application Has Been Approved',
    bodyHtml: `
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:14px;">Dear ${escapeHtml(affiliateName)},</p>
      <p style="margin:0 0 20px;color:${BRAND.ink};font-size:15px;line-height:1.7;">Congratulations! You can now log in to your dedicated Affiliate Portal to start generating links, tracking conversions, and viewing commissions.</p>
      ${emailPanel(fieldTable(
        fieldRow('Portal Login URL', `<a href="${loginUrl}" style="color:${BRAND.ink};">${loginUrl}</a>`) +
        fieldRow('Login Email', escapeHtml(toEmail)) +
        fieldRow('Temporary Password', `<span style="font-family:monospace;background:${BRAND.paper};border:1px solid ${BRAND.border};padding:3px 8px;border-radius:4px;">${escapeHtml(tempPassword)}</span>`) +
        fieldRow('Referral Code', escapeHtml(referralCode)) +
        fieldRow('Commission Rate', commissionType === 'Fixed' ? `$${commissionRate} fixed per product sold` : `${commissionRate}% on all delivered orders`)
      ), { title: 'Your Account Details' })}
      <div style="padding-top:20px;border-top:1px solid ${BRAND.border};">
        <p style="margin:0;color:${BRAND.muted};font-size:13px;">Kind regards,</p>
        <p style="margin:4px 0 0;color:${BRAND.ink};font-size:14px;font-weight:700;">The Pairo Team</p>
      </div>
    `,
  });

  await dispatchEmail({ to: toEmail, subject: 'Affiliate Account Approved! — Pairo Lifestyle', html, from: getFromAddress('PAIRO Affiliates'), label: 'Affiliate application approved' });
}

/**
 * Send Affiliate Application Rejected email
 */
export async function sendAffiliateApplicationRejected(toEmail, affiliateName, reason) {
  const html = emailShell({
    eyebrow: 'Affiliate Partners',
    heading: 'Application Update',
    bodyHtml: `
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:14px;">Dear ${escapeHtml(affiliateName)},</p>
      <p style="margin:0 0 14px;color:${BRAND.ink};font-size:15px;line-height:1.7;">Thank you for your interest in the Pairo Affiliate Program.</p>
      <p style="margin:0 0 ${reason ? '20px' : '0'};color:${BRAND.ink};font-size:15px;line-height:1.7;">After reviewing your application details and marketing channels, we regret to inform you that we are unable to accept your application at this time.</p>
      ${reason ? emailPanel(`<p style="margin:0;color:${BRAND.danger};font-size:14px;line-height:1.6;"><strong>Review notes:</strong> ${escapeHtml(reason)}</p>`, { accentColor: BRAND.danger }) : ''}
      <div style="padding-top:20px;border-top:1px solid ${BRAND.border};">
        <p style="margin:0;color:${BRAND.muted};font-size:13px;">Kind regards,</p>
        <p style="margin:4px 0 0;color:${BRAND.ink};font-size:14px;font-weight:700;">The Pairo Team</p>
      </div>
    `,
  });

  await dispatchEmail({ to: toEmail, subject: 'Affiliate Application Update — Pairo Lifestyle', html, from: getFromAddress('PAIRO Affiliates'), label: 'Affiliate application rejected' });
}

/**
 * Send Affiliate Payout Update email
 */
export async function sendAffiliatePayoutUpdate(toEmail, affiliateName, amount, status, notes) {
  const html = emailShell({
    eyebrow: 'Affiliate Partners',
    heading: 'Payout Update',
    bodyHtml: `
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:14px;">Dear ${escapeHtml(affiliateName)},</p>
      <p style="margin:0 0 8px;color:${BRAND.ink};font-size:15px;line-height:1.7;">This is an update regarding your affiliate payout request of <strong>$${Number(amount).toLocaleString()}</strong>.</p>
      <p style="margin:0 0 ${notes ? '20px' : '0'};color:${BRAND.ink};font-size:15px;">Status: <strong style="text-transform:uppercase;">${escapeHtml(status)}</strong></p>
      ${notes ? emailPanel(`<p style="margin:0;color:${BRAND.ink};font-size:14px;line-height:1.6;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>`) : ''}
      <div style="padding-top:20px;border-top:1px solid ${BRAND.border};">
        <p style="margin:0;color:${BRAND.muted};font-size:13px;">Kind regards,</p>
        <p style="margin:4px 0 0;color:${BRAND.ink};font-size:14px;font-weight:700;">The Pairo Team</p>
      </div>
    `,
  });

  await dispatchEmail({ to: toEmail, subject: `Affiliate Payout Update: $${amount} — Pairo Lifestyle`, html, from: getFromAddress('PAIRO Affiliates'), label: 'Affiliate payout update' });
}

// ─── CUSTOM ORDER EMAILS ───────────────────────────────────────────────────────

/**
 * Send Custom Order / Bespoke Design Request Confirmation Email to Customer
 */
export async function sendCustomOrderConfirmation(order) {
  const item = order.items?.[0] || {};
  const c = item.customization || {};

  const rows = [];
  if (c.leatherColor && c.leatherColor !== 'None') rows.push(fieldRow('Leather Color', escapeHtml(c.leatherColor) + (c.leatherColorNote ? ` (${escapeHtml(c.leatherColorNote)})` : '')));
  if (c.leatherType && c.leatherType !== 'None') rows.push(fieldRow('Leather Type', escapeHtml(c.leatherType) + (c.leatherTypeNote ? ` (${escapeHtml(c.leatherTypeNote)})` : '')));
  if (c.innerLining && c.innerLining !== 'None') rows.push(fieldRow('Inner Lining', escapeHtml(c.innerLining) + (c.innerLiningNote ? ` (${escapeHtml(c.innerLiningNote)})` : '')));
  if (c.hardwareColor && c.hardwareColor !== 'None') rows.push(fieldRow('Hardware Color', escapeHtml(c.hardwareColor) + (c.hardwareColorNote ? ` (${escapeHtml(c.hardwareColorNote)})` : '')));
  if (c.fur?.type && c.fur.type !== 'None') {
    rows.push(fieldRow('Fur Type', escapeHtml(c.fur.type) + (c.fur.typeNote ? ` (${escapeHtml(c.fur.typeNote)})` : '')));
    if (c.fur.color) rows.push(fieldRow('Fur Color', escapeHtml(c.fur.color)));
    if (c.fur.placement?.length) rows.push(fieldRow('Fur Placement', escapeHtml(c.fur.placement.join(', '))));
    if (c.fur.density) rows.push(fieldRow('Fur Density', escapeHtml(c.fur.density)));
    if (c.fur.removable !== null && c.fur.removable !== undefined) rows.push(fieldRow('Removable Fur', c.fur.removable ? 'Yes' : 'No'));
  }

  let artworkHtml = '';
  if (c.artwork && Object.values(c.artwork).some(Boolean)) {
    const links = Object.entries(c.artwork)
      .filter(([, art]) => art?.url)
      .map(([key, art]) => `<p style="margin:4px 0;font-size:13px;color:${BRAND.ink};"><strong>${escapeHtml(key.replace(/([A-Z])/g, ' $1'))}:</strong> <a href="${art.url}" style="color:${BRAND.ink};text-decoration:underline;">${escapeHtml(art.name || 'View File')}</a></p>`)
      .join('');
    artworkHtml = `<div style="margin-top:12px;padding-top:12px;border-top:1px dashed ${BRAND.border};"><p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};">Uploaded Artwork</p>${links}</div>`;
  }

  const notesHtml = order.customerNote
    ? `<p style="margin:12px 0 0;padding-top:12px;border-top:1px dashed ${BRAND.border};font-size:13px;color:${BRAND.ink};"><strong>Additional Notes:</strong> <em>${escapeHtml(order.customerNote)}</em></p>`
    : '';

  const html = emailShell({
    eyebrow: 'Bespoke Design Service',
    heading: `Thank You, ${escapeHtml(order.shippingAddress?.fullName?.split(' ')[0] || 'there')}!`,
    subheading: `We've received your custom design request for <strong>${escapeHtml(item.name || '')}</strong>. Your request ID is <strong>#${escapeHtml(order.orderNumber)}</strong>, submitted on ${new Date(order.createdAt).toLocaleDateString()}.`,
    bodyHtml: `
      ${emailPanel(fieldTable(rows.join('')) + artworkHtml + notesHtml, { title: 'Your Custom Selections' })}
      <p style="margin:0;color:${BRAND.muted};font-size:14px;line-height:1.7;">Our master artisans and design team are already reviewing your customization. We will contact you via email or phone shortly to discuss pricing, options, and timeline.</p>
    `,
    preheader: `Request #${order.orderNumber} received.`,
  });

  await dispatchEmail({
    to: order.customer?.email,
    subject: `PAIRO Bespoke Design Request Received: #${order.orderNumber}`,
    html,
    from: getFromAddress('PAIRO Custom Design'),
    label: `Custom order confirmation (#${order.orderNumber})`,
    critical: true,
  });
}

/**
 * Send Admin Notification for Custom Order Design Request
 */
export async function sendAdminCustomOrderNotification(order) {
  if (!isSmtpConfigured()) {
    console.log(`[Email Simulation] Admin notified of Custom Order ${order.orderNumber}`);
    return;
  }

  const adminEmail = await resolveAdminEmail(`custom order notification #${order.orderNumber}`);
  if (!adminEmail) return;

  const item = order.items?.[0] || {};
  const c = item.customization || {};
  const rows = [
    c.leatherColor && c.leatherColor !== 'None' && fieldRow('Leather Color', escapeHtml(c.leatherColor) + (c.leatherColorNote ? ` (${escapeHtml(c.leatherColorNote)})` : '')),
    c.leatherType && c.leatherType !== 'None' && fieldRow('Leather Type', escapeHtml(c.leatherType) + (c.leatherTypeNote ? ` (${escapeHtml(c.leatherTypeNote)})` : '')),
    c.innerLining && c.innerLining !== 'None' && fieldRow('Inner Lining', escapeHtml(c.innerLining) + (c.innerLiningNote ? ` (${escapeHtml(c.innerLiningNote)})` : '')),
    c.hardwareColor && c.hardwareColor !== 'None' && fieldRow('Hardware Color', escapeHtml(c.hardwareColor) + (c.hardwareColorNote ? ` (${escapeHtml(c.hardwareColorNote)})` : '')),
  ].filter(Boolean).join('');

  const dashboardUrl = `${process.env.NEXTAUTH_URL || 'https://pairolifestyle.com'}/admin/orders/${order._id}`;
  const html = emailShell({
    eyebrow: 'Admin Notification',
    heading: 'New Custom Order Request',
    bodyHtml: `
      ${emailPanel(fieldTable(
        fieldRow('Request Number', `#${escapeHtml(order.orderNumber)}`) +
        fieldRow('Customer', escapeHtml(order.shippingAddress?.fullName || 'N/A')) +
        fieldRow('Email', escapeHtml(order.customer?.email || 'N/A')) +
        fieldRow('Phone', escapeHtml(order.shippingAddress?.phone || 'N/A')) +
        fieldRow('Product', escapeHtml(item.name || 'N/A'))
      ))}
      ${emailPanel(fieldTable(rows), { title: 'Design Specifications' })}
      ${buttonBlock(dashboardUrl, 'View Order & Specifications')}
    `,
  });

  await dispatchEmail({
    to: adminEmail,
    subject: `New Custom Order: #${order.orderNumber} by ${order.shippingAddress?.fullName || 'Guest'}`,
    html,
    from: getFromAddress('PAIRO System'),
    label: `Admin custom order notification (#${order.orderNumber})`,
  });
}

// ─── PRODUCT Q&A EMAILS ────────────────────────────────────────────────────────

/**
 * Send Question Submission Confirmation Email to Customer
 */
export async function sendQuestionConfirmationEmail({ customerEmail, customerName, productName }) {
  const html = emailShell({
    eyebrow: 'Customer Experience',
    heading: 'We’ve Received Your Question',
    bodyHtml: `
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:14px;">Dear ${escapeHtml(customerName || 'Customer')},</p>
      <p style="margin:0 0 10px;color:${BRAND.ink};font-size:15px;line-height:1.7;">Thank you for your question regarding <strong>${escapeHtml(productName)}</strong>.</p>
      <p style="margin:0;color:${BRAND.muted};font-size:14px;line-height:1.7;">Our team will review it and get back to you shortly.</p>
    `,
  });

  await dispatchEmail({ to: customerEmail, subject: `We have received your question regarding ${productName}`, html, from: getFromAddress('PAIRO Store'), label: 'Question confirmation' });
}

/**
 * Send Admin Notification for a New Customer Question
 */
export async function sendAdminQuestionNotification({ customerName, customerEmail, productName, questionText }) {
  if (!isSmtpConfigured()) {
    console.log(`[Email Simulation] Admin notified of new question by ${customerName}`);
    return;
  }

  const adminEmail = await resolveAdminEmail('new product question');
  if (!adminEmail) return;

  const dateStr = new Date().toLocaleString();
  const html = emailShell({
    eyebrow: 'Admin Notification',
    heading: 'New Product Question',
    bodyHtml: `
      ${emailPanel(fieldTable(
        fieldRow('Customer Name', escapeHtml(customerName)) +
        fieldRow('Customer Email', escapeHtml(customerEmail)) +
        fieldRow('Product Name', escapeHtml(productName)) +
        fieldRow('Submitted Date', dateStr)
      ))}
      ${emailPanel(`<p style="margin:0;color:${BRAND.ink};font-size:14px;line-height:1.6;font-style:italic;">“${escapeHtml(questionText)}”</p>`, { title: 'Submitted Question' })}
      ${buttonBlock(`${process.env.NEXTAUTH_URL || 'https://pairolifestyle.com'}/admin/products/questions`, 'Moderate Questions & Answers')}
    `,
  });

  await dispatchEmail({
    to: adminEmail,
    subject: `New Q&A Question on ${productName} by ${customerName}`,
    html,
    from: getFromAddress('PAIRO Store System'),
    label: 'Admin question notification',
  });
}

/**
 * Send Question Reply Email to Customer
 */
export async function sendQuestionReplyEmail({ customerEmail, customerName, originalQuestion, replyText, productName, productSlug }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://pairolifestyle.com';
  const productLink = `${siteUrl}/product/${productSlug}`;
  const storeName = process.env.STORE_NAME || 'PAIRO Lifestyle';

  const html = emailShell({
    eyebrow: 'Customer Experience',
    heading: 'Your Question Has Been Answered',
    bodyHtml: `
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:14px;">Dear ${escapeHtml(customerName || 'Customer')},</p>
      <p style="margin:0 0 20px;color:${BRAND.ink};font-size:15px;line-height:1.7;">We've answered your question regarding <strong>${escapeHtml(productName)}</strong>.</p>
      ${emailPanel(`<p style="margin:0;font-size:14px;color:${BRAND.muted};font-style:italic;">“${escapeHtml(originalQuestion)}”</p>`, { title: 'Your Question' })}
      ${emailPanel(`<p style="margin:0;font-size:14px;color:${BRAND.ink};font-weight:600;">${escapeHtml(replyText)}</p>`, { title: `${escapeHtml(storeName)} Store Reply`, accentColor: BRAND.ink })}
      <p style="margin:24px 0 0;font-size:14px;color:${BRAND.ink};">View this Q&amp;A on the product page: <a href="${productLink}" style="color:${BRAND.ink};font-weight:700;text-decoration:underline;">${escapeHtml(productName)}</a></p>
    `,
  });

  await dispatchEmail({ to: customerEmail, subject: `Answered: Your question regarding ${productName}`, html, from: getFromAddress('PAIRO Support'), label: 'Question reply' });
}

// ─── CUSTOM JACKET INQUIRY EMAILS ──────────────────────────────────────────────

/**
 * Send a confirmation email to the customer who submitted a Custom Jacket inquiry.
 */
export async function sendCustomJacketConfirmation(toEmail, firstName, inquiry) {
  const storeName = process.env.STORE_NAME || 'PAIRO Lifestyle';
  const storeUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pairolifestyle.com';

  const rows = [
    inquiry.jacketType && fieldRow('Jacket Type', escapeHtml(inquiry.jacketType)),
    inquiry.preferredLeather && fieldRow('Leather', escapeHtml(inquiry.preferredLeather)),
    inquiry.preferredColor && fieldRow('Color', escapeHtml(inquiry.preferredColor)),
    inquiry.size && fieldRow('Size', escapeHtml(inquiry.size)),
    inquiry.budget && fieldRow('Budget', escapeHtml(inquiry.budget)),
  ].filter(Boolean).join('');

  const html = emailShell({
    eyebrow: 'Bespoke Jacket Service',
    heading: `Thank You, ${escapeHtml(firstName)}!`,
    subheading: `We've received your custom jacket inquiry and are thrilled to help you create something truly special. Our expert team will review your specifications and contact you within <strong>24 hours</strong>.`,
    bodyHtml: `
      ${emailPanel(fieldTable(rows), { title: 'Your Inquiry Summary' })}
      <p style="margin:0 0 24px;color:${BRAND.muted};font-size:14px;line-height:1.7;">While you wait, feel free to explore our existing collection for inspiration.</p>
      ${buttonBlock(`${storeUrl}/shop`, 'Explore Collection')}
    `,
    preheader: 'We’ve received your custom jacket inquiry.',
  });

  await dispatchEmail({
    to: toEmail,
    subject: `Your Custom Jacket Inquiry — We'll Be In Touch!`,
    html,
    from: getFromAddress(storeName),
    label: 'Custom jacket confirmation',
    critical: true,
  });
}

/**
 * Notify admin of a new Custom Jacket inquiry.
 */
export async function sendCustomJacketAdminNotification(inquiry) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.STORE_EMAIL || 'support@pairolifestyle.com';
  const storeUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pairolifestyle.com';

  const customerRows = [
    fieldRow('Name', `${escapeHtml(inquiry.firstName)} ${escapeHtml(inquiry.lastName)}`),
    fieldRow('Email', escapeHtml(inquiry.email)),
    inquiry.phone && fieldRow('Phone', escapeHtml(inquiry.phone)),
    inquiry.country && fieldRow('Location', `${inquiry.city ? escapeHtml(inquiry.city) + ', ' : ''}${escapeHtml(inquiry.country)}`),
  ].filter(Boolean).join('');

  const specRows = [
    inquiry.jacketType && fieldRow('Type', escapeHtml(inquiry.jacketType)),
    inquiry.gender && fieldRow('Gender', escapeHtml(inquiry.gender)),
    inquiry.preferredLeather && fieldRow('Leather', escapeHtml(inquiry.preferredLeather)),
    inquiry.preferredColor && fieldRow('Color', escapeHtml(inquiry.preferredColor)),
    inquiry.size && fieldRow('Size', escapeHtml(inquiry.size)),
    inquiry.budget && fieldRow('Budget', escapeHtml(inquiry.budget)),
    inquiry.deadline && fieldRow('Deadline', escapeHtml(inquiry.deadline)),
  ].filter(Boolean).join('');

  const html = emailShell({
    eyebrow: 'Admin Notification',
    heading: 'New Custom Jacket Inquiry',
    bodyHtml: `
      ${emailPanel(fieldTable(customerRows), { title: 'Customer' })}
      ${emailPanel(fieldTable(specRows), { title: 'Specifications' })}
      ${inquiry.additionalNotes ? emailPanel(`<p style="margin:0;font-size:13px;color:${BRAND.ink};line-height:1.7;">${escapeHtml(inquiry.additionalNotes)}</p>`, { title: 'Additional Notes' }) : ''}
      ${inquiry.referenceImages?.length > 0 ? `<p style="margin:0 0 16px;font-size:13px;color:${BRAND.muted};"><strong>Reference Images:</strong> ${inquiry.referenceImages.length} uploaded</p>` : ''}
      ${buttonBlock(`${storeUrl}/admin/custom-jacket-inquiries`, 'View In Dashboard')}
    `,
    preheader: `New inquiry from ${inquiry.firstName} ${inquiry.lastName}.`,
  });

  await dispatchEmail({
    to: adminEmail,
    subject: `New Custom Jacket Inquiry — ${inquiry.firstName} ${inquiry.lastName}`,
    html,
    from: getFromAddress('PAIRO System'),
    label: 'Custom jacket admin notification',
    critical: true,
  });
}

// ─── CUSTOM ORDER: PAYMENT LINK & INVOICE EMAILS ──────────────────────────────

/**
 * Email a Stripe Payment Link to the customer for an admin-finalized Custom Order.
 */
export async function sendPaymentLinkEmail(order, paymentLinkUrl) {
  const storeName = process.env.STORE_NAME || 'PAIRO Lifestyle';
  const firstName = escapeHtml((order.shippingAddress?.fullName || '').split(' ')[0] || 'there');
  const item = order.items?.[0] || {};
  const total = order.financials?.total || 0;
  const currency = order.financials?.currency || 'USD';

  const html = emailShell({
    eyebrow: 'Bespoke Jacket Service',
    heading: `Hi ${firstName}, Your Jacket Is Ready To Order!`,
    subheading: `Your bespoke <strong>${escapeHtml(item.name || 'Custom Jacket')}</strong> has been finalized. Please complete your payment below to confirm and begin production of order <strong>#${escapeHtml(order.orderNumber)}</strong>.`,
    bodyHtml: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:10px;margin:0 0 28px;">
        <tr><td style="padding:24px;text-align:center;">
          <p style="margin:0 0 6px;color:${BRAND.muted};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Amount Due</p>
          <p style="margin:0;color:${BRAND.ink};font-size:34px;font-weight:800;">${currency} ${total.toLocaleString()}</p>
        </td></tr>
      </table>
      ${buttonBlock(paymentLinkUrl, 'Pay Now')}
      <p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;">If the button above doesn't work, copy and paste this link into your browser:<br/><a href="${paymentLinkUrl}" style="color:${BRAND.ink};word-break:break-all;">${paymentLinkUrl}</a></p>
    `,
    preheader: `Complete your payment for order #${order.orderNumber}.`,
  });

  await dispatchEmail({
    to: order.customer?.email,
    subject: `Complete Your Payment — Order #${order.orderNumber}`,
    html,
    from: getFromAddress(storeName),
    label: `Payment link (#${order.orderNumber})`,
    critical: true,
  });
}

/**
 * Email an HTML invoice to the customer for an order (used for admin-triggered "Send Invoice").
 */
export async function sendOrderInvoiceEmail(order) {
  const storeName = process.env.STORE_NAME || 'PAIRO Lifestyle';
  const currency = order.financials?.currency || 'USD';
  const fullName = escapeHtml(order.shippingAddress?.fullName || 'Customer');

  const itemsRows = (order.items || []).map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.ink};">${escapeHtml(item.name || '')}</td>
      <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.muted};text-align:center;">${item.quantity || 1}</td>
      <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.ink};text-align:right;font-weight:700;">${currency} ${((item.priceAtPurchase || 0) * (item.quantity || 1)).toLocaleString()}</td>
    </tr>`).join('');

  const totalsRows = `
    <tr><td style="padding:4px 0;font-size:13px;color:${BRAND.muted};">Subtotal</td><td style="padding:4px 0;font-size:13px;color:${BRAND.ink};text-align:right;">${currency} ${(order.financials?.subtotal || 0).toLocaleString()}</td></tr>
    ${order.financials?.shippingCost ? `<tr><td style="padding:4px 0;font-size:13px;color:${BRAND.muted};">Shipping</td><td style="padding:4px 0;font-size:13px;color:${BRAND.ink};text-align:right;">${currency} ${order.financials.shippingCost.toLocaleString()}</td></tr>` : ''}
    ${order.financials?.tax ? `<tr><td style="padding:4px 0;font-size:13px;color:${BRAND.muted};">Tax</td><td style="padding:4px 0;font-size:13px;color:${BRAND.ink};text-align:right;">${currency} ${order.financials.tax.toLocaleString()}</td></tr>` : ''}
    <tr><td style="padding:14px 0 0;font-size:15px;font-weight:800;color:${BRAND.ink};border-top:2px solid ${BRAND.ink};">Total</td><td style="padding:14px 0 0;font-size:15px;font-weight:800;color:${BRAND.ink};text-align:right;border-top:2px solid ${BRAND.ink};">${currency} ${(order.financials?.total || 0).toLocaleString()}</td></tr>
  `;

  const paymentCta = order.payment?.status !== 'Paid' && order.paymentLink?.url
    ? `<div style="margin:28px 0 0;padding-top:24px;border-top:1px solid ${BRAND.border};">
        ${buttonBlock(order.paymentLink.url, 'Pay Now')}
        <p style="margin:0;color:${BRAND.faint};font-size:11px;line-height:1.6;text-align:center;">Or copy this link into your browser:<br/><a href="${order.paymentLink.url}" style="color:${BRAND.ink};word-break:break-all;">${order.paymentLink.url}</a></p>
      </div>`
    : '';

  const html = emailShell({
    eyebrow: `Invoice #${order.orderNumber}`,
    heading: 'Your Invoice',
    bodyHtml: `
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 4px;color:${BRAND.muted};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Billed To</p>
        <p style="margin:0;color:${BRAND.ink};font-size:14px;font-weight:700;">${fullName}</p>
        <p style="margin:2px 0 0;color:${BRAND.muted};font-size:13px;">${escapeHtml(order.customer?.email || '')}</p>
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border-collapse:collapse;">
        <thead><tr>
          <th style="text-align:left;padding-bottom:8px;border-bottom:2px solid ${BRAND.ink};font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};">Item</th>
          <th style="text-align:center;padding-bottom:8px;border-bottom:2px solid ${BRAND.ink};font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};">Qty</th>
          <th style="text-align:right;padding-bottom:8px;border-bottom:2px solid ${BRAND.ink};font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};">Total</th>
        </tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${totalsRows}</table>
      <p style="margin:24px 0 0;color:${BRAND.muted};font-size:12px;">Payment status: <strong style="color:${BRAND.ink};">${escapeHtml(order.payment?.status || 'Pending')}</strong></p>
      ${paymentCta}
    `,
    preheader: `Invoice for order #${order.orderNumber}.`,
  });

  await dispatchEmail({
    to: order.customer?.email,
    subject: `Invoice — Order #${order.orderNumber}`,
    html,
    from: getFromAddress(storeName),
    label: `Invoice (#${order.orderNumber})`,
    critical: true,
  });
}
