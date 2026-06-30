"use client";

import React from 'react';
import { siteConfig } from '@/config/siteConfig';

const InvoiceTemplate = ({ order }) => {
  if (!order) return null;

  return (
    <div id="invoice-print" className="bg-white p-12 max-w-4xl mx-auto font-sans text-black hidden print:block">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-8 mb-12">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">{siteConfig.name}</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">{siteConfig.tagline}</p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-sm font-bold uppercase tracking-widest">Order #{order.orderNumber}</p>
          <p className="text-xs text-black/60">{new Date(order.createdAt).toLocaleDateString()}</p>
          <p className="text-xs text-black/60">Status: {order.status}</p>
        </div>
      </div>

      {/* Addresses */}
      <div className="grid grid-cols-2 gap-12 mb-16">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-4">Ship To</h3>
          <p className="text-sm font-bold">{order.shippingAddress.fullName}</p>
          <p className="text-sm leading-relaxed text-black/60">
            {order.shippingAddress.street}<br />
            {order.shippingAddress.city}, {order.shippingAddress.zip}<br />
            {order.shippingAddress.country}
          </p>
          <p className="text-sm font-medium mt-2">{order.shippingAddress.phone}</p>
        </div>
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-4">Contact Detail</h3>
          <p className="text-sm font-bold text-black">{order.customer.email}</p>
          <p className="text-xs text-black/40 mt-1 italic">Authorized Acquisition</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse mb-16">
        <thead>
          <tr className="border-b border-black/10">
            <th className="py-4 text-left text-[10px] font-bold uppercase tracking-widest text-black/30">Description</th>
            <th className="py-4 text-center text-[10px] font-bold uppercase tracking-widest text-black/30">Price</th>
            <th className="py-4 text-center text-[10px] font-bold uppercase tracking-widest text-black/30">Qty</th>
            <th className="py-4 text-right text-[10px] font-bold uppercase tracking-widest text-black/30">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {order.items.map((item, i) => (
            <tr key={i}>
              <td className="py-6">
                <p className="text-sm font-bold uppercase tracking-tight">{item.name}</p>
                {item.selectedVariant?.options && Object.entries(item.selectedVariant.options).map(([k, v]) => (
                  <span key={k} className="text-[10px] font-bold text-black/40 uppercase mr-3">{k}: {v}</span>
                ))}
              </td>
              <td className="py-6 text-center text-sm font-medium">${item.priceAtPurchase.toLocaleString()}</td>
              <td className="py-6 text-center text-sm font-medium">{item.quantity}</td>
              <td className="py-6 text-right text-sm font-bold">${(item.priceAtPurchase * item.quantity).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="flex justify-end">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-sm text-black/40">
            <span>Subtotal</span>
            <span className="font-bold text-black">${order.financials.subtotal.toLocaleString()}</span>
          </div>
          {order.financials?.discountTotal && Number(order.financials.discountTotal) > 0 ? (
            <div className="flex justify-between text-sm text-green-600 font-bold">
              <span>Discount ({order.financials.promoCode})</span>
              <span>-${(Number(order.financials.discountTotal)).toLocaleString()}</span>
            </div>
          ) : null}
          {order.financials?.affiliateDiscountAmount && Number(order.financials.affiliateDiscountAmount) > 0 ? (
            <div className="flex justify-between text-sm text-emerald-600 font-bold">
              <span>Referral Discount ({order.affiliateReferralCode})</span>
              <span>-${(Number(order.financials.affiliateDiscountAmount)).toLocaleString()}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-sm text-black/40">
            <span>Shipping</span>
            <span className="font-bold text-black">
              {order.financials.shippingCost > 0 ? `$${order.financials.shippingCost.toLocaleString()}` : "Complimentary"}
            </span>
          </div>
          <div className="pt-4 border-t-2 border-black flex justify-between items-end">
            <span className="text-[10px] font-bold uppercase tracking-widest">Balance Total</span>
            <span className="text-3xl font-black tracking-tighter">${order.financials.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-32 pt-8 border-t border-black/5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/20">{siteConfig.invoice.footerMessage}</p>
        <p className="text-[9px] text-black/10 mt-4 uppercase font-bold">{siteConfig.company.legalName} • {siteConfig.company.address} • {siteConfig.company.city}</p>
      </div>
    </div>
  );
};

export default InvoiceTemplate;
