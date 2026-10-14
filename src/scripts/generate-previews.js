const fs = require('fs');
const path = require('path');

// --- BRAND SYSTEM (Identical to src/lib/email.js) ---
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

const STORE_NAME = 'PAIRO Lifestyle';
const STORE_URL = 'https://pairolifestyle.com';

function escapeHtml(str) {
  if (typeof str !== 'string') return str == null ? '' : String(str);
  return str.replace(/[&<>"'`\/]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;'
  }[char]));
}

function emailShell({ eyebrow, heading, subheading, bodyHtml, preheader = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(heading || STORE_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BRAND.paper};border-radius:16px;overflow:hidden;border:1px solid ${BRAND.border};">
  <tr><td style="background:${BRAND.ink};padding:36px 40px;text-align:center;">
    <p style="margin:0 0 8px;color:rgba(255,255,255,0.55);font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">${escapeHtml(eyebrow || STORE_NAME)}</p>
    <h1 style="margin:0;color:#ffffff;font-size:21px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">${escapeHtml(STORE_NAME)}</h1>
  </td></tr>
  <tr><td style="padding:44px 40px 36px;">
    ${heading ? `<h2 style="margin:0 0 14px;color:${BRAND.ink};font-size:21px;font-weight:700;letter-spacing:-0.3px;">${heading}</h2>` : ''}
    ${subheading ? `<p style="margin:0 0 28px;color:${BRAND.muted};font-size:14px;line-height:1.7;">${subheading}</p>` : ''}
    ${bodyHtml || ''}
  </td></tr>
  <tr><td style="background:${BRAND.surface};border-top:1px solid ${BRAND.border};padding:26px 40px;text-align:center;">
    <p style="margin:0;color:${BRAND.ink};font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">${escapeHtml(STORE_NAME)}</p>
    <p style="margin:8px 0 0;color:${BRAND.faint};font-size:11px;">&copy; ${new Date().getFullYear()} ${escapeHtml(STORE_NAME)} &middot; <a href="${STORE_URL}" style="color:${BRAND.faint};text-decoration:underline;">${STORE_URL.replace(/^https?:\/\//, '')}</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

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

function emailPanel(innerHtml, { title, accentColor } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:10px;margin:0 0 24px;${accentColor ? `border-left:4px solid ${accentColor};` : ''}">
<tr><td style="padding:20px 22px;">
${title ? `<p style="margin:0 0 12px;color:${BRAND.ink};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(title)}</p>` : ''}
${innerHtml}
</td></tr></table>`;
}

function fieldRow(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `<tr><td style="padding:6px 0;color:${BRAND.muted};font-size:13px;width:38%;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;color:${BRAND.ink};font-size:13px;font-weight:600;">${value}</td></tr>`;
}

function fieldTable(rowsHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rowsHtml}</table>`;
}

// --- SAMPLE DATA OBJECTS ---
const sampleOrder = {
  _id: "670c3e9821f0814bb5e40a12",
  orderNumber: "PL-84920",
  createdAt: new Date("2026-10-14T14:32:00Z"),
  customer: { email: "alex.mercer@gmail.com" },
  items: [
    {
      name: "The Vanguard Double-Rider Leather Jacket",
      selectedVariant: { title: "Vintage Espresso / Size L" },
      quantity: 1,
      priceAtPurchase: 580
    },
    {
      name: "Handcrafted Italian Leather Conditioning Balm",
      selectedVariant: { title: "100ml Tin" },
      quantity: 2,
      priceAtPurchase: 35
    }
  ],
  financials: {
    subtotal: 650,
    shippingCost: 0,
    tax: 0,
    total: 650,
    currency: "USD"
  },
  guestAccount: {
    created: true,
    temporaryPassword: "pairo-SecurePass-882",
    loginEmail: "alex.mercer@gmail.com",
    loginUrl: "https://pairolifestyle.com/login"
  },
  shippingAddress: {
    fullName: "Alex Mercer",
    street: "742 Evergreen Terrace, Apt 4B",
    city: "Springfield, OR",
    zip: "97477",
    country: "United States",
    phone: "+1 (555) 234-5678"
  },
  payment: {
    status: "Paid"
  }
};

const sampleUnpaidInvoiceOrder = {
  ...sampleOrder,
  orderNumber: "PL-84921",
  payment: { status: "Pending" },
  paymentLink: { url: "https://buy.stripe.com/test_00g4hA4yB8nK3P2" }
};

const sampleCustomOrder = {
  _id: "670c4f1021f0814bb5e40b34",
  orderNumber: "BPS-1049",
  createdAt: new Date("2026-10-14T15:30:00Z"),
  customer: { email: "sophia.laurent@luxurymail.com" },
  shippingAddress: {
    fullName: "Sophia Laurent",
    street: "128 Avenue Montaigne",
    city: "Paris",
    zip: "75008",
    country: "France",
    phone: "+33 1 42 68 55 00"
  },
  customerNote: "Please ensure double-stitched reinforced lapels and antiqued brass hardware finish. Extra sleeve length of +1 inch.",
  items: [
    {
      name: "The Monarch Bespoke Leather Trench",
      customization: {
        leatherColor: "Cognac Brown",
        leatherColorNote: "Hand-patinated antique finish",
        leatherType: "Full-Grain Italian Calfskin",
        leatherTypeNote: "1.2mm supple vegetable tan",
        innerLining: "Burgundy Pure Silk Jacquard",
        innerLiningNote: "Monogram woven lining",
        hardwareColor: "Antiqued Brass",
        hardwareColorNote: "YKK Excella heavy-duty zips",
        fur: {
          type: "Shearling Collar",
          typeNote: "Natural Spanish Merino",
          color: "Deep Caramel",
          placement: ["Collar", "Lapel Facing"],
          density: "Heavy Winter Density",
          removable: true
        },
        artwork: {
          frontChest: { name: "custom-crest-monogram.pdf", url: "https://pairolifestyle.com/uploads/custom-crest-monogram.pdf" },
          insidePatch: { name: "signature-leather-patch.png", url: "https://pairolifestyle.com/uploads/signature-leather-patch.png" }
        }
      }
    }
  ],
  financials: {
    total: 850,
    currency: "USD"
  }
};

const sampleJacketInquiry = {
  firstName: "Julian",
  lastName: "Vance",
  email: "julian.vance@studio.co",
  phone: "+1 (415) 890-1234",
  city: "San Francisco",
  country: "United States",
  jacketType: "Bespoke Café Racer Jacket",
  gender: "Men",
  preferredLeather: "Full-Grain Horween Chromexcel Leather",
  preferredColor: "Midnight Obsidian Black",
  size: "Custom Tailored (Measurements Provided)",
  budget: "$750 - $1,200",
  deadline: "November 25, 2026",
  additionalNotes: "Looking for an asymmetrical zip with red quilted satin lining and reinforced elbow patches for riding.",
  referenceImages: [
    "https://pairolifestyle.com/uploads/inquiry-ref-1.jpg",
    "https://pairolifestyle.com/uploads/inquiry-ref-2.jpg"
  ]
};

// --- EMAIL TEMPLATE RENDERERS (Exact replicas of src/lib/email.js) ---

const emails = [
  // 1. Order Confirmation (Customer)
  {
    id: "01-order-confirmation-customer",
    category: "Store Orders",
    role: "Customer",
    title: "Order Confirmation (Customer)",
    subject: `Order Confirmed: #${sampleOrder.orderNumber}`,
    from: `"PAIRO Store" <support@pairolifestyle.com>`,
    to: sampleOrder.customer.email,
    trigger: "Customer successfully completes checkout on storefront",
    render: () => {
      const order = sampleOrder;
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

      return emailShell({
        eyebrow: 'Order Confirmed',
        heading: 'Thank You For Your Order',
        subheading: `Hi ${escapeHtml(order.shippingAddress?.fullName?.split(' ')[0] || 'there')}, your order <strong>#${escapeHtml(order.orderNumber)}</strong> has been confirmed and is being prepared for dispatch.`,
        bodyHtml: `${itemsTable}<div style="margin-top:28px;">${accountSectionHtml}${shippingHtml}</div>`,
        preheader: `Your order #${order.orderNumber} has been confirmed.`,
      });
    }
  },

  // 2. Admin Order Notification (Admin)
  {
    id: "02-order-notification-admin",
    category: "Store Orders",
    role: "Admin",
    title: "New Order Notification (Admin)",
    subject: `New Order: #${sampleOrder.orderNumber} — $${(sampleOrder.financials.total).toLocaleString()}`,
    from: `"PAIRO System" <support@pairolifestyle.com>`,
    to: "admin@pairolifestyle.com",
    trigger: "Fired immediately upon paid order placement via internal order listener",
    render: () => {
      const order = sampleOrder;
      const dashboardUrl = `${STORE_URL}/admin/orders/${order._id}`;
      return emailShell({
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
    }
  },

  // 3. Order Invoice Email (Customer)
  {
    id: "03-order-invoice-customer",
    category: "Store Orders",
    role: "Customer",
    title: "Order Invoice Email (Customer)",
    subject: `Invoice — Order #${sampleUnpaidInvoiceOrder.orderNumber}`,
    from: `"PAIRO Lifestyle" <support@pairolifestyle.com>`,
    to: sampleUnpaidInvoiceOrder.customer.email,
    trigger: "Admin clicks 'Send Invoice' or 'Convert to Card Payment' in admin dashboard",
    render: () => {
      const order = sampleUnpaidInvoiceOrder;
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

      return emailShell({
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
    }
  },

  // 4. Custom Order Confirmation (Customer)
  {
    id: "04-custom-order-confirmation-customer",
    category: "Bespoke & Custom Jackets",
    role: "Customer",
    title: "Bespoke Design Request Confirmation (Customer)",
    subject: `PAIRO Bespoke Design Request Received: #${sampleCustomOrder.orderNumber}`,
    from: `"PAIRO Custom Design" <support@pairolifestyle.com>`,
    to: sampleCustomOrder.customer.email,
    trigger: "Customer submits a custom design configuration request on product page",
    render: () => {
      const order = sampleCustomOrder;
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

      return emailShell({
        eyebrow: 'Bespoke Design Service',
        heading: `Thank You, ${escapeHtml(order.shippingAddress?.fullName?.split(' ')[0] || 'there')}!`,
        subheading: `We've received your custom design request for <strong>${escapeHtml(item.name || '')}</strong>. Your request ID is <strong>#${escapeHtml(order.orderNumber)}</strong>, submitted on ${new Date(order.createdAt).toLocaleDateString()}.`,
        bodyHtml: `
          ${emailPanel(fieldTable(rows.join('')) + artworkHtml + notesHtml, { title: 'Your Custom Selections' })}
          <p style="margin:0;color:${BRAND.muted};font-size:14px;line-height:1.7;">Our master artisans and design team are already reviewing your customization. We will contact you via email or phone shortly to discuss pricing, options, and timeline.</p>
        `,
        preheader: `Request #${order.orderNumber} received.`,
      });
    }
  },

  // 5. Admin Custom Order Notification (Admin)
  {
    id: "05-custom-order-notification-admin",
    category: "Bespoke & Custom Jackets",
    role: "Admin",
    title: "New Custom Order Notification (Admin)",
    subject: `New Custom Order: #${sampleCustomOrder.orderNumber} by ${sampleCustomOrder.shippingAddress.fullName}`,
    from: `"PAIRO System" <support@pairolifestyle.com>`,
    to: "admin@pairolifestyle.com",
    trigger: "Fired when customer submits a custom design configuration",
    render: () => {
      const order = sampleCustomOrder;
      const item = order.items?.[0] || {};
      const c = item.customization || {};
      const rows = [
        c.leatherColor && c.leatherColor !== 'None' && fieldRow('Leather Color', escapeHtml(c.leatherColor) + (c.leatherColorNote ? ` (${escapeHtml(c.leatherColorNote)})` : '')),
        c.leatherType && c.leatherType !== 'None' && fieldRow('Leather Type', escapeHtml(c.leatherType) + (c.leatherTypeNote ? ` (${escapeHtml(c.leatherTypeNote)})` : '')),
        c.innerLining && c.innerLining !== 'None' && fieldRow('Inner Lining', escapeHtml(c.innerLining) + (c.innerLiningNote ? ` (${escapeHtml(c.innerLiningNote)})` : '')),
        c.hardwareColor && c.hardwareColor !== 'None' && fieldRow('Hardware Color', escapeHtml(c.hardwareColor) + (c.hardwareColorNote ? ` (${escapeHtml(c.hardwareColorNote)})` : '')),
      ].filter(Boolean).join('');

      const dashboardUrl = `${STORE_URL}/admin/orders/${order._id}`;
      return emailShell({
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
    }
  },

  // 6. Custom Jacket Inquiry Confirmation (Customer)
  {
    id: "06-custom-jacket-inquiry-customer",
    category: "Bespoke & Custom Jackets",
    role: "Customer",
    title: "Custom Jacket Inquiry Confirmation (Customer)",
    subject: `Your Custom Jacket Inquiry — We'll Be In Touch!`,
    from: `"PAIRO Lifestyle" <support@pairolifestyle.com>`,
    to: sampleJacketInquiry.email,
    trigger: "Customer submits bespoke jacket inquiry form (/custom-jacket)",
    render: () => {
      const inquiry = sampleJacketInquiry;
      const firstName = inquiry.firstName;
      const rows = [
        inquiry.jacketType && fieldRow('Jacket Type', escapeHtml(inquiry.jacketType)),
        inquiry.preferredLeather && fieldRow('Leather', escapeHtml(inquiry.preferredLeather)),
        inquiry.preferredColor && fieldRow('Color', escapeHtml(inquiry.preferredColor)),
        inquiry.size && fieldRow('Size', escapeHtml(inquiry.size)),
        inquiry.budget && fieldRow('Budget', escapeHtml(inquiry.budget)),
      ].filter(Boolean).join('');

      return emailShell({
        eyebrow: 'Bespoke Jacket Service',
        heading: `Thank You, ${escapeHtml(firstName)}!`,
        subheading: `We've received your custom jacket inquiry and are thrilled to help you create something truly special. Our expert team will review your specifications and contact you within <strong>24 hours</strong>.`,
        bodyHtml: `
          ${emailPanel(fieldTable(rows), { title: 'Your Inquiry Summary' })}
          <p style="margin:0 0 24px;color:${BRAND.muted};font-size:14px;line-height:1.7;">While you wait, feel free to explore our existing collection for inspiration.</p>
          ${buttonBlock(`${STORE_URL}/shop`, 'Explore Collection')}
        `,
        preheader: 'We’ve received your custom jacket inquiry.',
      });
    }
  },

  // 7. Custom Jacket Admin Notification (Admin)
  {
    id: "07-custom-jacket-inquiry-admin",
    category: "Bespoke & Custom Jackets",
    role: "Admin",
    title: "New Custom Jacket Inquiry (Admin)",
    subject: `New Custom Jacket Inquiry — ${sampleJacketInquiry.firstName} ${sampleJacketInquiry.lastName}`,
    from: `"PAIRO System" <support@pairolifestyle.com>`,
    to: "admin@pairolifestyle.com",
    trigger: "Fired when customer submits bespoke jacket inquiry form",
    render: () => {
      const inquiry = sampleJacketInquiry;
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

      return emailShell({
        eyebrow: 'Admin Notification',
        heading: 'New Custom Jacket Inquiry',
        bodyHtml: `
          ${emailPanel(fieldTable(customerRows), { title: 'Customer' })}
          ${emailPanel(fieldTable(specRows), { title: 'Specifications' })}
          ${inquiry.additionalNotes ? emailPanel(`<p style="margin:0;font-size:13px;color:${BRAND.ink};line-height:1.7;">${escapeHtml(inquiry.additionalNotes)}</p>`, { title: 'Additional Notes' }) : ''}
          ${inquiry.referenceImages?.length > 0 ? `<p style="margin:0 0 16px;font-size:13px;color:${BRAND.muted};"><strong>Reference Images:</strong> ${inquiry.referenceImages.length} uploaded</p>` : ''}
          ${buttonBlock(`${STORE_URL}/admin/custom-jacket-inquiries`, 'View In Dashboard')}
        `,
        preheader: `New inquiry from ${inquiry.firstName} ${inquiry.lastName}.`,
      });
    }
  },

  // 8. Custom Order Payment Link Email (Customer)
  {
    id: "08-custom-order-payment-link-customer",
    category: "Bespoke & Custom Jackets",
    role: "Customer",
    title: "Stripe Payment Link (Customer)",
    subject: `Complete Your Payment — Order #${sampleCustomOrder.orderNumber}`,
    from: `"PAIRO Lifestyle" <support@pairolifestyle.com>`,
    to: sampleCustomOrder.customer.email,
    trigger: "Admin clicks 'Create & Send Payment Link' after quoting bespoke order",
    render: () => {
      const order = sampleCustomOrder;
      const paymentLinkUrl = "https://buy.stripe.com/test_00g4hA4yB8nK3P2";
      const firstName = escapeHtml((order.shippingAddress?.fullName || '').split(' ')[0] || 'there');
      const item = order.items?.[0] || {};
      const total = order.financials?.total || 850;
      const currency = order.financials?.currency || 'USD';

      return emailShell({
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
    }
  },

  // 9. Customer Email Verification (Customer)
  {
    id: "09-customer-email-verification",
    category: "Customer Accounts",
    role: "Customer",
    title: "Verify Your Email (Customer)",
    subject: `Verify your email — PAIRO Lifestyle`,
    from: `"PAIRO Lifestyle" <support@pairolifestyle.com>`,
    to: "eleanor.vance@gmail.com",
    trigger: "New customer registers account or clicks 'Resend Verification'",
    render: () => {
      const name = "Eleanor Vance";
      const firstName = name.split(' ')[0];
      const verificationUrl = "https://pairolifestyle.com/verify-email?token=9f8b4c2a1e7d0f3c8b5a";

      return emailShell({
        eyebrow: 'Lifestyle Collection',
        heading: 'Verify Your Email',
        subheading: `Hi ${escapeHtml(firstName)}, welcome to ${escapeHtml(STORE_NAME)}. Please verify your email address to activate your account and start shopping.`,
        bodyHtml: `
          ${buttonBlock(verificationUrl, 'Verify Email Address')}
          <p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;border-top:1px solid ${BRAND.border};padding-top:24px;">
            This link expires in <strong>24 hours</strong>. If you did not create an account at ${escapeHtml(STORE_NAME)}, you can safely ignore this email.
          </p>
          <p style="margin:12px 0 0;color:${BRAND.faint};font-size:11px;word-break:break-all;">${verificationUrl}</p>
        `,
        preheader: 'Verify your email to activate your account.',
      });
    }
  },

  // 10. Customer Password Reset (Customer)
  {
    id: "10-customer-password-reset",
    category: "Customer Accounts",
    role: "Customer",
    title: "Reset Your Password (Customer)",
    subject: `Reset your password — PAIRO Lifestyle`,
    from: `"PAIRO Lifestyle" <support@pairolifestyle.com>`,
    to: "eleanor.vance@gmail.com",
    trigger: "Customer requests password reset via /forgot-password",
    render: () => {
      const name = "Eleanor Vance";
      const firstName = name.split(' ')[0];
      const resetUrl = "https://pairolifestyle.com/reset-password?token=e4c8b2d1f9a03b57e62c";

      return emailShell({
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
    }
  },

  // 11. CRM / Support Submission Reply (Customer)
  {
    id: "11-crm-submission-reply-customer",
    category: "Product Q&A & Support",
    role: "Customer",
    title: "Customer Support / Concierge Reply",
    subject: "Re: Inquiry regarding custom sleeve tailoring options",
    from: `"PAIRO Support" <support@pairolifestyle.com>`,
    to: "david.miller@atelier.com",
    trigger: "Admin replies to customer ticket/message in CRM admin dashboard",
    render: () => {
      const customerName = "David Miller";
      const message = "Thank you for contacting PAIRO Lifestyle Concierge.\n\nRegarding your question about sleeve alteration: yes, we can adjust sleeve length up to +/- 2 inches at no additional charge during the initial tailoring phase. Simply specify your sleeve measurement from shoulder seam to wrist cuff when finalizing your bespoke order.\n\nPlease let us know if you need any assistance with taking measurements!";
      return emailShell({
        eyebrow: 'Concierge',
        heading: 'A Message From Our Team',
        bodyHtml: `
          <p style="margin:0 0 20px;color:${BRAND.muted};font-size:14px;">Dear ${escapeHtml(customerName || 'Customer')},</p>
          <div style="font-size:15px;color:${BRAND.ink};line-height:1.8;white-space:pre-wrap;">${escapeHtml(message)}</div>
          <div style="margin-top:36px;padding-top:20px;border-top:1px solid ${BRAND.border};">
            <p style="margin:0;color:${BRAND.muted};font-size:13px;">Kind regards,</p>
            <p style="margin:4px 0 0;color:${BRAND.ink};font-size:14px;font-weight:700;">The ${escapeHtml(STORE_NAME)} Team</p>
          </div>
        `,
        preheader: (message || '').slice(0, 120),
      });
    }
  },

  // 12. Affiliate Email Verification (Affiliate)
  {
    id: "12-affiliate-email-verification",
    category: "Affiliate Program",
    role: "Affiliate",
    title: "Affiliate Email Verification",
    subject: "Verify your email — PAIRO Affiliates",
    from: `"PAIRO Affiliates" <support@pairolifestyle.com>`,
    to: "marcus.sterling@partners.io",
    trigger: "Affiliate partner registers application on /affiliate/register",
    render: () => {
      const name = "Marcus Sterling";
      const firstName = name.split(' ')[0];
      const verificationUrl = "https://pairolifestyle.com/affiliate/verify-email?token=3a7b9c1d5e8f2046";

      return emailShell({
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
    }
  },

  // 13. Affiliate Application Received (Affiliate)
  {
    id: "13-affiliate-application-received",
    category: "Affiliate Program",
    role: "Affiliate",
    title: "Affiliate Application Received",
    subject: "Affiliate Application Received — Pairo Lifestyle",
    from: `"PAIRO Affiliates" <support@pairolifestyle.com>`,
    to: "marcus.sterling@partners.io",
    trigger: "Fired when affiliate confirms email address & application enters audit queue",
    render: () => {
      const affiliateName = "Marcus Sterling";
      return emailShell({
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
    }
  },

  // 14. Affiliate Application Approved (Affiliate)
  {
    id: "14-affiliate-application-approved",
    category: "Affiliate Program",
    role: "Affiliate",
    title: "Affiliate Application Approved",
    subject: "Affiliate Account Approved! — Pairo Lifestyle",
    from: `"PAIRO Affiliates" <support@pairolifestyle.com>`,
    to: "marcus.sterling@partners.io",
    trigger: "Admin clicks 'Approve' on affiliate application in admin dashboard",
    render: () => {
      const affiliateName = "Marcus Sterling";
      const toEmail = "marcus.sterling@partners.io";
      const referralCode = "MARCUS15";
      const tempPassword = "Pairo-Partner-2026!";
      const commissionType = "Percentage";
      const commissionRate = 10;
      const loginUrl = `${STORE_URL}/affiliate-login`;

      return emailShell({
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
    }
  },

  // 15. Affiliate Application Rejected (Affiliate)
  {
    id: "15-affiliate-application-rejected",
    category: "Affiliate Program",
    role: "Affiliate",
    title: "Affiliate Application Rejected",
    subject: "Affiliate Application Update — Pairo Lifestyle",
    from: `"PAIRO Affiliates" <support@pairolifestyle.com>`,
    to: "liam.thorne@marketing.net",
    trigger: "Admin clicks 'Reject' on affiliate application in admin dashboard",
    render: () => {
      const affiliateName = "Liam Thorne";
      const reason = "Your social media channels do not currently meet our minimum luxury outerwear audience criteria. You are welcome to re-apply in 90 days.";
      return emailShell({
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
    }
  },

  // 16. Affiliate Password Reset (Affiliate)
  {
    id: "16-affiliate-password-reset",
    category: "Affiliate Program",
    role: "Affiliate",
    title: "Affiliate Password Reset",
    subject: "Reset Your PAIRO Partner Password",
    from: `"PAIRO Partners" <support@pairolifestyle.com>`,
    to: "marcus.sterling@partners.io",
    trigger: "Affiliate requests password reset on /affiliate/forgot-password",
    render: () => {
      const firstName = "Marcus";
      const resetUrl = "https://pairolifestyle.com/affiliate/reset-password?token=7a9b0c2d3e4f5061";
      return emailShell({
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
    }
  },

  // 17. Affiliate Payout Update (Affiliate)
  {
    id: "17-affiliate-payout-update",
    category: "Affiliate Program",
    role: "Affiliate",
    title: "Affiliate Payout Status Update",
    subject: "Affiliate Payout Update: $1420 — Pairo Lifestyle",
    from: `"PAIRO Affiliates" <support@pairolifestyle.com>`,
    to: "marcus.sterling@partners.io",
    trigger: "Admin updates affiliate payout status (Paid / Approved / Processing)",
    render: () => {
      const affiliateName = "Marcus Sterling";
      const amount = "1,420";
      const status = "Approved & Transferred";
      const notes = "International wire transfer sent to Chase account ending in 4920. Funds typically settle within 2 business days.";

      return emailShell({
        eyebrow: 'Affiliate Partners',
        heading: 'Payout Update',
        bodyHtml: `
          <p style="margin:0 0 16px;color:${BRAND.muted};font-size:14px;">Dear ${escapeHtml(affiliateName)},</p>
          <p style="margin:0 0 8px;color:${BRAND.ink};font-size:15px;line-height:1.7;">This is an update regarding your affiliate payout request of <strong>$${amount}</strong>.</p>
          <p style="margin:0 0 ${notes ? '20px' : '0'};color:${BRAND.ink};font-size:15px;">Status: <strong style="text-transform:uppercase;">${escapeHtml(status)}</strong></p>
          ${notes ? emailPanel(`<p style="margin:0;color:${BRAND.ink};font-size:14px;line-height:1.6;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>`) : ''}
          <div style="padding-top:20px;border-top:1px solid ${BRAND.border};">
            <p style="margin:0;color:${BRAND.muted};font-size:13px;">Kind regards,</p>
            <p style="margin:4px 0 0;color:${BRAND.ink};font-size:14px;font-weight:700;">The Pairo Team</p>
          </div>
        `,
      });
    }
  },

  // 18. Product Q&A Confirmation (Customer)
  {
    id: "18-product-qa-confirmation-customer",
    category: "Product Q&A & Support",
    role: "Customer",
    title: "Product Question Confirmation (Customer)",
    subject: "We have received your question regarding The Aviator Shearling Leather Bomber",
    from: `"PAIRO Store" <support@pairolifestyle.com>`,
    to: "claire.dupont@paris.fr",
    trigger: "Customer submits a question in the Product Q&A tab on product page",
    render: () => {
      const customerName = "Claire Dupont";
      const productName = "The Aviator Shearling Leather Bomber";
      return emailShell({
        eyebrow: 'Customer Experience',
        heading: 'We’ve Received Your Question',
        bodyHtml: `
          <p style="margin:0 0 16px;color:${BRAND.muted};font-size:14px;">Dear ${escapeHtml(customerName || 'Customer')},</p>
          <p style="margin:0 0 10px;color:${BRAND.ink};font-size:15px;line-height:1.7;">Thank you for your question regarding <strong>${escapeHtml(productName)}</strong>.</p>
          <p style="margin:0;color:${BRAND.muted};font-size:14px;line-height:1.7;">Our team will review it and get back to you shortly.</p>
        `,
      });
    }
  },

  // 19. Product Q&A Admin Notification (Admin)
  {
    id: "19-product-qa-notification-admin",
    category: "Product Q&A & Support",
    role: "Admin",
    title: "New Product Question (Admin)",
    subject: "New Q&A Question on The Aviator Shearling Leather Bomber by Claire Dupont",
    from: `"PAIRO Store System" <support@pairolifestyle.com>`,
    to: "admin@pairolifestyle.com",
    trigger: "Fired when customer asks a question on any product page",
    render: () => {
      const customerName = "Claire Dupont";
      const customerEmail = "claire.dupont@paris.fr";
      const productName = "The Aviator Shearling Leather Bomber";
      const questionText = "Is the merino shearling collar detachable via hidden buttons or a zipper, and how water resistant is the antique nubuck finish in light rain?";
      const dateStr = "10/14/2026, 3:45:00 PM";

      return emailShell({
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
          ${buttonBlock(`${STORE_URL}/admin/products/questions`, 'Moderate Questions & Answers')}
        `,
      });
    }
  },

  // 20. Product Q&A Answer Reply (Customer)
  {
    id: "20-product-qa-reply-customer",
    category: "Product Q&A & Support",
    role: "Customer",
    title: "Product Question Answered (Customer)",
    subject: "Answered: Your question regarding The Aviator Shearling Leather Bomber",
    from: `"PAIRO Support" <support@pairolifestyle.com>`,
    to: "claire.dupont@paris.fr",
    trigger: "Admin submits an answer to a customer question in the Q&A moderation panel",
    render: () => {
      const customerName = "Claire Dupont";
      const productName = "The Aviator Shearling Leather Bomber";
      const productSlug = "aviator-shearling-leather-bomber";
      const originalQuestion = "Is the merino shearling collar detachable via hidden buttons or a zipper, and how water resistant is the antique nubuck finish in light rain?";
      const replyText = "The Spanish merino shearling collar attaches securely with handcrafted horn buttons concealed beneath the storm flap, allowing you to easily remove it. The leather receives a natural beeswax water-repellent treatment during tanning that resists light rain and snow beautifully.";
      const productLink = `${STORE_URL}/product/${productSlug}`;

      return emailShell({
        eyebrow: 'Customer Experience',
        heading: 'Your Question Has Been Answered',
        bodyHtml: `
          <p style="margin:0 0 16px;color:${BRAND.muted};font-size:14px;">Dear ${escapeHtml(customerName || 'Customer')},</p>
          <p style="margin:0 0 20px;color:${BRAND.ink};font-size:15px;line-height:1.7;">We've answered your question regarding <strong>${escapeHtml(productName)}</strong>.</p>
          ${emailPanel(`<p style="margin:0;font-size:14px;color:${BRAND.muted};font-style:italic;">“${escapeHtml(originalQuestion)}”</p>`, { title: 'Your Question' })}
          ${emailPanel(`<p style="margin:0;font-size:14px;color:${BRAND.ink};font-weight:600;">${escapeHtml(replyText)}</p>`, { title: `${escapeHtml(STORE_NAME)} Store Reply`, accentColor: BRAND.ink })}
          <p style="margin:24px 0 0;font-size:14px;color:${BRAND.ink};">View this Q&amp;A on the product page: <a href="${productLink}" style="color:${BRAND.ink};font-weight:700;text-decoration:underline;">${escapeHtml(productName)}</a></p>
        `,
      });
    }
  }
];

// --- GENERATE ALL FILES ---
const outDir = path.join(__dirname, '../../public/email-previews');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Write individual HTML files
const generatedList = [];
for (const item of emails) {
  const html = item.render();
  const filePath = path.join(outDir, `${item.id}.html`);
  fs.writeFileSync(filePath, html, 'utf-8');
  generatedList.push({
    id: item.id,
    category: item.category,
    role: item.role,
    title: item.title,
    subject: item.subject,
    from: item.from,
    to: item.to,
    trigger: item.trigger,
    fileName: `${item.id}.html`,
    rawHtml: html
  });
}

// 2. Build the Master Interactive Email Preview Dashboard
const categories = Array.from(new Set(generatedList.map(e => e.category)));

const masterHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PAIRO Lifestyle — Complete Email System Preview Gallery</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --ink: #4A2E1D;
      --ink-dark: #2A170C;
      --paper: #FFFFFF;
      --page-bg: #F4EFE6;
      --surface: #F9F6F0;
      --border: #E5DCce;
      --border-dark: #D4C6B3;
      --muted: #7A6F64;
      --accent-gold: #C5A059;
      --accent-light: #FDFBF7;
      --tag-cust: #2D6A4F;
      --tag-admin: #B23A22;
      --tag-aff: #7B2CBF;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--page-bg);
      color: var(--ink);
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* TOP BRAND BAR */
    header {
      background: var(--ink-dark);
      color: #fff;
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid var(--accent-gold);
      flex-shrink: 0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.18);
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand-logo {
      font-family: 'Cinzel', serif;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #fff;
    }
    .brand-pill {
      background: rgba(197, 160, 89, 0.2);
      border: 1px solid var(--accent-gold);
      color: var(--accent-gold);
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 600;
    }
    .top-stats {
      font-size: 13px;
      color: rgba(255,255,255,0.7);
      display: flex;
      gap: 20px;
      align-items: center;
    }
    .top-stats span b {
      color: #fff;
    }

    /* MAIN WORKSPACE */
    .app-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* SIDEBAR */
    aside {
      width: 360px;
      background: #FFFFFF;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .sidebar-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    .sidebar-header h3 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--ink);
      font-weight: 700;
      margin-bottom: 8px;
    }
    .search-input {
      width: 100%;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border-dark);
      font-size: 13px;
      outline: none;
      background: #fff;
      font-family: inherit;
    }
    .search-input:focus {
      border-color: var(--ink);
    }
    .sidebar-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .category-group {
      margin-bottom: 18px;
    }
    .cat-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--muted);
      padding: 6px 10px;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
    }
    .email-item {
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 4px;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .email-item:hover {
      background: var(--surface);
      border-color: var(--border);
    }
    .email-item.active {
      background: #F4EFE6;
      border-color: var(--accent-gold);
      box-shadow: 0 2px 8px rgba(74, 46, 29, 0.08);
    }
    .email-item-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--ink);
    }
    .email-item-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }
    .role-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .role-Customer { background: #E8F5E9; color: var(--tag-cust); border: 1px solid #C8E6C9; }
    .role-Admin { background: #FFEBEE; color: var(--tag-admin); border: 1px solid #FFCDD2; }
    .role-Affiliate { background: #F3E5F5; color: var(--tag-aff); border: 1px solid #E1BEE7; }

    /* PREVIEW CONTAINER */
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #EFE9DE;
      overflow: hidden;
    }

    /* PREVIEW META TOOLBAR */
    .meta-toolbar {
      background: #FFFFFF;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .meta-left {
      max-width: 65%;
    }
    .meta-subject {
      font-size: 17px;
      font-weight: 700;
      color: var(--ink);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .meta-details {
      display: flex;
      gap: 18px;
      font-size: 12px;
      color: var(--muted);
      flex-wrap: wrap;
    }
    .meta-details span b {
      color: var(--ink);
      font-weight: 600;
    }

    .meta-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .device-switcher {
      display: flex;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 3px;
    }
    .device-btn {
      padding: 6px 12px;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      cursor: pointer;
      transition: all 0.15s;
    }
    .device-btn.active {
      background: #FFFFFF;
      color: var(--ink);
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    .action-btn {
      padding: 7px 14px;
      border: 1px solid var(--border-dark);
      background: #FFFFFF;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--ink);
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .action-btn:hover {
      background: var(--surface);
      border-color: var(--ink);
    }
    .action-btn.primary {
      background: var(--ink);
      color: #fff;
      border-color: var(--ink);
    }
    .action-btn.primary:hover {
      background: var(--ink-dark);
    }

    /* IFRAME STAGE */
    .stage {
      flex: 1;
      overflow-y: auto;
      padding: 30px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      background: #EFE9DE;
    }
    .iframe-wrapper {
      transition: width 0.25s ease;
      background: #FFFFFF;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 14px 40px rgba(74, 46, 29, 0.12), 0 2px 6px rgba(0,0,0,0.05);
      border: 1px solid var(--border);
      height: 100%;
      min-height: 720px;
      display: flex;
      flex-direction: column;
    }
    .iframe-wrapper.desktop { width: 680px; }
    .iframe-wrapper.mobile { width: 390px; }
    .iframe-wrapper.full { width: 100%; max-width: 960px; }

    iframe {
      width: 100%;
      height: 100%;
      min-height: 720px;
      border: none;
      background: var(--page-bg);
      flex: 1;
    }

    /* RAW CODE MODAL / VIEW */
    .code-view {
      display: none;
      width: 100%;
      max-width: 900px;
      height: 100%;
      background: #1E1E1E;
      color: #E0E0E0;
      border-radius: 12px;
      padding: 20px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 12px;
      overflow: auto;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
      border: 1px solid #333;
    }

    /* TOAST */
    #toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--ink-dark);
      color: #FFFFFF;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 1000;
    }
    #toast.show {
      transform: translateY(0);
      opacity: 1;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <header>
    <div class="brand-wrap">
      <div class="brand-logo">PAIRO</div>
      <div class="brand-pill">Email System Suite &middot; 20 Templates</div>
    </div>
    <div class="top-stats">
      <span>Total Templates: <b>20</b></span>
      <span>Palette: <b style="color:var(--accent-gold);">Ink (#4A2E1D) &middot; Sand (#F3EFE7)</b></span>
      <span>Brand Standard: <b>RFC Compliant Shell</b></span>
    </div>
  </header>

  <!-- BODY -->
  <div class="app-body">
    <!-- SIDEBAR -->
    <aside>
      <div class="sidebar-header">
        <h3>Email Templates</h3>
        <input type="text" id="search" class="search-input" placeholder="Filter by name, customer, subject..." oninput="filterEmails()">
      </div>
      <div class="sidebar-scroll" id="sidebar-list">
        <!-- Rendered by JS -->
      </div>
    </aside>

    <!-- PREVIEW AREA -->
    <main>
      <div class="meta-toolbar">
        <div class="meta-left">
          <div class="meta-subject" id="disp-subject">Loading Subject...</div>
          <div class="meta-details">
            <span>To: <b id="disp-to">-</b></span>
            <span>From: <b id="disp-from">-</b></span>
            <span>Trigger: <b id="disp-trigger">-</b></span>
          </div>
        </div>
        <div class="meta-right">
          <div class="device-switcher">
            <button class="device-btn active" id="btn-desktop" onclick="setDevice('desktop')">Desktop (680px)</button>
            <button class="device-btn" id="btn-mobile" onclick="setDevice('mobile')">Mobile (390px)</button>
            <button class="device-btn" id="btn-full" onclick="setDevice('full')">Full View</button>
          </div>
          <button class="action-btn" id="btn-toggle-code" onclick="toggleCodeView()">View HTML</button>
          <button class="action-btn" onclick="copyCurrentHtml()">Copy HTML</button>
          <a class="action-btn primary" id="btn-open-tab" href="#" target="_blank">Open in New Tab &nearr;</a>
        </div>
      </div>

      <div class="stage">
        <div class="iframe-wrapper desktop" id="iframe-wrap">
          <iframe id="preview-frame" src=""></iframe>
        </div>
        <pre class="code-view" id="code-view"></pre>
      </div>
    </main>
  </div>

  <div id="toast">Copied to clipboard!</div>

  <script>
    const emailsData = ${JSON.stringify(generatedList)};
    let currentId = emailsData[0].id;
    let isCodeMode = false;

    function renderSidebar(filtered = emailsData) {
      const container = document.getElementById('sidebar-list');
      container.innerHTML = '';

      const cats = Array.from(new Set(filtered.map(e => e.category)));

      cats.forEach(cat => {
        const catItems = filtered.filter(e => e.category === cat);
        const group = document.createElement('div');
        group.className = 'category-group';

        const title = document.createElement('div');
        title.className = 'cat-title';
        title.innerHTML = '<span>' + cat + '</span><span>' + catItems.length + '</span>';
        group.appendChild(title);

        catItems.forEach(item => {
          const div = document.createElement('div');
          div.className = 'email-item' + (item.id === currentId ? ' active' : '');
          div.onclick = () => selectEmail(item.id);
          div.innerHTML = \`
            <div class="email-item-title">\${item.title}</div>
            <div class="email-item-meta">
              <span class="role-badge role-\${item.role}">\${item.role}</span>
              <span style="color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">\${item.subject}</span>
            </div>
          \`;
          group.appendChild(div);
        });

        container.appendChild(group);
      });
    }

    function selectEmail(id) {
      currentId = id;
      const email = emailsData.find(e => e.id === id);
      if (!email) return;

      document.querySelectorAll('.email-item').forEach(el => el.classList.remove('active'));
      renderSidebar(getFilteredList());

      // Update Meta
      document.getElementById('disp-subject').textContent = email.subject;
      document.getElementById('disp-to').textContent = email.to;
      document.getElementById('disp-from').textContent = email.from;
      document.getElementById('disp-trigger').textContent = email.trigger;
      document.getElementById('btn-open-tab').href = email.fileName;

      // Update Frame
      document.getElementById('preview-frame').src = email.fileName;
      document.getElementById('code-view').textContent = email.rawHtml;

      if (isCodeMode) {
        document.getElementById('iframe-wrap').style.display = 'none';
        document.getElementById('code-view').style.display = 'block';
      } else {
        document.getElementById('iframe-wrap').style.display = 'flex';
        document.getElementById('code-view').style.display = 'none';
      }
    }

    function setDevice(device) {
      const wrap = document.getElementById('iframe-wrap');
      wrap.className = 'iframe-wrapper ' + device;
      document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('btn-' + device).classList.add('active');
    }

    function toggleCodeView() {
      isCodeMode = !isCodeMode;
      const btn = document.getElementById('btn-toggle-code');
      btn.textContent = isCodeMode ? 'View Visual' : 'View HTML';
      btn.classList.toggle('primary', isCodeMode);

      document.getElementById('iframe-wrap').style.display = isCodeMode ? 'none' : 'flex';
      document.getElementById('code-view').style.display = isCodeMode ? 'block' : 'none';
    }

    function copyCurrentHtml() {
      const email = emailsData.find(e => e.id === currentId);
      if (!email) return;
      navigator.clipboard.writeText(email.rawHtml).then(() => {
        showToast('HTML copied to clipboard!');
      });
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    }

    function getFilteredList() {
      const q = document.getElementById('search').value.toLowerCase().trim();
      if (!q) return emailsData;
      return emailsData.filter(e => 
        e.title.toLowerCase().includes(q) || 
        e.subject.toLowerCase().includes(q) || 
        e.category.toLowerCase().includes(q) || 
        e.role.toLowerCase().includes(q) || 
        e.to.toLowerCase().includes(q)
      );
    }

    function filterEmails() {
      renderSidebar(getFilteredList());
    }

    // Init
    renderSidebar();
    selectEmail(currentId);
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'index.html'), masterHtml, 'utf-8');
console.log(`Successfully generated ${generatedList.length} email previews and the master dashboard in ${outDir}!`);
