"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  ChevronLeft, 
  User, 
  MapPin, 
  CreditCard, 
  Clock,
  Package,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import InvoiceTemplate from "@/components/admin/InvoiceTemplate";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newNote, setNewNote] = useState("");

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      const data = await res.json();
      if (data.success) setOrder(data.order);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchOrder();
    });
  }, [fetchOrder]);

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) setOrder(data.order);
    } catch (error) {
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  const addAdminNote = async () => {
    if (!newNote.trim()) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timelineMessage: newNote }),
      });
      const data = await res.json();
      if (data.success) {
        setOrder(data.order);
        setNewNote("");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <AdminPageLayout title="Order Details" breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Orders", href: "/admin/orders" }, { label: "Loading" }]}>
       <div className="p-20 text-center text-[13px] text-gray-500 italic bg-white border border-[#ccd0d4]">Loading order details...</div>
    </AdminPageLayout>
  );

  if (!order) return (
    <AdminPageLayout title="Order Details" breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Orders", href: "/admin/orders" }, { label: "Error" }]}>
       <div className="p-20 text-center text-[13px] text-red-500 font-bold bg-white border border-[#ccd0d4]">Order not found.</div>
    </AdminPageLayout>
  );

  return (
    <AdminPageLayout 
      title={`Order #${order.orderNumber}`} 
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Orders", href: "/admin/orders" }, { label: `Edit Order` }]}
    >
      <InvoiceTemplate order={order} />

      <div className="space-y-6 print:hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Column */}
          <div className="lg:col-span-8 space-y-6">

            {/* Order Data Box */}
            <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-[2px]">
              <div className="px-4 py-3 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center justify-between">
                <h2 className="text-[14px] font-bold text-[#1d2327]">Order Details</h2>
                <span className="text-[11px] text-[#646970]">
                  {order.createdAt ? new Date(order.createdAt).toLocaleString() : "N/A"}
                </span>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Customer */}
                <div className="space-y-3">
                  <h3 className="text-[13px] font-bold flex items-center gap-2 text-gray-700">
                    <User className="w-4 h-4 text-[#8c8f94]" /> General
                  </h3>
                  <div className="text-[13px] space-y-1">
                    <p className="font-bold text-[#1d2327]">{order.shippingAddress?.fullName || "—"}</p>
                    <p className="text-[#2271b1] hover:underline cursor-pointer">{order.customer?.email || "—"}</p>
                    <p className="text-[#646970] pt-2 italic text-[11px]">
                      Purchased as {order.customer?.isGuest ? "Guest" : "Member"}
                    </p>
                  </div>
                  {order.affiliateId && (
                    <div className="pt-4 border-t border-[#ccd0d4] space-y-2">
                      <p className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-[3px] border border-blue-100 inline-block text-[11px] uppercase tracking-wider">
                        Referred Order
                      </p>
                      <div className="text-[13px] space-y-1">
                        <p className="font-bold text-[#1d2327]">{order.affiliateId.name || "—"}</p>
                        <p className="text-[#646970] text-[12px]">Code: <span className="font-mono font-bold text-black">{order.affiliateId.referralCode || order.affiliateReferralCode}</span></p>
                        <p className="text-[11px] text-[#8c8f94] font-mono">
                          ID: {order.affiliateId.affiliateId || "—"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Shipping */}
                <div className="space-y-3">
                  <h3 className="text-[13px] font-bold flex items-center gap-2 text-gray-700">
                    <MapPin className="w-4 h-4 text-[#8c8f94]" /> Shipping
                  </h3>
                  <div className="text-[13px] space-y-1 leading-relaxed">
                    <p>{order.shippingAddress?.street || "—"}</p>
                    <p>
                      {order.shippingAddress?.city || "—"},{" "}
                      {order.shippingAddress?.zip || "—"}
                    </p>
                    <p>{order.shippingAddress?.country || "—"}</p>
                    <p className="pt-2 text-[#2271b1] font-medium">
                      {order.shippingAddress?.phone || "No phone provided"}
                    </p>
                  </div>
                </div>

                {/* Payment */}
                <div className="space-y-3">
                  <h3 className="text-[13px] font-bold flex items-center gap-2 text-gray-700">
                    <CreditCard className="w-4 h-4 text-[#8c8f94]" /> Payment
                  </h3>
                  <div className="text-[13px] space-y-1">
                    <p className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 inline-block text-[11px] uppercase tracking-wider">
                      {order.payment?.status || "Pending"}
                    </p>
                    <p className="text-[#646970] mt-1">
                      Method: {order.payment?.method || "Cash on Delivery"}
                    </p>
                    <p className="text-[10px] text-[#8c8f94] font-mono break-all pt-2">
                      ID: {order._id}
                    </p>
                  </div>
                </div>

              </div>

              {/* Customer Note */}
              {order.customerNote && (
                <div className="mx-6 mb-6 p-4 bg-[#fcf3d7] border border-[#ffeeba] text-[13px] text-[#856404] italic rounded-[2px]">
                  <strong>Customer Note:</strong> &ldquo;{order.customerNote}&rdquo;
                </div>
              )}
            </div>

            {/* Order Items Box */}
            <div className="bg-white border border-[#ccd0d4] shadow-sm overflow-hidden rounded-[2px]">
              <div className="px-4 py-3 border-b border-[#ccd0d4] bg-[#f6f7f7]">
                <h2 className="text-[14px] font-bold text-[#1d2327]">Items to Fulfill</h2>
              </div>
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#fcfcfc] border-b border-[#ccd0d4]">
                    <th className="px-6 py-3 font-bold text-[#646970]">Product</th>
                    <th className="px-6 py-3 font-bold text-[#646970]">Cost</th>
                    <th className="px-6 py-3 font-bold text-[#646970]">Qty</th>
                    <th className="px-6 py-3 font-bold text-[#646970] text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f1]">
                  {(order.items || []).map((item, i) => (
                    <tr key={i} className="hover:bg-[#f6f7f7] transition-colors">
                      <td className="px-6 py-4 flex gap-4 items-start">
                        <div className="w-12 h-14 bg-gray-50 border border-[#ccd0d4] rounded overflow-hidden shrink-0">
                          {item.image && (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-[#2271b1] font-bold hover:underline cursor-pointer">{item.name}</p>
                          <div className="flex flex-col gap-1">
                            {item.selectedVariant?.options &&
                              Object.entries(item.selectedVariant.options).map(([key, val]) => (
                                <p key={key} className="text-[11px] text-[#646970]">
                                  <span className="font-bold text-[#2c3338]">{key}:</span> {val}
                                </p>
                              ))}
                            <p className="text-[11px] text-gray-400 font-mono">
                              SKU: {item.sku || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        ${(item.priceAtPurchase || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">× {item.quantity || 1}</td>
                      <td className="px-6 py-4 text-right font-bold text-[#1d2327]">
                        ${((item.priceAtPurchase || 0) * (item.quantity || 1)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Financial Summary */}
              <div className="p-6 bg-gray-50/50 border-t border-[#ccd0d4] flex flex-col items-end space-y-2">
                <div className="flex justify-between w-56 text-[13px]">
                  <span className="text-[#646970]">Subtotal:</span>
                  <span className="font-bold text-[#1d2327]">
                    ${(order.financials?.subtotal || 0).toLocaleString()}
                  </span>
                </div>
                {order.financials?.discountTotal && Number(order.financials.discountTotal) > 0 ? (
                  <div className="flex justify-between w-56 text-[13px]">
                    <span className="text-[#646970]">Promo Discount:</span>
                    <span className="text-green-700 font-medium">
                      -${(Number(order.financials.discountTotal)).toLocaleString()}
                    </span>
                  </div>
                ) : null}
                {order.financials?.affiliateDiscountAmount && Number(order.financials.affiliateDiscountAmount) > 0 ? (
                  <div className="flex justify-between w-56 text-[13px]">
                    <span className="text-[#646970] flex items-center gap-1">
                      Referral Discount
                      {order.financials.affiliateDiscountType === 'Percentage' && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1 py-0.5 rounded">
                          {order.financials.affiliateDiscountValue}%
                        </span>
                      )}
                    </span>
                    <span className="text-emerald-700 font-medium">
                      -${(Number(order.financials.affiliateDiscountAmount)).toFixed(2)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between w-56 text-[13px]">
                  <span className="text-[#646970]">Shipping:</span>
                  <span className="text-green-700 font-medium">
                    {order.financials?.shippingCost > 0
                      ? `$${order.financials.shippingCost.toLocaleString()}`
                      : 'Free'}
                  </span>
                </div>
                {order.financials?.tax > 0 && (
                  <div className="flex justify-between w-56 text-[13px]">
                    <span className="text-[#646970]">Tax:</span>
                    <span className="font-medium text-[#1d2327]">${order.financials.tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between w-56 text-[16px] font-bold border-t border-[#ccd0d4] pt-2 mt-2 text-[#1d2327]">
                  <span>Total:</span>
                  <span>${(order.financials?.total || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-4 space-y-6">

            {/* Status Box */}
            <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-[2px]">
              <div className="px-4 py-3 border-b border-[#ccd0d4] bg-[#f6f7f7]">
                <h2 className="text-[14px] font-bold text-[#1d2327]">Order Status</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Status</label>
                  <select
                    className="w-full border border-[#8c8f94] rounded-[3px] px-2 py-1.5 text-[13px] outline-none bg-white focus:border-[#2271b1]"
                    value={order.status || "Pending"}
                    onChange={(e) => updateStatus(e.target.value)}
                    disabled={updating}
                  >
                    {[
                      "Pending", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Refunded",
                    ].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#646970]">
                  <span>
                    Created: {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A"}
                  </span>
                  <button
                    onClick={() => updateStatus(order.status)}
                    className="bg-[#2271b1] text-white px-4 py-1.5 rounded-[3px] font-bold hover:bg-[#135e96] transition-colors shadow-sm"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>

            {/* Affiliate Attribution */}
            {order.affiliateReferralCode && (
              <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-[2px]">
                <div className="px-4 py-3 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#2271b1]" />
                  <h2 className="text-[14px] font-bold text-[#1d2327]">Affiliate Attribution</h2>
                </div>
                <div className="p-4 space-y-3 text-[13px]">
                  <div className="flex justify-between items-center">
                    <span className="text-[#646970] font-medium">Referral Code</span>
                    <span className="font-mono font-bold text-[#1d2327] bg-gray-100 px-2 py-0.5 rounded text-[12px]">
                      {order.affiliateReferralCode}
                    </span>
                  </div>
                  {order.financials?.affiliateDiscountType && order.financials.affiliateDiscountType !== 'None' && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#646970] font-medium">Customer Discount</span>
                      <span className="text-emerald-700 font-bold">
                        {order.financials.affiliateDiscountType === 'Percentage'
                          ? `${order.financials.affiliateDiscountValue}%`
                          : `$${order.financials.affiliateDiscountValue}`}
                        {' '}off
                        {order.financials.affiliateDiscountAmount > 0 && (
                          <span className="ml-1 text-emerald-600 font-normal text-[11px]">
                            (saved ${Number(order.financials.affiliateDiscountAmount).toFixed(2)})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 pt-3 border-t border-[#ccd0d4]">
                    <p className="text-[11px] text-[#646970] italic">
                      Commission calculation uses original subtotal (${(order.financials?.subtotal || 0).toLocaleString()}) before discounts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-[2px]">
              <div className="px-4 py-3 border-b border-[#ccd0d4] bg-[#f6f7f7]">
                <h2 className="text-[14px] font-bold text-[#1d2327]">Order Notes</h2>
              </div>
              <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                {(order.timeline || []).slice().reverse().map((event, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-[3px] text-[12px] leading-relaxed border-l-[3px] ${
                      event.source === "Admin"
                        ? "bg-blue-50 border-blue-600 text-blue-900"
                        : "bg-gray-50 border-gray-400 text-gray-800"
                    }`}
                  >
                    <p className="font-bold mb-1 uppercase text-[10px] tracking-wider">{event.status}</p>
                    <p className="mb-2">{event.message}</p>
                    <p className="text-[10px] opacity-60 italic">
                      {event.timestamp ? new Date(event.timestamp).toLocaleString() : "N/A"} by {event.source}
                    </p>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-[#ccd0d4] bg-[#fcfcfc]">
                <textarea
                  placeholder="Add an internal note..."
                  className="w-full border border-[#ccd0d4] rounded-[3px] p-2 text-[12px] outline-none focus:border-[#2271b1] min-h-[80px] bg-white"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <button
                  onClick={addAdminNote}
                  disabled={updating || !newNote.trim()}
                  className="mt-2 w-full bg-white border border-[#ccd0d4] text-[#2c3338] py-1.5 rounded-[3px] text-[12px] font-bold hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Add Note
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
