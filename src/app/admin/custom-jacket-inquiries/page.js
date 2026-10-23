"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ExternalLink, ImageIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Postbox, Notice } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";
import { usePopup } from "@/context/PopupContext";
import {
  useInboxList, runBulk, readError, StatusViews, Pager, BulkActions, SearchForm,
  SkeletonRows, SelectAllBox, Drawer, DangerLink, KV, formatDateTime,
} from "../contact/_shared/inbox-ui";
import ThemedSelect from "@/components/ui/ThemedSelect";

const API = "/api/admin/custom-jacket-inquiries";

const STATUS_COLORS = {
  New: "wp-st-out",
  Contacted: "wp-st-confirmed",
  "In Progress": "wp-st-packed",
  Converted: "wp-st-shipped",
  Completed: "wp-st-delivered",
  Cancelled: "wp-st-cancelled",
};
const ALL_STATUSES = Object.keys(STATUS_COLORS);
// Statuses an inquiry may not return to once it has been converted to an order.
const PRE_CONVERSION_STATUSES = ["New", "Contacted", "In Progress"];
const VIEWS = [["all", "All"], ...ALL_STATUSES.map((s) => [s, s]), ["trash", "Trash"]];

const fullName = (i) => [i.firstName, i.lastName].filter(Boolean).join(" ");

