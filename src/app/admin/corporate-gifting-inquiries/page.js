"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";
import { ChevronLeft, ChevronRight, X, FileText } from "lucide-react";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

const STATUS_COLORS = {
  New: "wp-st-out",
  Contacted: "wp-st-confirmed",
  Quoted: "wp-st-shipped",
  "In Progress": "wp-st-packed",
  Completed: "wp-st-delivered",
  Cancelled: "wp-st-cancelled"
};
const ALL_STATUSES = ["New", "Contacted", "Quoted", "In Progress", "Completed", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High"];

const Detail = ({ label, value }) =>
  value ? (
    <div className="wp-kv" style={{ alignItems: "flex-start" }}>
      <span className="wp-kv-k wp-muted">{label}</span>
      <span className="wp-kv-v" style={{ textAlign: "right", wordBreak: "break-word", minWidth: 0 }}>{value}</span>
    </div>
  ) : null;

function DetailModal({ inquiry, onClose, onSaved }) {
  const [status, setStatus] = useState(inquiry.status);
  const [priority, setPriority] = useState(inquiry.priority || "Medium");
  const [notes, setNotes] = useState(inquiry.adminNotes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/corporate-gifting-inquiries/${inquiry._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, priority, adminNotes: notes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Inquiry updated");
      onSaved(data);
      onClose();
    } catch (e) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const isImage = (u) => /\.(png|jpe?g|webp|svg|gif)$/i.test(u || "");

  return (
    <div className="wp-modal-backdrop" onClick={onClose}>
      <div
        className="wp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gifting-detail-title"
        style={{ maxWidth: 760 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wp-modal-head" style={{ gap: 8, position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
          <div style={{ minWidth: 0 }}>
            <h2 id="gifting-detail-title" style={{ wordBreak: "break-word" }}>{inquiry.company}</h2>
            <p className="wp-muted" style={{ margin: "2px 0 0", wordBreak: "break-all" }}>{inquiry.contactName} · {inquiry.email}</p>
          </div>
          <button type="button" onClick={onClose} className="wp-btn" aria-label="Close" style={{ minWidth: 32, padding: "0 6px", flex: "none" }}>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="wp-modal-body">
          <div className="wp-order-cols" style={{ padding: 0, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 16 }}>
            <div style={{ minWidth: 0 }}>
              <h3>Contact</h3>
              <Detail label="Phone" value={inquiry.phone} />
              <Detail label="Location" value={[inquiry.city, inquiry.country].filter(Boolean).join(", ")} />
              <Detail label="Submitted" value={new Date(inquiry.createdAt).toLocaleString()} />
            </div>

            <div style={{ minWidth: 0 }}>
              <h3>Gift packs</h3>
              <Detail label="Occasion" value={inquiry.occasion} />
              <Detail label="Number of packs" value={inquiry.quantity} />
              <Detail label="Budget per pack" value={inquiry.budget} />
              <Detail label="Needed by" value={inquiry.deliveryDate} />
              <Detail label="Branding" value={inquiry.branding} />
              <Detail label="Packaging" value={inquiry.packaging} />
              <Detail label="Leather" value={inquiry.leather} />
              <Detail label="Brand colors" value={inquiry.brandColors} />
              <Detail label="Greeting card" value={inquiry.greetingCard ? "Yes" : ""} />
            </div>
          </div>

          {inquiry.items?.length > 0 && (
            <div className="wp-field">
              <div className="wp-label">Items in pack</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {inquiry.items.map((i) => (
                  <span key={i} className="wp-chip">{i}</span>
                ))}
              </div>
            </div>
          )}

          {inquiry.notes && (
            <div className="wp-field">
              <div className="wp-label">Notes</div>
              <div className="wp-note-body is-customer" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{inquiry.notes}</div>
            </div>
          )}

          {inquiry.logos?.length > 0 && (
            <div className="wp-field">
              <div className="wp-label">Logo files ({inquiry.logos.length})</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }}>
                {inquiry.logos.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ aspectRatio: "1 / 1", overflow: "hidden", border: "1px solid #dcdcde", background: "#f6f7f7", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {isImage(l.url) ? (
                      <img src={l.url} alt={l.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                    ) : (
                      <span className="wp-muted wp-small" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 4, textAlign: "center", wordBreak: "break-all" }}>
                        <FileText className="w-5 h-5" aria-hidden="true" style={{ marginBottom: 4 }} />{l.name}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {inquiry.referenceImages?.length > 0 && (
            <div className="wp-field">
              <div className="wp-label">Reference images ({inquiry.referenceImages.length})</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }}>
                {inquiry.referenceImages.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{ display: "block", aspectRatio: "1 / 1", overflow: "hidden", border: "1px solid #dcdcde" }}>
                    <img src={u} alt={`Reference ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, borderTop: "1px solid #f0f0f1", paddingTop: 12 }}>
            <div className="wp-field">
              <label htmlFor="gifting-status" className="wp-label">Status</label>
              <select id="gifting-status" value={status} onChange={(e) => setStatus(e.target.value)} className="wp-select wp-full">
                {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="wp-field">
              <label htmlFor="gifting-priority" className="wp-label">Priority</label>
              <select id="gifting-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="wp-select wp-full">
                {PRIORITIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="wp-field" style={{ marginBottom: 0 }}>
            <label htmlFor="gifting-admin-notes" className="wp-label">Admin notes</label>
            <textarea
              id="gifting-admin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes (not visible to the customer)..."
              className="wp-textarea wp-full"
            />
          </div>
        </div>

        <div className="wp-modal-foot">
          <button type="button" onClick={onClose} className="wp-btn">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="wp-btn wp-btn-primary">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CorporateGiftingInquiriesPage() {
  const { showConfirm } = usePopup();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [counts, setCounts] = useState({});
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/corporate-gifting-inquiries?${params}`);
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

  useEffect(() => { load(); }, [load]);

  const remove = async (id) => {
    if (!(await showConfirm("Move this inquiry to trash?"))) return;
    try {
      const res = await fetch(`/api/admin/corporate-gifting-inquiries/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Inquiry removed");
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const headerRow = (
    <tr>
      <th scope="col">Company</th>
      <th scope="col" className="wp-hide-sm">Contact</th>
      <th scope="col" className="wp-hide-sm">Occasion</th>
      <th scope="col" className="wp-hide-sm wp-num">Packs</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Date</th>
    </tr>
  );

  const pager = (
    <div className="wp-pages">
      <button type="button" className="wp-pager" aria-label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <span>Page {page} of {pagination.pages}</span>
      <button type="button" className="wp-pager" aria-label="Next page" onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <RequirePermission permission="submissions.view">
      <AdminPageLayout title="Corporate Gifting Inquiries">
        <div className="wp-subsub" role="tablist" aria-label="Filter inquiries by status">
          {[["all", "All"], ...ALL_STATUSES.map((s) => [s, s])].map(([val, label], i) => (
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

        <div className="wp-toolbar">
          <span className="wp-spacer" />
          <div className="wp-search" role="search">
            <label htmlFor="gifting-search" className="sr-only">Search inquiries</label>
            <input
              id="gifting-search"
              type="search"
              placeholder="Search by company, contact, email, occasion..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="wp-input"
              style={{ minWidth: 0, width: 300, maxWidth: "100%" }}
            />
          </div>
        </div>

        {pagination.pages > 1 && <div className="wp-toolbar"><span className="wp-spacer" />{pager}</div>}

        <div className="wp-table-box">
          <table className="wp-list-table">
            <thead>{headerRow}</thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="wp-muted">Loading inquiries...</td></tr>
              ) : inquiries.length === 0 ? (
                <tr><td colSpan={6} className="wp-muted">No inquiries found.</td></tr>
              ) : (
                inquiries.map((inq) => (
                  <tr key={inq._id}>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <button
                        type="button"
                        onClick={() => setSelected(inq)}
                        className="wp-row-title"
                        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}
                      >
                        {inq.company}
                      </button>
                      <div className="wp-mobile-meta">
                        {inq.contactName} · <span style={{ wordBreak: "break-all" }}>{inq.email}</span>
                        <br />
                        {inq.occasion || "—"} · {inq.quantity || "—"} packs · {new Date(inq.createdAt).toLocaleDateString()}
                      </div>
                      <div className="wp-row-actions">
                        <span><button type="button" onClick={() => setSelected(inq)}>View</button></span>
                        <span><button type="button" onClick={() => remove(inq._id)} className="is-danger">Delete</button></span>
                      </div>
                    </td>
                    <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                      <div className="wp-strong">{inq.contactName}</div>
                      <a href={`mailto:${inq.email}`} className="wp-link wp-small" style={{ wordBreak: "break-all" }}>{inq.email}</a>
                    </td>
                    <td className="wp-hide-sm">{inq.occasion || "—"}</td>
                    <td className="wp-hide-sm wp-num">{inq.quantity || "—"}</td>
                    <td>
                      <span className={`wp-pill ${STATUS_COLORS[inq.status] || "wp-st-draft"}`}>{inq.status}</span>
                    </td>
                    <td className="wp-hide-sm wp-muted">{new Date(inq.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>{headerRow}</tfoot>
          </table>
        </div>

        {pagination.pages > 1 && <div className="wp-toolbar"><span className="wp-spacer" />{pager}</div>}

        {selected && (
          <DetailModal
            inquiry={selected}
            onClose={() => setSelected(null)}
            onSaved={(u) => setInquiries((prev) => prev.map((i) => (i._id === u._id ? u : i)))}
          />
        )}
      </AdminPageLayout>
    </RequirePermission>
  );
}
