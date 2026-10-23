"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";
import { ChevronLeft, ChevronRight, X, ExternalLink, ImageIcon } from "lucide-react";
import Link from "next/link";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

const STATUS_COLORS = {
  New: "wp-st-out",
  Contacted: "wp-st-confirmed",
  "In Progress": "wp-st-packed",
  Converted: "wp-st-shipped",
  Completed: "wp-st-delivered",
  Cancelled: "wp-st-cancelled"
};

const ALL_STATUSES = ["New", "Contacted", "In Progress", "Converted", "Completed", "Cancelled"];
// Statuses an inquiry may not return to once it has been converted to an order.
const PRE_CONVERSION_STATUSES = ["New", "Contacted", "In Progress"];

function DetailModal({ inquiry, onClose, onStatusChange, onConverted }) {
  const [status, setStatus] = useState(inquiry.status);
  const [notes, setNotes] = useState(inquiry.adminNotes || "");
  const [saving, setSaving] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [converting, setConverting] = useState(false);
  const isConverted = !!inquiry.orderId || inquiry.status === "Converted";
  const statusOptions = isConverted
    ? ALL_STATUSES.filter(s => !PRE_CONVERSION_STATUSES.includes(s))
    : ALL_STATUSES;

  const handleConvert = async () => {
    const amount = Number(quoteAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid quote amount");
      return;
    }
    setConverting(true);
    try {
      const res = await fetch(`/api/admin/custom-jacket-inquiries/${inquiry._id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteAmount: amount })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Order #${data.order.orderNumber} created`);
        // Keep the dialog's own status in sync so "Save Changes" doesn't revert it.
        setStatus("Converted");
        onConverted(inquiry._id, data.order);
      } else {
        toast.error(data.error || "Failed to convert inquiry");
      }
    } catch {
      toast.error("Failed to convert inquiry");
    } finally {
      setConverting(false);
    }
  };

  const handleSave = async () => {
    if (isConverted && PRE_CONVERSION_STATUSES.includes(status)) {
      toast.error("A converted inquiry can't be moved back to an earlier status");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/custom-jacket-inquiries/${inquiry._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes: notes })
      });
      if (res.ok) {
        toast.success("Inquiry updated");
        onStatusChange(inquiry._id, status, notes);
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Error saving changes");
    } finally {
      setSaving(false);
    }
  };

  const kvRows = (rows) => rows.map(([label, val]) => val ? (
    <div key={label} className="wp-kv" style={{ alignItems: "flex-start" }}>
      <span className="wp-kv-k wp-muted">{label}</span>
      <span className="wp-kv-v" style={{ textAlign: "right", wordBreak: "break-word", minWidth: 0 }}>{val}</span>
    </div>
  ) : null);

  return (
    <div className="wp-modal-backdrop" onClick={onClose}>
      <div
        className="wp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inquiry-detail-title"
        style={{ maxWidth: 760 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="wp-modal-head" style={{ gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h2 id="inquiry-detail-title" style={{ wordBreak: "break-word" }}>
              {inquiry.firstName} {inquiry.lastName}
            </h2>
            <p className="wp-muted" style={{ margin: "2px 0 0", wordBreak: "break-all" }}>{inquiry.email}</p>
          </div>
          <button type="button" onClick={onClose} className="wp-btn" aria-label="Close" style={{ minWidth: 32, padding: "0 6px", flex: "none" }}>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="wp-modal-body">
          <div className="wp-order-cols" style={{ padding: 0, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 16 }}>
            {/* Personal Info */}
            <div style={{ minWidth: 0 }}>
              <h3>Contact</h3>
              {kvRows([
                ["Phone", inquiry.phone],
                ["Country", inquiry.country],
                ["City", inquiry.city],
                ["Submitted", new Date(inquiry.createdAt).toLocaleString()]
              ])}
            </div>

            {/* Jacket Specs */}
            <div style={{ minWidth: 0 }}>
              <h3>Jacket</h3>
              {kvRows([
                ["Jacket Type", inquiry.jacketType],
                ["Gender", inquiry.gender],
                ["Leather", inquiry.preferredLeather],
                ["Color", inquiry.preferredColor],
                ["Size", inquiry.size],
                ["Budget", inquiry.budget],
                ["Deadline", inquiry.deadline]
              ])}
            </div>
          </div>

          {/* Notes */}
          {inquiry.additionalNotes && (
            <div className="wp-field">
              <div className="wp-label">Additional notes</div>
              <div className="wp-note-body is-customer" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {inquiry.additionalNotes}
              </div>
            </div>
          )}

          {/* Reference Images */}
          {inquiry.referenceImages?.length > 0 && (
            <div className="wp-field">
              <div className="wp-label">
                Reference images ({inquiry.referenceImages.length})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }}>
                {inquiry.referenceImages.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", aspectRatio: "1 / 1", overflow: "hidden", border: "1px solid #dcdcde" }}>
                    <img src={url} alt={`Reference ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Convert to Order */}
          <div className="wp-field" style={{ borderTop: "1px solid #f0f0f1", paddingTop: 12 }}>
            <div className="wp-label">Custom order</div>
            {inquiry.orderId ? (
              <Link
                href={`/admin/orders/${inquiry.orderId}`}
                className="wp-btn"
              >
                View order <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </Link>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <label htmlFor="inquiry-quote-amount" className="sr-only">Quoted price (USD)</label>
                <input
                  id="inquiry-quote-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Quoted price (USD)"
                  value={quoteAmount}
                  onChange={e => setQuoteAmount(e.target.value)}
                  className="wp-input"
                  style={{ width: 200, maxWidth: "100%" }}
                />
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={converting}
                  className="wp-btn"
                >
                  {converting ? "Creating..." : "Convert to Order"}
                </button>
              </div>
            )}
          </div>

          {/* Status + Notes */}
          <div className="wp-field" style={{ borderTop: "1px solid #f0f0f1", paddingTop: 12 }}>
            <label htmlFor="inquiry-status" className="wp-label">Status</label>
            <select
              id="inquiry-status"
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="wp-select wp-full"
            >
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="wp-field" style={{ marginBottom: 0 }}>
            <label htmlFor="inquiry-admin-notes" className="wp-label">Admin notes</label>
            <textarea
              id="inquiry-admin-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes (not visible to customer)..."
              className="wp-textarea wp-full"
            />
          </div>
        </div>

        <div className="wp-modal-foot">
          <button type="button" onClick={onClose} className="wp-btn">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="wp-btn wp-btn-primary">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomJacketInquiriesPage() {
  const { showConfirm } = usePopup();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [counts, setCounts] = useState({});
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/custom-jacket-inquiries?${params}`);
      const data = await res.json();
      if (res.ok) {
        setInquiries(data.items || []);
        setPagination(data.pagination || {});
        setCounts(data.counts || {});
      }
    } catch {
      toast.error("Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const handleStatusChange = (id, newStatus, newNotes) => {
    setInquiries(prev => prev.map(i => i._id === id ? { ...i, status: newStatus, adminNotes: newNotes } : i));
  };

  const handleConverted = (id, order) => {
    setInquiries(prev => prev.map(i => i._id === id ? { ...i, status: "Converted", orderId: order._id } : i));
    setSelectedInquiry(prev => prev && prev._id === id ? { ...prev, status: "Converted", orderId: order._id } : prev);
  };

  const handleDelete = async (id) => {
    const ok = await showConfirm("Move this inquiry to trash?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/custom-jacket-inquiries/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Inquiry removed");
        fetchInquiries();
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const headerRow = (
    <tr>
      <th scope="col">Name</th>
      <th scope="col" className="wp-hide-sm">Email</th>
      <th scope="col" className="wp-hide-sm">Jacket type</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Date</th>
    </tr>
  );

  const pager = (
    <div className="wp-pages">
      <button
        type="button"
        className="wp-pager"
        aria-label="Previous page"
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <span>Page {page} of {pagination.pages}</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Next page"
        onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
        disabled={page === pagination.pages}
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <RequirePermission permission="submissions.view">
    <AdminPageLayout title="Custom Jacket Inquiries">
      {/* Status Tabs */}
      <div className="wp-subsub" role="tablist" aria-label="Filter inquiries by status">
        {[["all", "All"], ...ALL_STATUSES.map(s => [s, s])].map(([val, label], i) => (
          <Fragment key={val}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === val}
              onClick={() => { setStatusFilter(val); setPage(1); }}
              className={statusFilter === val ? "is-current" : undefined}
            >
              {label} <span className="wp-count">({counts[val] || 0})</span>
            </button>
          </Fragment>
        ))}
      </div>

      {/* Search */}
      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <div className="wp-search" role="search">
          <label htmlFor="jacket-inquiries-search" className="sr-only">Search inquiries</label>
          <input
            id="jacket-inquiries-search"
            type="search"
            placeholder="Search by name, email, jacket type..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="wp-input"
            style={{ minWidth: 0, width: 280, maxWidth: "100%" }}
          />
          <button type="button" className="wp-btn">
            Search inquiries
          </button>
        </div>
      </div>

      {pagination.pages > 1 && <div className="wp-toolbar"><span className="wp-spacer" />{pager}</div>}

      {/* Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="wp-muted">Loading inquiries...</td></tr>
            ) : inquiries.length === 0 ? (
              <tr><td colSpan={5} className="wp-muted">No inquiries found.</td></tr>
            ) : (
              inquiries.map(inq => (
                <tr key={inq._id}>
                  <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedInquiry(inq)}
                      className="wp-row-title"
                      style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}
                    >
                      {inq.firstName} {inq.lastName}
                    </button>
                    {inq.referenceImages?.length > 0 && (
                      <span className="wp-muted wp-small" style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 3, verticalAlign: "middle" }}>
                        <ImageIcon className="w-3 h-3" aria-hidden="true" /> {inq.referenceImages.length} img
                      </span>
                    )}
                    <div className="wp-mobile-meta">
                      <span style={{ wordBreak: "break-all" }}>{inq.email}</span>
                      <br />
                      {inq.jacketType || "—"} · {new Date(inq.createdAt).toLocaleDateString()}
                    </div>
                    <div className="wp-row-actions">
                      <span><button type="button" onClick={() => setSelectedInquiry(inq)}>View</button></span>
                      {inq.orderId && (
                        <span><Link href={`/admin/orders/${inq.orderId}`}>Order</Link></span>
                      )}
                      <span><button type="button" onClick={() => handleDelete(inq._id)} className="is-danger">Delete</button></span>
                    </div>
                  </td>
                  <td className="wp-hide-sm" style={{ wordBreak: "break-all" }}>
                    <a href={`mailto:${inq.email}`} className="wp-link">{inq.email}</a>
                  </td>
                  <td className="wp-hide-sm">{inq.jacketType || "—"}</td>
                  <td>
                    <span className={`wp-pill ${STATUS_COLORS[inq.status] || "wp-st-draft"}`}>
                      {inq.status}
                    </span>
                  </td>
                  <td className="wp-hide-sm wp-muted">
                    {new Date(inq.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && <div className="wp-toolbar"><span className="wp-spacer" />{pager}</div>}

      {/* Detail Modal */}
      {selectedInquiry && (
        <DetailModal
          inquiry={selectedInquiry}
          onClose={() => setSelectedInquiry(null)}
          onStatusChange={handleStatusChange}
          onConverted={handleConverted}
        />
      )}
    </AdminPageLayout>
    </RequirePermission>
  );
}