function InquiryDrawer({ inquiry, onClose, onSaved, onConverted, onTrash, onRestore, onDelete }) {
  const [status, setStatus] = useState(inquiry.status);
  const [notes, setNotes] = useState(inquiry.adminNotes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [converting, setConverting] = useState(false);
  const trashed = !!inquiry.isDeleted;
  const isConverted = !!inquiry.orderId || inquiry.status === "Converted";
  const statusOptions = isConverted ? ALL_STATUSES.filter((s) => !PRE_CONVERSION_STATUSES.includes(s)) : ALL_STATUSES;

  const handleConvert = async () => {
    const amount = Number(quoteAmount);
    if (!quoteAmount || !Number.isFinite(amount) || amount <= 0) {
      setQuoteError("Enter the quoted price (more than 0).");
      return;
    }
    setQuoteError("");
    setConverting(true);
    try {
      const res = await fetch(`${API}/${inquiry._id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteAmount: amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQuoteError(data.error || "Failed to convert the inquiry.");
        return;
      }
      toast.success(`Order #${data.order.orderNumber} created`);
      // Keep the panel's own status in sync so "Save" doesn't revert it.
      setStatus("Converted");
      onConverted(inquiry._id, data.order);
    } catch {
      setQuoteError("Failed to convert the inquiry. Check your connection and try again.");
    } finally {
      setConverting(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (isConverted && PRE_CONVERSION_STATUSES.includes(status)) {
      setError("A converted inquiry can't be moved back to an earlier status.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/${inquiry._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes: notes }),
      });
      if (!res.ok) {
        setError(await readError(res, "Could not save the changes."));
        return;
      }
      const updated = await res.json().catch(() => null);
      toast.success("Inquiry updated");
      onSaved(updated?._id ? updated : { ...inquiry, status, adminNotes: notes });
      onClose();
    } catch {
      setError("Could not save the changes. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const footer = trashed ? (
    <>
      <DangerLink onClick={() => onDelete(inquiry)}>Delete permanently</DangerLink>
      <button type="button" className="wp-btn" onClick={onClose}>Close</button>
      <button type="button" className="wp-btn wp-btn-primary" onClick={() => onRestore(inquiry)}>Restore</button>
    </>
  ) : (
    <>
      <DangerLink onClick={() => onTrash(inquiry)}>Move to Trash</DangerLink>
      <button type="button" className="wp-btn" onClick={onClose}>Cancel</button>
      <button type="submit" form="jacket-edit-form" className="wp-btn wp-btn-primary" disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </>
  );

  return (
    <Drawer
      titleId="inquiry-detail-title"
      title={fullName(inquiry) || "Custom jacket inquiry"}
      subtitle={<a href={`mailto:${inquiry.email}`} className="wp-link" style={{ wordBreak: "break-all" }}>{inquiry.email}</a>}
      onClose={onClose}
      footer={footer}
    >
      {trashed && (
        <Notice type="warning">
          This inquiry is in the Trash. Restore it to change its status{inquiry.orderId ? "" : " or convert it to an order"}.
        </Notice>
      )}
      {error && <Notice type="error">{error}</Notice>}

      <Postbox title="Custom order" id="jacket-order">
        {inquiry.orderId ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span className="wp-muted" style={{ flex: "1 1 200px" }}>This inquiry has been converted to an order.</span>
            <Link href={`/admin/orders/${inquiry.orderId}`} className="wp-btn">
              View order <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        ) : trashed ? (
          <p className="wp-muted" style={{ margin: 0 }}>Not converted.</p>
        ) : (
          <>
            <label htmlFor="inquiry-quote-amount" className="wp-label">Quoted price (USD)</label>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <input
                id="inquiry-quote-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={quoteAmount}
                onChange={(e) => { setQuoteAmount(e.target.value); setQuoteError(""); }}
                aria-invalid={quoteError ? "true" : undefined}
                aria-describedby="inquiry-quote-help"
                className="wp-input"
                style={{ flex: "1 1 160px", minWidth: 0, maxWidth: 220 }}
              />
              <button type="button" onClick={handleConvert} disabled={converting} className="wp-btn">
                {converting ? "Creating..." : "Convert to Order"}
              </button>
            </div>
            {quoteError
              ? <p className="wp-desc" style={{ color: "#d63638" }} role="alert">{quoteError}</p>
              : <p className="wp-desc" id="inquiry-quote-help">Creates a Pending order with this price and the jacket details below.</p>}
          </>
        )}
      </Postbox>

      {!trashed && (
        <form id="jacket-edit-form" onSubmit={handleSave}>
          <Postbox title="Status" id="jacket-status-box">
            <div className="wp-field">
              <label htmlFor="inquiry-status" className="wp-label">Status</label>
              <ThemedSelect id="inquiry-status" value={status} onChange={(e) => setStatus(e.target.value)} className="wp-select wp-full">
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </ThemedSelect>
            </div>
            <div className="wp-field" style={{ marginBottom: 0 }}>
              <label htmlFor="inquiry-admin-notes" className="wp-label">Admin notes</label>
              <textarea
                id="inquiry-admin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes (not visible to the customer)..."
                className="wp-textarea wp-full"
              />
            </div>
          </Postbox>
        </form>
      )}

      <Postbox title="Contact" id="jacket-contact">
        <KV label="Email" value={<a href={`mailto:${inquiry.email}`} className="wp-link" style={{ wordBreak: "break-all" }}>{inquiry.email}</a>} />
        <KV label="Phone" value={inquiry.phone} />
        <KV label="Location" value={[inquiry.city, inquiry.country].filter(Boolean).join(", ")} />
        <KV label="Submitted" value={formatDateTime(inquiry.createdAt)} />
      </Postbox>

      <Postbox title="Jacket" id="jacket-specs">
        <KV label="Jacket type" value={inquiry.jacketType} />
        <KV label="Gender" value={inquiry.gender} />
        <KV label="Leather" value={inquiry.preferredLeather} />
        <KV label="Color" value={inquiry.preferredColor} />
        <KV label="Size" value={inquiry.size} />
        <KV label="Budget" value={inquiry.budget} />
        <KV label="Deadline" value={inquiry.deadline} />
      </Postbox>

      {inquiry.additionalNotes && (
        <Postbox title="Customer notes" id="jacket-notes">
          <div className="wp-note-body is-customer" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{inquiry.additionalNotes}</div>
        </Postbox>
      )}

      {inquiry.referenceImages?.length > 0 && (
        <Postbox title={`Reference images (${inquiry.referenceImages.length})`} id="jacket-images">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }}>
            {inquiry.referenceImages.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", aspectRatio: "1 / 1", overflow: "hidden", border: "1px solid #dcdcde" }}>
                <img src={url} alt={`Reference ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </a>
            ))}
          </div>
        </Postbox>
      )}

      {trashed && inquiry.adminNotes && (
        <Postbox title="Admin notes" id="jacket-admin-notes-ro">
          <div className="wp-note-body" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{inquiry.adminNotes}</div>
        </Postbox>
      )}
    </Drawer>
  );
}

export default function CustomJacketInquiriesPage() {
  const { showConfirm } = usePopup();
  const list = useInboxList(API);
  const { view, items, selectedIds, reload, setItems } = list;
  const isTrash = view === "trash";
  const [bulkAction, setBulkAction] = useState("");
  const [open, setOpen] = useState(null);

  // "Converted" is only ever set by Convert to Order, so it isn't a bulk option.
  const bulkOptions = isTrash
    ? [["restore", "Restore"], ["delete", "Delete permanently"]]
    : [
        ...ALL_STATUSES.filter((s) => s !== "Converted" && s !== view).map((s) => [`status:${s}`, `Change status to ${s}`]),
        ["trash", "Move to Trash"],
      ];

  const act = async (action, ids) => {
    const n = ids.length;
    if (action === "delete") {
      const converted = items.filter((i) => ids.includes(i._id) && i.orderId).length;
      const ok = await showConfirm(
        `${n} inquir${n === 1 ? "y" : "ies"} will be deleted permanently. This cannot be undone.` +
          (converted ? ` Orders created from ${converted === 1 ? "it" : "them"} are kept with their jacket details.` : ""),
        "Delete permanently?",
        { confirmText: "Delete Permanently", danger: true }
      );
      if (!ok) return false;
    }
    const [name, status] = action.split(":");
    const verb = name === "status" ? `set to ${status}` : name === "trash" ? "moved to the Trash" : name === "restore" ? "restored" : "deleted permanently";
    const done = await runBulk(API, name, ids, { extra: status ? { status } : {}, verb, noun: "inquiry" });
    reload();
    return done;
  };

  const applyBulk = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (await act(bulkAction, selectedIds)) list.setSelectedIds([]);
    setBulkAction("");
  };

  const onSaved = useCallback((u) => {
    setItems((prev) => prev.map((i) => (i._id === u._id ? { ...i, ...u } : i)));
    reload({ silent: true });
  }, [reload, setItems]);

  const onConverted = useCallback((id, order) => {
    const patch = { status: "Converted", orderId: order._id };
    setItems((prev) => prev.map((i) => (i._id === id ? { ...i, ...patch } : i)));
    setOpen((prev) => (prev && prev._id === id ? { ...prev, ...patch } : prev));
    reload({ silent: true });
  }, [reload, setItems]);

  const closeAfter = (fn) => async (inq) => { if (await fn(inq)) setOpen(null); };

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <SelectAllBox label="Select all inquiries" list={list} />
      </th>
      <th scope="col">Name</th>
      <th scope="col" className="wp-hide-sm">Email</th>
      <th scope="col" className="wp-hide-sm">Jacket type</th>
      <th scope="col" className="wp-hide-sm">Status</th>
      <th scope="col" className="wp-hide-sm">Date</th>
    </tr>
  );

  return (
    <RequirePermission permission="submissions.view">
      <Page>
        <PageHeader title="Custom Jacket Inquiries" />

        <StatusViews
          label="Filter inquiries by status"
          views={VIEWS}
          current={view}
          counts={list.counts}
          onChange={(v) => { list.setView(v); setBulkAction(""); }}
        />

        <div className="wp-toolbar">
          <BulkActions
            id="jacket-bulk-action"
            options={bulkOptions}
            value={bulkAction}
            onChange={setBulkAction}
            onApply={applyBulk}
            disabled={!bulkAction || selectedIds.length === 0}
          />
          <span className="wp-spacer" />
          <SearchForm
            id="jacket-inquiries-search"
            label="Search inquiries"
            placeholder="Name, email, phone, jacket type..."
            value={list.searchInput}
            onChange={list.onSearchChange}
            onSubmit={list.submitSearch}
          />
        </div>

        <div className="wp-toolbar">
          <span className="wp-spacer" />
          <Pager pagination={list.pagination} onPage={list.goToPage} />
        </div>

        {list.error && <Notice type="error">{list.error}</Notice>}

        <div className="wp-table-box">
          <table className="wp-list-table">
            <thead>{headerRow}</thead>
            <tbody>
              {list.loading ? (
                <SkeletonRows cols={5} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wp-muted">
                    {list.query ? `No inquiries match “${list.query}”.` : isTrash ? "The Trash is empty." : "No inquiries found."}
                  </td>
                </tr>
              ) : (
                items.map((inq) => {
                  const selected = selectedIds.includes(inq._id);
                  return (
                    <tr key={inq._id} className={selected ? "is-selected" : undefined}>
                      <td className="wp-check-col">
                        <input type="checkbox" aria-label={`Select inquiry from ${fullName(inq)}`} checked={selected} onChange={() => list.toggleSelect(inq._id)} />
                      </td>
                      <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                        <button
                          type="button"
                          onClick={() => setOpen(inq)}
                          className="wp-row-title"
                          style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", fontWeight: inq.status === "New" ? 700 : 600 }}
                        >
                          {fullName(inq) || "(no name)"}
                        </button>
                        {inq.referenceImages?.length > 0 && (
                          <span className="wp-muted wp-small" style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 3, verticalAlign: "middle" }}>
                            <ImageIcon className="w-3 h-3" aria-hidden="true" /> {inq.referenceImages.length}
                            <span className="sr-only"> reference image{inq.referenceImages.length === 1 ? "" : "s"}</span>
                          </span>
                        )}
                        <div className="wp-mobile-meta">
                          <span style={{ wordBreak: "break-all" }}>{inq.email}</span>
                          <br />
                          <span className={`wp-pill wp-pill-sm ${STATUS_COLORS[inq.status] || "wp-st-draft"}`}>{inq.status}</span>
                          {" · "}{inq.jacketType || "—"} · {new Date(inq.createdAt).toLocaleDateString()}
                        </div>
                        <div className="wp-row-actions">
                          <span><button type="button" onClick={() => setOpen(inq)}>{isTrash ? "View" : "View / Edit"}</button></span>
                          {inq.orderId && <span><Link href={`/admin/orders/${inq.orderId}`}>Order</Link></span>}
                          {isTrash ? (
                            <>
                              <span><button type="button" onClick={() => act("restore", [inq._id])}>Restore</button></span>
                              <span><button type="button" className="is-danger" onClick={() => act("delete", [inq._id])}>Delete permanently</button></span>
                            </>
                          ) : (
                            <>
                              {inq.status === "New" && (
                                <span><button type="button" onClick={() => act("status:Contacted", [inq._id])}>Mark contacted</button></span>
                              )}
                              <span><button type="button" className="is-danger" onClick={() => act("trash", [inq._id])}>Trash</button></span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="wp-hide-sm" style={{ wordBreak: "break-all" }}>
                        <a href={`mailto:${inq.email}`} className="wp-link">{inq.email}</a>
                      </td>
                      <td className="wp-hide-sm">{inq.jacketType || "—"}</td>
                      <td className="wp-hide-sm">
                        <span className={`wp-pill ${STATUS_COLORS[inq.status] || "wp-st-draft"}`}>{inq.status}</span>
                      </td>
                      <td className="wp-hide-sm wp-muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(inq.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>{headerRow}</tfoot>
          </table>
        </div>

        <div className="wp-toolbar">
          <span className="wp-spacer" />
          <Pager pagination={list.pagination} onPage={list.goToPage} />
        </div>

        {open && (
          <InquiryDrawer
            key={open._id}
            inquiry={open}
            onClose={() => setOpen(null)}
            onSaved={onSaved}
            onConverted={onConverted}
            onTrash={closeAfter((i) => act("trash", [i._id]))}
            onRestore={closeAfter((i) => act("restore", [i._id]))}
            onDelete={closeAfter((i) => act("delete", [i._id]))}
          />
        )}
      </Page>
    </RequirePermission>
  );
}
