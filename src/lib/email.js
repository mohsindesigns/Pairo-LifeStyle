import nodemailer from 'nodemailer';
import dbConnect from './db';
import Staff from '@/models/Staff';
import Role from '@/models/Role';

/**
 * Enterprise Email Dispatcher (Optimized for Gmail)
 * 
 * Note: To use Gmail, you must:
 * 1. Enable 2-Step Verification on your Google Account.
 * 2. Generate an "App Password" (Security > App Passwords).
 * 3. Use that 16-character password in EMAIL_PASS.
 */

const transporter = nodemailer.createTransport({
  // Use 'gmail' service directly as it handles the host/port/secure defaults automatically
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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
export async function sendAffiliateApplicationApproved(toEmail, affiliateName, referralCode) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email Simulation] Affiliate Application Approved → ${toEmail}`);
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
          <p style="margin: 4px 0; font-size: 14px;"><strong>Portal Login:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Referral Code:</strong> ${referralCode}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Commission Rate:</strong> 5% on all delivered orders</p>
          <p style="margin: 4px 0; font-size: 14px; color: #e11d48; font-weight: 600; margin-top: 8px;">Please use the 'Forgot Password' link on the login page to set your account password.</p>
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
