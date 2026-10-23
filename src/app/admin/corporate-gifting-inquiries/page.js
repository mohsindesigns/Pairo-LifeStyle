"use client";

import { useCallback, useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Postbox, Notice } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";
import { usePopup } from "@/context/PopupContext";
import {
  useInboxList, runBulk, readError, StatusViews, Pager, BulkActions, SearchForm,
  SkeletonRows, SelectAllBox, Drawer, DangerLink, KV, formatDateTime,
} from "../contact/_shared/inbox-ui";
import ThemedSelect from "@/components/ui/ThemedSelect";

const API = "/api/admin/corporate-gifting-inquiries";

const STATUS_COLORS = {
  New: "wp-st-out",
  Contacted: "wp-st-confirmed",
  Quoted: "wp-st-shipped",
  "In Progress": "wp-st-packed",
  Completed: "wp-st-delivered",
  Cancelled: "wp-st-cancelled",
};
const ALL_STATUSES = Object.keys(STATUS_COLORS);
const PRIORITIES = ["Low", "Medium", "High"];
const VIEWS = [["all", "All"], ...ALL_STATUSES.map((s) => [s, s]), ["trash", "Trash"]];

const isImage = (u) => /\.(png|jpe?g|webp|svg|gif)$/i.test(u || "");

function GiftingDrawer({ inquiry, onClose, onSaved, onTrash, onRestore, onDelete }) {
  const [status, setStatus] = useState(inquiry.status);
  const [priority, setPriority] = useState(inquiry.priority || "Medium");
  const [notes, setNotes] = useState(inquiry.adminNotes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const trashed = !!inquiry.isDeleted;

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/${inquiry._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, priority, adminNotes: notes }),
      });
      if (!res.ok) {
        setError(await readError(res, "Could not save the changes."));
        return;
      }
      const data = await res.json();
      toast.success("Inquiry updated");
      onSaved(data);
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
      <button type="submit" form="gifting-edit-form" className="wp-btn wp-btn-primary" disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </>
  );

  return (
    <Drawer
      titleId="gifting-detail-title"
      title={inquiry.company}
      subtitle={<>{inquiry.contactName} · <a href={`mailto:${inquiry.email}`} className="wp-link" style={{ wordBreak: "break-all" }}>{inquiry.email}</a></>}
      onClose={onClose}
      footer={footer}
    >
      {trashed && <Notice type="warning">This inquiry is in the Trash. Restore it to change its status.</Notice>}
      {error && <Notice type="error">{error}</Notice>}

      {!trashed && (
        <form id="gifting-edit-form" onSubmit={save}>
          <Postbox title="Status" id="gifting-status-box">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0 12px" }}>
              <div className="wp-field">
                <label htmlFor="gifting-status" className="wp-label">Status</label>
                <ThemedSelect id="gifting-status" value={status} onChange={(e) => setStatus(e.target.value)} className="wp-select wp-full">
                  {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </ThemedSelect>
              </div>
              <div className="wp-field">
                <label htmlFor="gifting-priority" className="wp-label">Priority</label>
                <ThemedSelect id="gifting-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="wp-select wp-full">
                  {PRIORITIES.map((s) => <option key={s}>{s}</option>)}
                </ThemedSelect>
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
          </Postbox>
        </form>
      )}

      <Postbox title="Contact" id="gifting-contact">
        <KV label="Contact" value={inquiry.contactName} />
        <KV label="Email" value={<a href={`mailto:${inquiry.email}`} className="wp-link" style={{ wordBreak: "break-all" }}>{inquiry.email}</a>} />
        <KV label="Phone" value={inquiry.phone} />
        <KV label="Location" value={[inquiry.city, inquiry.country].filter(Boolean).join(", ")} />
        <KV label="Submitted" value={formatDateTime(inquiry.createdAt)} />
      </Postbox>

      <Postbox title="Gift packs" id="gifting-packs">
        <KV label="Occasion" value={inquiry.occasion} />
        <KV label="Number of packs" value={inquiry.quantity} />
        <KV label="Budget per pack" value={inquiry.budget} />
        <KV label="Needed by" value={inquiry.deliveryDate} />
        <KV label="Branding" value={inquiry.branding} />
        <KV label="Packaging" value={inquiry.packaging} />
        <KV label="Leather" value={inquiry.leather} />
        <KV label="Brand colors" value={inquiry.brandColors} />
        <KV label="Greeting card" value={inquiry.greetingCard ? "Yes" : ""} />
        {inquiry.items?.length > 0 && (
          <div style={{ paddingTop: 10 }}>
            <div className="wp-label">Items in pack</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {inquiry.items.map((i) => <span key={i} className="wp-chip">{i}</span>)}
            </div>
          </div>
        )}
      </Postbox>

      {inquiry.notes && (
        <Postbox title="Customer notes" id="gifting-notes">
          <div className="wp-note-body is-customer" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{inquiry.notes}</div>
        </Postbox>
      )}

      {(inquiry.logos?.length > 0 || inquiry.referenceImages?.length > 0) && (
        <Postbox title="Files" id="gifting-files">
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
                      <img src={l.url} alt={l.name || `Logo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
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
            <div className="wp-field" style={{ marginBottom: 0 }}>
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
        </Postbox>
      )}

      {trashed && inquiry.adminNotes && (
        <Postbox title="Admin notes" id="gifting-admin-notes-ro">
          <div className="wp-note-body" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{inquiry.adminNotes}</div>
        </Postbox>
      )}
    </Drawer>
  );
}

export default function CorporateGiftingInquiriesPage() {
  const { showConfirm } = usePopup();
  const list = useInboxList(API);
  const { view, items, selectedIds, reload, setItems } = list;
  const isTrash = view === "trash";
  const [bulkAction, setBulkAction] = useState("");
  const [open, setOpen] = useState(null);

  const bulkOptions = isTrash
    ? [["restore", "Restore"], ["delete", "Delete permanently"]]
    : [...ALL_STATUSES.filter((s) => s !== view).map((s) => [`status:${s}`, `Change status to ${s}`]), ["trash", "Move to Trash"]];

  const act = async (action, ids) => {
    const n = ids.length;
    if (action === "delete") {
      const ok = await showConfirm(
        `${n} inquir${n === 1 ? "y" : "ies"} will be deleted permanently. This cannot be undone.`,
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
    setItems((prev) => prev.map((i) => (i._id === u._id ? u : i)));
    reload({ silent: true });
  }, [reload, setItems]);

  const closeAfter = (fn) => async (inq) => { if (await fn(inq)) setOpen(null); };

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <SelectAllBox label="Select all inquiries" list={list} />
      </th>
      <th scope="col">Company</th>
      <th scope="col" className="wp-hide-sm">Contact</th>
      <th scope="col" className="wp-hide-sm">Occasion</th>
      <th scope="col" className="wp-hide-sm wp-num">Packs</th>
      <th scope="col" className="wp-hide-sm">Status</th>
      <th scope="col" className="wp-hide-sm">Date</th>
    </tr>
  );

  return (
    <RequirePermission permission="submissions.view">
      <Page>
        <PageHeader title="Corporate Gifting Inquiries" />

        <StatusViews
          label="Filter inquiries by status"
          views={VIEWS}
          current={view}
          counts={list.counts}
          onChange={(v) => { list.setView(v); setBulkAction(""); }}
        />

        <div className="wp-toolbar">
          <BulkActions
            id="gifting-bulk-action"
            options={bulkOptions}
            value={bulkAction}
            onChange={setBulkAction}
            onApply={applyBulk}
            disabled={!bulkAction || selectedIds.length === 0}
          />
          <span className="wp-spacer" />
          <SearchForm
            id="gifting-search"
            label="Search inquiries"
            placeholder="Company, contact, email, occasion..."
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
                <SkeletonRows cols={6} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="wp-muted">
                    {list.query ? `No inquiries match “${list.query}”.` : isTrash ? "The Trash is empty." : "No inquiries found."}
                  </td>
                </tr>
              ) : (
                items.map((inq) => {
                  const selected = selectedIds.includes(inq._id);
                  return (
                    <tr key={inq._id} className={selected ? "is-selected" : undefined}>
                      <td className="wp-check-col">
                        <input type="checkbox" aria-label={`Select ${inq.company}`} checked={selected} onChange={() => list.toggleSelect(inq._id)} />
                      </td>
                      <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                        <button
                          type="button"
                          onClick={() => setOpen(inq)}
                          className="wp-row-title"
                          style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", fontWeight: inq.status === "New" ? 700 : 600 }}
                        >
                          {inq.company}
                        </button>
                        <div className="wp-mobile-meta">
                          {inq.contactName} · <span style={{ wordBreak: "break-all" }}>{inq.email}</span>
                          <br />
                          <span className={`wp-pill wp-pill-sm ${STATUS_COLORS[inq.status] || "wp-st-draft"}`}>{inq.status}</span>
                          {" · "}{inq.occasion || "—"} · {inq.quantity || "—"} packs · {new Date(inq.createdAt).toLocaleDateString()}
                        </div>
                        <div className="wp-row-actions">
                          <span><button type="button" onClick={() => setOpen(inq)}>{isTrash ? "View" : "View / Edit"}</button></span>
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
                      <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                        <div className="wp-strong">{inq.contactName}</div>
                        <a href={`mailto:${inq.email}`} className="wp-link wp-small" style={{ wordBreak: "break-all" }}>{inq.email}</a>
                      </td>
                      <td className="wp-hide-sm">{inq.occasion || "—"}</td>
                      <td className="wp-hide-sm wp-num">{inq.quantity || "—"}</td>
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
          <GiftingDrawer
            key={open._id}
            inquiry={open}
            onClose={() => setOpen(null)}
            onSaved={onSaved}
            onTrash={closeAfter((i) => act("trash", [i._id]))}
            onRestore={closeAfter((i) => act("restore", [i._id]))}
            onDelete={closeAfter((i) => act("delete", [i._id]))}
          />
        )}
      </Page>
    </RequirePermission>
  );
}
