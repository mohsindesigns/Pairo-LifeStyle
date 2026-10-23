"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, MapPin, ExternalLink, Copy, Send, FileText } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import InvoiceTemplate from "@/components/admin/InvoiceTemplate";
import { Page, PageHeader, Postbox, Notice, StatusPill, formatMoney } from "@/components/admin/ui";
import { can } from "@/lib/rbac";
import { formatCurrency } from "@/lib/currency";
import { usePopup } from "@/context/PopupContext";
import { isPayableByLink } from "@/lib/customOrderConstants";
import RequirePermission from "@/components/admin/RequirePermission";
import SizeConfirmationPanel from "@/components/admin/SizeConfirmationPanel";

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { showConfirm } = usePopup();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [savingAmount, setSavingAmount] = useState(false);
  const [convertingToCard, setConvertingToCard] = useState(false);
  const [exportingVendorPdf, setExportingVendorPdf] = useState(false);
  const [trashBusy, setTrashBusy] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      const data = await res.json();
      if (data.success) {
        setOrder(data.order);
        setSelectedStatus(data.order.status || "Pending");
      }
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
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) setOrder(data.order);
      else toast.error(data.error || "Couldn't update the order status.");
    } catch (error) {
      console.error(error);
      toast.error("Couldn't update the order status.");
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
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setOrder(data.order);
        setNewNote("");
        toast.success("Note added.");
      } else {
        toast.error(data.error || "Couldn't add the note.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Couldn't add the note.");
    } finally {
      setUpdating(false);
    }
  };

  const remainingRefundable = order
    ? Math.max(0, (order.financials?.total || 0) - (order.payment?.refundedAmount || 0))
    : 0;
  const currencyCode = order?.financials?.currency || 'USD';
  const canRefund = can(session?.user, "orders.refund");
  const canShowRefundButton =
    order?.payment?.provider === 'stripe' &&
    (order.payment?.status === 'Paid' || order.payment?.status === 'Partially Refunded') &&
    remainingRefundable > 0 &&
    canRefund;

  const openRefundForm = () => {
    setRefundAmount(remainingRefundable.toFixed(2));
    setRefundError("");
    setShowRefundForm(true);
  };

  const cancelRefundForm = () => {
    setShowRefundForm(false);
    setRefundError("");
  };

  const submitRefund = async () => {
    const amountNum = Number(refundAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setRefundError("Enter a valid refund amount.");
      return;
    }
    setRefunding(true);
    setRefundError("");
    try {
      const res = await fetch(`/api/admin/orders/${id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRefundError(data.error || "Refund failed.");
        return;
      }
      setOrder(data.order);
      setShowRefundForm(false);
      toast.success(`Refund of ${formatCurrency(amountNum, currencyCode)} issued.`);
    } catch (error) {
      console.error(error);
      setRefundError("Refund failed. Please try again.");
    } finally {
      setRefunding(false);
    }
  };

  const startEditAmount = () => {
    setAmountInput(order?.financials?.total ? String(order.financials.total) : "");
    setEditingAmount(true);
  };

  const saveAmount = async () => {
    const amt = Number(amountInput);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSavingAmount(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/amount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update amount");
      setOrder(data.order);
      setEditingAmount(false);
      toast.success("Final amount updated");
    } catch (error) {
      toast.error(error.message || "Failed to update amount");
    } finally {
      setSavingAmount(false);
    }
  };

  const convertToCard = async () => {
    const confirmed = await showConfirm(
      "This switches the order from Cash on Delivery to Card, generates a Stripe payment link, and emails the customer an invoice with a Pay Now button.",
      "Update to Card Payment?"
    );
    if (!confirmed) return;

    setConvertingToCard(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/convert-to-card`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update payment method");
      setOrder(data.order);
      toast.success("Order updated to Card — invoice with payment link sent");
    } catch (error) {
      toast.error(error.message || "Failed to update payment method");
    } finally {
      setConvertingToCard(false);
    }
  };

  const generatePaymentLink = async (regenerate = false) => {
    setGeneratingLink(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate payment link");
      setOrder(data.order);
      toast.success("Payment link generated");
    } catch (error) {
      toast.error(error.message || "Failed to generate payment link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const sendPaymentLinkToCustomer = async () => {
    setSendingLink(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send payment link");
      setOrder(data.order);
      toast.success("Payment link emailed to customer");
    } catch (error) {
      toast.error(error.message || "Failed to send payment link");
    } finally {
      setSendingLink(false);
    }
  };

  const copyPaymentLink = () => {
    if (!order?.paymentLink?.url) return;
    navigator.clipboard.writeText(order.paymentLink.url);
    toast.success("Link copied to clipboard");
  };

  const sendInvoice = async () => {
    setSendingInvoice(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/send-invoice`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invoice");
      setOrder(data.order);
      toast.success("Invoice emailed to customer");
    } catch (error) {
      toast.error(error.message || "Failed to send invoice");
    } finally {
      setSendingInvoice(false);
    }
  };

  const exportVendorPdf = async () => {
    setExportingVendorPdf(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/vendor-pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate PDF");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `order-${order?.orderNumber || id}-vendor.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message || "Failed to generate vendor PDF");
    } finally {
      setExportingVendorPdf(false);
    }
  };

  const getNextStatusInfo = (status) => {
    switch (status) {
      case 'Pending':
        return { nextStatus: 'Confirmed', label: 'Confirm Order' };
      case 'Confirmed':
        return { nextStatus: 'Processing', label: 'Start Processing' };
      case 'Processing':
        return { nextStatus: 'Packed', label: 'Mark as Packed' };
      case 'Packed':
        return { nextStatus: 'Shipped', label: 'Ship Order' };
      case 'Shipped':
        return { nextStatus: 'Out for Delivery', label: 'Mark Out for Delivery' };
      case 'Out for Delivery':
        return { nextStatus: 'Delivered', label: 'Mark as Delivered' };
      default:
        return null;
    }
  };

  const renderProgressButton = () => {
    const info = getNextStatusInfo(order?.status);
    if (!info) {
      if (order?.status === 'Delivered') {
        return <StatusPill status="Delivered" />;
      }
      return null;
    }

    return (
      <button
        type="button"
        onClick={() => updateStatus(info.nextStatus)}
        disabled={updating}
        className="wp-btn wp-btn-primary"
      >
        {updating ? "Updating..." : info.label}
      </button>
    );
  };

  // "Process Refund" on a Cancelled order. A paid Stripe order goes through the
  // refund endpoint (full remaining balance, same server-side checks as the Refund
  // form); that endpoint marks the order Refunded once fully refunded. Anything
  // else (unpaid / non-Stripe / already fully refunded) only changes the status.
  const processCancelledRefund = async () => {
    const stripeRefundable =
      order?.payment?.provider === 'stripe' &&
      !!order.payment?.stripePaymentIntentId &&
      (order.payment?.status === 'Paid' || order.payment?.status === 'Partially Refunded') &&
      remainingRefundable > 0;

    if (!stripeRefundable) {
      const ok = await showConfirm(
        `No payment will be refunded — this order has no captured Stripe payment left to refund. The order status will just be set to Refunded.`,
        "Mark order as Refunded?",
        { confirmText: "Mark as Refunded" }
      );
      if (ok) updateStatus('Refunded');
      return;
    }

    if (!canRefund) {
      toast.error("You don't have permission to issue refunds.");
      return;
    }

    const amountText = formatMoney(remainingRefundable, currencyCode);
    const ok = await showConfirm(
      `${amountText} will be refunded to the customer via Stripe, and the order will be marked Refunded. This cannot be undone.`,
      `Refund ${amountText}?`,
      { confirmText: `Refund ${amountText}`, danger: true }
    );
    if (!ok) return;

    setUpdating(true);
    try {
      // No amount sent: the server refunds the full remaining refundable balance.
      const res = await fetch(`/api/admin/orders/${id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.error || "Refund failed.");
        return;
      }
      setOrder(data.order);
      toast.success(`Refund of ${amountText} issued via Stripe.`);
    } catch (err) {
      console.error(err);
      toast.error("Refund failed. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const renderCancelRefundButton = () => {
    if (!order) return null;
    if (order.status === 'Refunded') {
      return <StatusPill status="Refunded" />;
    }

    if (order.status === 'Cancelled') {
      return (
        <button
          type="button"
          onClick={processCancelledRefund}
          disabled={updating}
          className="wp-btn"
        >
          {updating ? "Updating..." : "Process Refund"}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={async () => {
          const ok = await showConfirm("Are you sure you want to cancel this order?");
          if (ok) {
            updateStatus('Cancelled');
          }
        }}
        disabled={updating}
        className="wp-btn"
        style={{ borderColor: "#b32d2e", color: "#b32d2e" }}
      >
        {updating ? "Updating..." : "Cancel Order"}
      </button>
    );
  };

  const readError = async (res, fallback) => {
    const data = await res.json().catch(() => ({}));
    return data.error || fallback;
  };

  // Server-side copy (POST /api/admin/orders/[id]/duplicate): a Pending draft at the
  // original prices — no stock change, no emails, no commissions. Opens the copy.
  const duplicateThisOrder = async () => {
    setTrashBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${order._id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Failed to duplicate order."));
      const data = await res.json();
      toast.success(`Order #${order.orderNumber} duplicated as #${data.order.orderNumber} (Pending draft).`);
      router.push(`/admin/orders/${data.order._id}`);
    } catch (err) {
      toast.error(err.message || "Failed to duplicate order.");
    } finally {
      setTrashBusy(false);
    }
  };

  const moveToTrash = async () => {
    setTrashBusy(true);
    try {
      const res = await fetch(`/api/admin/orders?id=${order._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Failed to move order to trash."));
      toast.success(`Order #${order.orderNumber} moved to the Trash.`);
      router.push("/admin/orders");
    } catch (err) {
      toast.error(err.message || "Failed to move order to trash.");
      setTrashBusy(false);
    }
  };

  const restoreFromTrash = async () => {
    setTrashBusy(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order._id, isDeleted: false }),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to restore order."));
      setOrder((prev) => ({ ...prev, isDeleted: false, deletedAt: null }));
      toast.success(`Order #${order.orderNumber} restored.`);
    } catch (err) {
      toast.error(err.message || "Failed to restore order.");
    } finally {
      setTrashBusy(false);
    }
  };

  const deletePermanently = async () => {
    const ok = await showConfirm(
      `Order #${order.orderNumber} will be deleted permanently. This cannot be undone.`,
      "Delete permanently?",
      { confirmText: "Delete Permanently", danger: true }
    );
    if (!ok) return;
    setTrashBusy(true);
    try {
      const res = await fetch(`/api/admin/orders?id=${order._id}&permanent=true`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Failed to delete order."));
      toast.success("Order deleted permanently.");
      router.push("/admin/orders");
    } catch (err) {
      toast.error(err.message || "Failed to delete order.");
      setTrashBusy(false);
    }
  };

  const canTrash = ["orders.update", "orders.edit", "orders.delete"].some((k) => can(session?.user, k));
  const linkBtn = { background: "none", border: 0, padding: 0, cursor: "pointer", fontSize: 13, minHeight: 36, display: "inline-flex", alignItems: "center" };

  const backLink = (
    <Link href="/admin/orders" className="wp-btn">
      <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back to orders
    </Link>
  );

  if (loading) return (
    <Page>
      <PageHeader title="Edit order" actions={backLink} />
      <Postbox>
        <p className="wp-muted" style={{ margin: 0 }}>Loading order details...</p>
      </Postbox>
    </Page>
  );

  if (!order) return (
    <Page>
      <PageHeader title="Edit order" actions={backLink} />
      <Notice type="error">Order not found.</Notice>
    </Page>
  );

  const PAYMENT_CLASS = {
    Paid: "wp-st-paid",
    Pending: "wp-st-unpaid",
    Failed: "wp-st-failed",
    Refunded: "wp-st-refunded",
    "Partially Refunded": "wp-st-refunded",
  };

  const totalRow = (label, value, opts = {}) => (
    <div className="wp-kv" style={opts.strong ? { borderTop: "1px solid #dcdcde", marginTop: 4, paddingTop: 10 } : undefined}>
      <span className={`wp-kv-k ${opts.strong ? "wp-strong" : "wp-muted"}`}>{label}</span>
      <span className="wp-kv-v" style={{ fontSize: opts.strong ? 15 : undefined, color: opts.color }}>{value}</span>
    </div>
  );

  return (
    <RequirePermission permission="orders.view">
    <Page>
      <PageHeader title="Edit order" actions={backLink} />

      {order.isDeleted && (
        <div className="wp-notice wp-notice-warning print:hidden" role="status">
          <p style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px" }}>
            <span>This order is in the Trash. Restore it to change its status.</span>
            <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="wp-btn" disabled={trashBusy} onClick={restoreFromTrash}>Restore</button>
              <button type="button" className="wp-btn" style={{ borderColor: "#b32d2e", color: "#b32d2e" }} disabled={trashBusy} onClick={deletePermanently}>
                Delete Permanently
              </button>
            </span>
          </p>
        </div>
      )}

      <InvoiceTemplate order={order} />

      <div className="wp-cols print:hidden">

        {/* ===================== MAIN COLUMN ===================== */}
        <div className="wp-col-main">

          {/* Order data */}
          <section className="wp-postbox" aria-labelledby="order-data-title">
            <div style={{ padding: "16px 16px 0" }}>
              <h2 id="order-data-title" style={{ margin: 0, fontSize: 20, fontWeight: 400, color: "#1d2327", lineHeight: 1.3 }}>
                Order #{order.orderNumber} details
              </h2>
              <p className="wp-muted" style={{ margin: "4px 0 0" }}>
                Payment via {order.payment?.method || "Cash on Delivery"}.
                {order.payment?.paidAt && <> Paid on {new Date(order.payment.paidAt).toLocaleString()}.</>}
                {order.customer?.ipAddress && <> Customer IP: <span className="font-mono">{order.customer.ipAddress}</span></>}
              </p>
            </div>

            <div className="wp-order-cols">

              {/* General */}
              <div style={{ minWidth: 0 }}>
                <h3>General</h3>
                <div className="wp-field">
                  <div className="wp-label">Date created</div>
                  <div>{order.createdAt ? new Date(order.createdAt).toLocaleString() : "N/A"}</div>
                </div>
                <div className="wp-field">
                  <div className="wp-label">Status</div>
                  <StatusPill status={order.status} />
                </div>
                <div className="wp-field">
                  <div className="wp-label">Customer</div>
                  <div className="wp-strong">{order.shippingAddress?.fullName || "—"}</div>
                  {order.customer?.email ? (
                    <a href={`mailto:${order.customer.email}`} className="wp-link" style={{ wordBreak: "break-all" }}>{order.customer.email}</a>
                  ) : (
                    <div>—</div>
                  )}
                  <p className="wp-desc">Purchased as {order.customer?.isGuest ? "Guest" : "Member"}</p>
                </div>
                {order.affiliateId && (
                  <div className="wp-field" style={{ borderTop: "1px solid #f0f0f1", paddingTop: 10 }}>
                    <div className="wp-label">Referred order</div>
                    <div className="wp-strong">{order.affiliateId.name || "—"}</div>
                    <div className="wp-muted">Code: <span className="font-mono wp-strong">{order.affiliateId.referralCode || order.affiliateReferralCode}</span></div>
                    <div className="wp-muted wp-small font-mono">ID: {order.affiliateId.affiliateId || "—"}</div>
                  </div>
                )}
              </div>

              {/* Shipping */}
              <div style={{ minWidth: 0 }}>
                <h3>Shipping</h3>
                <address className="wp-addr">
                  {order.shippingAddress?.fullName && <>{order.shippingAddress.fullName}<br /></>}
                  {order.shippingAddress?.street || "—"}<br />
                  {order.shippingAddress?.city || "—"}
                  {order.shippingAddress?.county ? `, ${order.shippingAddress.county}` : ""}
                  {order.shippingAddress?.state ? `, ${order.shippingAddress.state}` : ""}
                  {order.shippingAddress?.zip ? ` ${order.shippingAddress.zip}` : ""}<br />
                  {order.shippingAddress?.country || "—"}
                </address>
                <div className="wp-field" style={{ marginTop: 10 }}>
                  <div className="wp-label">Phone</div>
                  {order.shippingAddress?.phone ? (
                    <a href={`tel:${order.shippingAddress.phone}`} className="wp-link">{order.shippingAddress.phone}</a>
                  ) : (
                    <span className="wp-muted">No phone provided</span>
                  )}
                </div>
                {order.customerNote && (
                  <div className="wp-field">
                    <div className="wp-label">Customer provided note</div>
                    <p style={{ margin: 0, wordBreak: "break-word" }}>&ldquo;{order.customerNote}&rdquo;</p>
                  </div>
                )}
              </div>

              {/* Payment */}
              <div style={{ minWidth: 0 }}>
                <h3>Payment</h3>
                <div className="wp-field">
                  <span className={`wp-pill ${PAYMENT_CLASS[order.payment?.status] || "wp-st-unpaid"}`}>
                    {order.payment?.status || "Pending"}
                  </span>
                </div>
                <div className="wp-kv">
                  <span className="wp-kv-k wp-muted">Method</span>
                  <span className="wp-kv-v">{order.payment?.method || "Cash on Delivery"}</span>
                </div>
                {order.payment?.paidAt && (
                  <div className="wp-kv">
                    <span className="wp-kv-k wp-muted">Paid</span>
                    <span className="wp-kv-v">{new Date(order.payment.paidAt).toLocaleString()}</span>
                  </div>
                )}
                {order.payment?.refundedAmount > 0 && (
                  <div className="wp-kv">
                    <span className="wp-kv-k wp-muted">Refunded</span>
                    <span className="wp-kv-v">{formatCurrency(order.payment.refundedAmount, currencyCode)}</span>
                  </div>
                )}
                {order.payment?.method === "Cash on Delivery" && order.payment?.status !== "Paid" && (
                  <button
                    type="button"
                    onClick={convertToCard}
                    disabled={convertingToCard}
                    className="wp-btn"
                    style={{ marginTop: 10, whiteSpace: "normal", textAlign: "left" }}
                  >
                    <Send className="w-4 h-4" aria-hidden="true" /> {convertingToCard ? "Updating..." : "Update to Card & Send Invoice"}
                  </button>
                )}
                {order.payment?.provider === 'stripe' && order.payment?.stripePaymentIntentId && (
                  <p style={{ margin: "10px 0 0" }}>
                    <a
                      href={`https://dashboard.stripe.com/payments/${order.payment.stripePaymentIntentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wp-link"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      View in Stripe <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </p>
                )}
                <p className="wp-muted wp-small font-mono" style={{ margin: "10px 0 0", wordBreak: "break-all" }}>
                  ID: {order._id}
                </p>
              </div>

            </div>
          </section>

          {/* Custom Jacket Specifications */}
          {order.customJacketInquiryId && order.customJacketSnapshot && (
            <Postbox title="Custom jacket specifications">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px 16px" }}>
                {[
                  ["Jacket Type", order.customJacketSnapshot.jacketType],
                  ["Gender", order.customJacketSnapshot.gender],
                  ["Leather", order.customJacketSnapshot.preferredLeather],
                  ["Color", order.customJacketSnapshot.preferredColor],
                  ["Size", order.customJacketSnapshot.size],
                  ["Budget", order.customJacketSnapshot.budget],
                  ["Deadline", order.customJacketSnapshot.deadline],
                ].map(([label, val]) => val ? (
                  <div key={label} style={{ minWidth: 0 }}>
                    <div className="wp-muted">{label}</div>
                    <div className="wp-strong" style={{ wordBreak: "break-word" }}>{val}</div>
                  </div>
                ) : null)}
              </div>
              {order.customJacketSnapshot.additionalNotes && (
                <div style={{ marginTop: 16 }}>
                  <div className="wp-label">Additional notes</div>
                  <div className="wp-note-body" style={{ wordBreak: "break-word" }}>
                    {order.customJacketSnapshot.additionalNotes}
                  </div>
                </div>
              )}
              {order.customJacketSnapshot.referenceImages?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="wp-label">
                    Reference images ({order.customJacketSnapshot.referenceImages.length})
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }}>
                    {order.customJacketSnapshot.referenceImages.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", aspectRatio: "1 / 1", overflow: "hidden", border: "1px solid #dcdcde" }}>
                        <img src={url} alt={`Reference ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Postbox>
          )}

          {/* Items */}
          <section className="wp-postbox" aria-labelledby="order-items-title">
            <div className="wp-postbox-head">
              <h2 id="order-items-title">Items</h2>
            </div>
            <div style={{ overflowX: "auto" }}>
            <table className="wp-list-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="wp-num wp-hide-sm" style={{ textAlign: "right" }}>Cost</th>
                  <th scope="col" className="wp-num wp-hide-sm" style={{ textAlign: "right" }}>Qty</th>
                  <th scope="col" className="wp-num" style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item, i) => (
                  <tr key={i}>
                    <td style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div className="wp-thumb">
                          {item.image && (
                            <img src={item.image} alt={item.name} />
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1, wordBreak: "break-word" }}>
                          <div className="wp-strong">{item.name}</div>
                          <div className="wp-muted wp-small">SKU: <span className="font-mono">{item.sku || "—"}</span></div>
                          {item.selectedVariant?.options &&
                            Object.entries(item.selectedVariant.options).map(([key, val]) => (
                              <div key={key} className="wp-small">
                                <span className="wp-strong">{key}:</span> {val}
                              </div>
                            ))}
                          <div className="wp-mobile-meta">
                            {formatMoney(item.priceAtPurchase, currencyCode)} × {item.quantity || 1}
                          </div>

                          {/* Made to Measure */}
                          {item.madeToMeasure?.enabled && (
                            <div style={{ marginTop: 8 }}>
                              <span className="wp-pill wp-pill-sm wp-st-confirmed">Made to measure</span>
                              {Object.keys(item.madeToMeasure.measurements || {}).length > 0 && (
                                <details style={{ marginTop: 6 }}>
                                  <summary className="wp-link" style={{ cursor: "pointer" }}>View measurements ({item.madeToMeasure.unit})</summary>
                                  <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "2px 16px" }}>
                                    {Object.entries(item.madeToMeasure.measurements).map(([k, v]) => v ? (
                                      <div key={k} className="wp-small">
                                        <span className="wp-muted capitalize">{k.replace(/([A-Z])/g, ' $1')}: </span>
                                        {v} {item.madeToMeasure.unit}
                                      </div>
                                    ) : null)}
                                  </div>
                                  {item.madeToMeasure.notes && (
                                    <p className="wp-desc">Note: {item.madeToMeasure.notes}</p>
                                  )}
                                </details>
                              )}
                            </div>
                          )}

                          {/* Customize Product options */}
                          {item.customization?.enabled && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f0f0f1" }}>
                              <span className="wp-pill wp-pill-sm wp-st-packed">Custom design selections</span>
                              <div style={{ marginTop: 6 }} className="wp-small">
                                {item.customization.leatherColor && item.customization.leatherColor !== "None" && (
                                  <div><span className="wp-muted">Leather Color:</span> {item.customization.leatherColor} {item.customization.leatherColorNote && `(${item.customization.leatherColorNote})`}</div>
                                )}
                                {item.customization.leatherType && item.customization.leatherType !== "None" && (
                                  <div><span className="wp-muted">Leather Type:</span> {item.customization.leatherType} {item.customization.leatherTypeNote && `(${item.customization.leatherTypeNote})`}</div>
                                )}
                                {item.customization.innerLining && item.customization.innerLining !== "None" && (
                                  <div><span className="wp-muted">Inner Lining:</span> {item.customization.innerLining} {item.customization.innerLiningNote && `(${item.customization.innerLiningNote})`}</div>
                                )}
                                {item.customization.hardwareColor && item.customization.hardwareColor !== "None" && (
                                  <div><span className="wp-muted">Hardware:</span> {item.customization.hardwareColor} {item.customization.hardwareColorNote && `(${item.customization.hardwareColorNote})`}</div>
                                )}
                                {item.customization.fur?.type && item.customization.fur.type !== "None" && (
                                  <div>
                                    <span className="wp-muted">Fur:</span> {item.customization.fur.type}
                                    {item.customization.fur.color && ` · ${item.customization.fur.color}`}
                                    {item.customization.fur.density && ` · ${item.customization.fur.density}`}
                                    {item.customization.fur.placement?.length > 0 && ` · ${item.customization.fur.placement.join(", ")}`}
                                    {item.customization.fur.removable !== null && item.customization.fur.removable !== undefined && ` · ${item.customization.fur.removable ? "Removable" : "Fixed"}`}
                                  </div>
                                )}
                                {item.customization.artwork && Object.values(item.customization.artwork).some(Boolean) && (
                                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #f0f0f1" }}>
                                    <div className="wp-strong">Uploaded artwork</div>
                                    {Object.entries(item.customization.artwork).map(([placement, art]) => {
                                      if (!art || !art.url) return null;
                                      return (
                                        <div key={placement} style={{ display: "flex", flexWrap: "wrap", gap: "0 6px" }}>
                                          <span className="wp-muted capitalize">{placement.replace(/([A-Z])/g, ' $1')}:</span>
                                          <a href={art.url} target="_blank" rel="noopener noreferrer" className="wp-link" style={{ wordBreak: "break-all" }}>
                                            {art.name || "Download File"}
                                          </a>
                                          {placement === "other" && art.note && <span className="wp-muted">({art.note})</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Corporate Gifting selections */}
                          {item.corporateGifting?.enabled && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f0f0f1" }}>
                              <span className="wp-pill wp-pill-sm wp-st-processing">
                                Corporate gifting: {(item.corporateGifting.selections || []).length} items
                              </span>
                              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }} className="wp-small">
                                {(item.corporateGifting.selections || []).map((sel, selIdx) => (
                                  <div key={sel.itemId || selIdx} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 8px" }}>
                                    {sel.image && (
                                      <img src={sel.image} alt={sel.name} style={{ width: 24, height: 24, objectFit: "cover", border: "1px solid #dcdcde", flex: "none" }} />
                                    )}
                                    <span className="wp-strong">{sel.name}</span>
                                    {sel.priceDelta > 0 && <span className="wp-muted">+{formatMoney(Number(sel.priceDelta), currencyCode)}</span>}
                                    {sel.artwork?.url ? (
                                      <a href={sel.artwork.url} target="_blank" rel="noopener noreferrer" className="wp-link" style={{ wordBreak: "break-all" }}>
                                        {sel.artwork.name || "View logo"}
                                      </a>
                                    ) : (
                                      <span className="wp-muted">No logo uploaded</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="wp-num wp-hide-sm" style={{ whiteSpace: "nowrap" }}>
                      {formatMoney(item.priceAtPurchase, currencyCode)}
                    </td>
                    <td className="wp-num wp-hide-sm" style={{ whiteSpace: "nowrap" }}>× {item.quantity || 1}</td>
                    <td className="wp-num wp-strong" style={{ whiteSpace: "nowrap" }}>
                      {formatMoney((item.priceAtPurchase || 0) * (item.quantity || 1), currencyCode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px", borderTop: "1px solid #dcdcde" }}>
              <div style={{ width: "100%", maxWidth: 300 }}>
                {totalRow("Items subtotal:", formatMoney(order.financials?.subtotal, currencyCode))}
                {order.financials?.discountTotal && Number(order.financials.discountTotal) > 0
                  ? totalRow("Promo discount:", `-${formatMoney(Number(order.financials.discountTotal), currencyCode)}`, { color: "#2f6f1a" })
                  : null}
                {order.financials?.affiliateDiscountAmount && Number(order.financials.affiliateDiscountAmount) > 0
                  ? totalRow(
                      <>
                        Referral discount
                        {order.financials.affiliateDiscountType === 'Percentage' && (
                          <> ({order.financials.affiliateDiscountValue}%)</>
                        )}:
                      </>,
                      `-${formatMoney(Number(order.financials.affiliateDiscountAmount), currencyCode)}`,
                      { color: "#2f6f1a" }
                    )
                  : null}
                {totalRow(
                  "Shipping:",
                  order.financials?.shippingCost > 0
                    ? formatMoney(order.financials.shippingCost, currencyCode)
                    : 'Free'
                )}
                {order.financials?.tax > 0 && totalRow("Tax:", formatMoney(order.financials.tax, currencyCode))}
                {totalRow("Order total:", formatMoney(order.financials?.total, currencyCode), { strong: true })}
              </div>
            </div>

            {/* Refund Action */}
            {canShowRefundButton && (
              <div className="wp-box-foot">
                {!showRefundForm ? (
                  <>
                    <span className="wp-muted">
                      Remaining refundable balance:{" "}
                      <span className="wp-strong">{formatCurrency(remainingRefundable, currencyCode)}</span>
                    </span>
                    <span className="wp-spacer" />
                    <button type="button" onClick={openRefundForm} className="wp-btn">
                      Refund
                    </button>
                  </>
                ) : (
                  <div style={{ width: "100%" }}>
                    <label htmlFor="refund-amount" className="wp-label">
                      Refund amount ({currencyCode})
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <input
                        id="refund-amount"
                        type="number"
                        min="0.01"
                        max={remainingRefundable}
                        step="0.01"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        className="wp-input"
                        style={{ width: 160 }}
                      />
                      <button
                        type="button"
                        onClick={submitRefund}
                        disabled={refunding}
                        className="wp-btn wp-btn-primary"
                      >
                        {refunding ? "Processing..." : "Confirm Refund"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelRefundForm}
                        disabled={refunding}
                        className="wp-btn"
                      >
                        Cancel
                      </button>
                    </div>
                    {refundError && (
                      <p className="wp-desc" role="alert" style={{ color: "#b32d2e" }}>{refundError}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ===================== SIDE COLUMN ===================== */}
        <div className="wp-col-side">

          {/* Order actions */}
          <Postbox
            title="Order actions"
            footer={order.isDeleted ? null : (
              <>
                {renderCancelRefundButton()}
                <span className="wp-spacer" />
                {renderProgressButton()}
              </>
            )}
          >
            <div className="wp-kv">
              <span className="wp-kv-k wp-muted">Current status</span>
              <StatusPill status={order.status} />
            </div>
            <div className="wp-kv">
              <span className="wp-kv-k wp-muted">Created</span>
              <span className="wp-kv-v">
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A"}
                {" "}
                {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
              </span>
            </div>
            {!order.isDeleted && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0 6px", paddingTop: 2, color: "#a7aaad" }}>
                {can(session?.user, "orders.create") && (
                  <>
                    <button type="button" className="wp-link" style={linkBtn} disabled={trashBusy} onClick={duplicateThisOrder}>
                      Duplicate
                    </button>
                    {canTrash && <span aria-hidden="true">|</span>}
                  </>
                )}
                {canTrash && (
                  <button type="button" className="wp-link" style={{ ...linkBtn, color: "#b32d2e" }} disabled={trashBusy} onClick={moveToTrash}>
                    Move to Trash
                  </button>
                )}
              </div>
            )}
          </Postbox>

          {/* Payment & Invoice Actions (Custom Orders only) */}
          {isPayableByLink(order) && (
            <Postbox title="Payment & invoice">
              {/* Final Amount — set by admin after reviewing customization, drives the payment link + invoice */}
              <div className="wp-field" style={{ paddingBottom: 12, borderBottom: "1px solid #f0f0f1" }}>
                <label htmlFor="final-amount" className="wp-label">
                  Final amount (after customization)
                </label>
                {editingAmount ? (
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                    <input
                      id="final-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      autoFocus
                      className="wp-input"
                      style={{ flex: "1 1 120px", minWidth: 0 }}
                    />
                    <button
                      type="button"
                      onClick={saveAmount}
                      disabled={savingAmount}
                      className="wp-btn wp-btn-primary"
                    >
                      {savingAmount ? "..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAmount(false)}
                      disabled={savingAmount}
                      className="wp-btn"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span className="wp-strong" style={{ fontSize: 20 }}>
                      {currencyCode} {(order.financials?.total || 0).toLocaleString()}
                    </span>
                    {order.payment?.status !== "Paid" && (
                      <button type="button" onClick={startEditAmount} className="wp-btn">
                        Edit
                      </button>
                    )}
                  </div>
                )}
                {order.paymentLink?.url && order.payment?.status !== "Paid" && (
                  <div className="wp-notice wp-notice-warning" style={{ margin: "8px 0 0" }}>
                    <p>Changing the amount deactivates the current payment link — you&apos;ll need to generate a new one.</p>
                  </div>
                )}
              </div>

              {order.payment?.status === "Paid" ? (
                <div className="wp-field">
                  <span className="wp-pill wp-st-paid">Payment received</span>
                </div>
              ) : order.paymentLink?.url ? (
                <div className="wp-field">
                  <label htmlFor="payment-link-url" className="wp-label">Payment link</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      id="payment-link-url"
                      readOnly
                      value={order.paymentLink.url}
                      className="wp-input font-mono"
                      style={{ flex: 1, minWidth: 0, background: "#f6f7f7" }}
                    />
                    <button
                      type="button"
                      onClick={copyPaymentLink}
                      title="Copy link"
                      aria-label="Copy payment link"
                      className="wp-btn"
                    >
                      <Copy className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  {order.paymentLink.sentAt && (
                    <p className="wp-desc">
                      Sent {new Date(order.paymentLink.sentAt).toLocaleString()} ({order.paymentLink.sentCount || 1}x)
                    </p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={sendPaymentLinkToCustomer}
                      disabled={sendingLink}
                      className="wp-btn wp-btn-primary"
                    >
                      <Send className="w-4 h-4" aria-hidden="true" /> {sendingLink ? "Sending..." : "Send to Customer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => generatePaymentLink(true)}
                      disabled={generatingLink}
                      title="Regenerate link"
                      className="wp-btn"
                    >
                      {generatingLink ? "..." : "Regenerate"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="wp-field">
                  <button
                    type="button"
                    onClick={() => generatePaymentLink(false)}
                    disabled={generatingLink}
                    className="wp-btn wp-btn-primary"
                  >
                    {generatingLink ? "Generating..." : "Generate Payment Link"}
                  </button>
                </div>
              )}

              <div style={{ borderTop: "1px solid #f0f0f1", paddingTop: 12 }}>
                <button
                  type="button"
                  onClick={sendInvoice}
                  disabled={sendingInvoice}
                  className="wp-btn"
                >
                  <FileText className="w-4 h-4" aria-hidden="true" /> {sendingInvoice ? "Sending..." : "Send Invoice"}
                </button>
                {order.invoice?.sentAt ? (
                  <p className="wp-desc">
                    Last sent {new Date(order.invoice.sentAt).toLocaleString()} ({order.invoice.sentCount || 1}x)
                  </p>
                ) : order.payment?.status !== "Paid" ? (
                  <p className="wp-desc">
                    Includes a Pay Now link{order.paymentLink?.url ? "" : " (generated automatically if none exists yet)"}.
                  </p>
                ) : null}
              </div>
            </Postbox>
          )}

          {/* Vendor-facing production PDF (product image + name + size chart with ordered size highlighted) */}
          {can(session?.user, "orders.view") && (
            <Postbox title="Vendor export">
              <button
                type="button"
                onClick={exportVendorPdf}
                disabled={exportingVendorPdf}
                className="wp-btn"
              >
                <FileText className="w-4 h-4" aria-hidden="true" /> {exportingVendorPdf ? "Generating..." : "Print PDF for Vendor"}
              </button>
              <p className="wp-desc">
                Product photos, names and the ordered size highlighted on each item&apos;s size chart — ready to send to your manufacturing vendor.
              </p>
            </Postbox>
          )}

          {/* Size Confirmation email + customer replies */}
          {can(session?.user, "orders.update") && (
            <SizeConfirmationPanel orderId={id} customerEmail={order.customer?.email} />
          )}

          {/* Affiliate Attribution */}
          {order.affiliateReferralCode && (
            <Postbox title="Affiliate attribution">
              <div className="wp-kv">
                <span className="wp-kv-k wp-muted">Referral code</span>
                <span className="wp-kv-v font-mono">{order.affiliateReferralCode}</span>
              </div>
              {order.financials?.affiliateDiscountType && order.financials.affiliateDiscountType !== 'None' && (
                <div className="wp-kv">
                  <span className="wp-kv-k wp-muted">Customer discount</span>
                  <span className="wp-kv-v" style={{ color: "#2f6f1a" }}>
                    {order.financials.affiliateDiscountType === 'Percentage'
                      ? `${order.financials.affiliateDiscountValue}%`
                      : formatMoney(Number(order.financials.affiliateDiscountValue), currencyCode)}
                    {' '}off
                    {order.financials.affiliateDiscountAmount > 0 && (
                      <span className="wp-small" style={{ fontWeight: 400, marginLeft: 4 }}>
                        (saved {formatMoney(Number(order.financials.affiliateDiscountAmount), currencyCode)})
                      </span>
                    )}
                  </span>
                </div>
              )}
              <p className="wp-desc">
                Commission calculation uses original subtotal ({formatMoney(order.financials?.subtotal, currencyCode)}) before discounts.
              </p>
            </Postbox>
          )}

          {/* Order notes */}
          <Postbox
            title="Order notes"
            footer={
              <div style={{ width: "100%" }}>
                <label htmlFor="order-note" className="wp-label">Add note</label>
                <textarea
                  id="order-note"
                  placeholder="Add an internal note..."
                  className="wp-textarea"
                  rows={3}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={addAdminNote}
                    disabled={updating || !newNote.trim()}
                    className="wp-btn"
                  >
                    Add Note
                  </button>
                </div>
              </div>
            }
          >
            {(order.timeline || []).length === 0 ? (
              <p className="wp-empty" style={{ margin: 0 }}>There are no notes yet.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
                {(order.timeline || []).slice().reverse().map((event, i) => (
                  <li key={i}>
                    <div
                      className={`wp-note-body ${event.source === "Customer" ? "is-customer" : event.source === "Admin" ? "" : "is-system"}`}
                      style={{ wordBreak: "break-word" }}
                    >
                      {event.status && <div className="wp-strong" style={{ marginBottom: 2 }}>{event.status}</div>}
                      {event.message}
                    </div>
                    <div className="wp-note-meta">
                      <span>{event.timestamp ? new Date(event.timestamp).toLocaleString() : "N/A"}</span>
                      <span>by {event.source}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Postbox>

          {/* IP & location */}
          <Postbox title="IP & location">
            <div className="wp-kv">
              <span className="wp-kv-k wp-muted">IP</span>
              <span className="wp-kv-v font-mono" style={{ wordBreak: "break-all" }}>{order.customer?.ipAddress || "—"}</span>
              {order.customer?.ipAddress && order.customer?.ipAddress !== "unknown" && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(order.customer.ipAddress);
                    toast.success("IP copied!");
                  }}
                  title="Copy IP"
                  aria-label="Copy IP address"
                  className="wp-btn"
                  style={{ minHeight: 26, padding: "0 6px" }}
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {order.customer?.ipLocation ? (
              <>
                <div className="wp-kv">
                  <span className="wp-kv-k wp-muted">City</span>
                  <span className="wp-kv-v">{order.customer.ipLocation.city || "—"}</span>
                </div>
                <div className="wp-kv">
                  <span className="wp-kv-k wp-muted">State</span>
                  <span className="wp-kv-v">{order.customer.ipLocation.state || "—"}</span>
                </div>
                <div className="wp-kv">
                  <span className="wp-kv-k wp-muted">County</span>
                  <span className="wp-kv-v">{order.customer.ipLocation.county || "—"}</span>
                </div>
                <div className="wp-kv">
                  <span className="wp-kv-k wp-muted">Country</span>
                  <span className="wp-kv-v">
                    {order.customer.ipLocation.country || "—"}
                    {order.customer.ipLocation.countryCode ? ` (${order.customer.ipLocation.countryCode})` : ""}
                  </span>
                </div>
                {order.customer.ipLocation.postal && (
                  <div className="wp-kv">
                    <span className="wp-kv-k wp-muted">Postal / Zip</span>
                    <span className="wp-kv-v font-mono">{order.customer.ipLocation.postal}</span>
                  </div>
                )}
                {order.customer.ipLocation.isp && (
                  <div className="wp-kv">
                    <span className="wp-kv-k wp-muted">ISP</span>
                    <span className="wp-kv-v" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={order.customer.ipLocation.isp}>
                      {order.customer.ipLocation.isp}
                    </span>
                  </div>
                )}
                {(order.customer.ipLocation.lat != null && order.customer.ipLocation.lon != null) && (
                  <p style={{ margin: "10px 0 0" }}>
                    <a
                      href={order.customer.ipLocation.mapsUrl || `https://www.google.com/maps?q=${order.customer.ipLocation.lat},${order.customer.ipLocation.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wp-link"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <MapPin className="w-4 h-4" aria-hidden="true" />
                      Pinpoint map ({Number(order.customer.ipLocation.lat).toFixed(4)}, {Number(order.customer.ipLocation.lon).toFixed(4)})
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </p>
                )}
              </>
            ) : (
              <p className="wp-desc">
                {order.customer?.ipAddress ? "Location lookup pending or unavailable" : "No IP address captured"}
              </p>
            )}
          </Postbox>

        </div>
      </div>
    </Page>
    </RequirePermission>
  );
}
