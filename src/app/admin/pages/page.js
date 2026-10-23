"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Page, PageHeader, formatDate } from "@/components/admin/ui";
import { TEMPLATE_REGISTRY } from "@/lib/templates";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { usePopup } from "@/context/PopupContext";
import { useRBAC } from "@/hooks/useRBAC";
import RequirePermission from "@/components/admin/RequirePermission";

const VIEWS = ["all", "published", "draft", "trash"];

export default function PagesManagementPage() {
  const { can } = useRBAC();
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  // Status filter: all | published | draft | trash
  const [view, setView] = useState("all");

  const canEdit = can("pages.edit");
  const canCreate = can("pages.create");
  const canDelete = can("pages.delete");

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      // scope=all returns trashed pages too, so the Trash view and its count come from one request.
      const res = await fetch("/api/admin/pages?scope=all", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setPages(data);
      } else {
        setPages([]);
        if (!res.ok) {
          toast.error(data?.error || "Failed to load pages");
        }
      }
    } catch (err) {
      setPages([]);
      toast.error("Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      // Allow deep links such as /admin/pages?status=trash
      const initial = new URLSearchParams(window.location.search).get("status");
      if (VIEWS.includes(initial)) setView(initial);
      fetchPages();
    });
  }, [fetchPages]);

  const changeView = (next) => {
    setView(next);
    setSelectedIds([]);
    setBulkAction("Bulk actions");
  };

  // --- Single-request helpers (return { ok, error }) so single and bulk actions share them ---
  const readError = async (res, fallback) => {
    const data = await res.json().catch(() => ({}));
    return data?.error || fallback;
  };

  const trashRequest = async (id) => {
    const res = await fetch(`/api/admin/pages/${id}`, { method: "DELETE" });
    return res.ok ? { ok: true } : { ok: false, error: await readError(res, "Failed to move to Trash") };
  };

  const permanentDeleteRequest = async (id) => {
    const res = await fetch(`/api/admin/pages/${id}?permanent=true`, { method: "DELETE" });
    return res.ok ? { ok: true } : { ok: false, error: await readError(res, "Failed to delete permanently") };
  };

  const restoreRequest = async (id) => {
    const res = await fetch(`/api/admin/pages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" })
    });
    return res.ok ? { ok: true } : { ok: false, error: await readError(res, "Failed to restore") };
  };

  const duplicateRequest = async (page) => {
    const { _id, createdAt, updatedAt, __v, isDeleted, deletedAt, statusBeforeTrash, ...rest } = page;
    const copy = {
      ...rest,
      title: `${page.title} (Copy)`,
      slug: `${page.slug}-copy-${Math.floor(Math.random() * 1000)}`,
      status: "Draft",
      isSystem: false
    };
    const res = await fetch("/api/admin/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(copy)
    });
    return res.ok ? { ok: true } : { ok: false, error: await readError(res, "Failed to duplicate page") };
  };

  const runSingle = async (request, successMsg) => {
    try {
      const result = await request();
      if (result.ok) {
        toast.success(successMsg);
        fetchPages();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const deletePage = async (id, isSystem) => {
    if (isSystem) return toast.error("System pages cannot be deleted");
    const ok = await showConfirm("Move this page to the Trash? It will no longer be shown on the site. You can restore it from the Trash.", "Move to Trash", { confirmText: "Move to Trash", danger: true });
    if (!ok) return;
    runSingle(() => trashRequest(id), "Page moved to Trash");
  };

  const restorePage = (id) => runSingle(() => restoreRequest(id), "Page restored");

  const permanentlyDeletePage = async (page) => {
    if (page.isSystem) return toast.error("System pages cannot be deleted");
    const ok = await showConfirm(`Permanently delete "${page.title}"? This cannot be undone.`, "Delete permanently", { confirmText: "Delete permanently", danger: true });
    if (!ok) return;
    runSingle(() => permanentDeleteRequest(page._id), "Page permanently deleted");
  };

  const handleDuplicate = async (page) => {
    if (page.isSystem) return toast.error("System pages cannot be duplicated");
    runSingle(() => duplicateRequest(page), "Page duplicated");
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     const isPermanent = bulkAction === "Delete Permanently";
     const ok = await showConfirm(
        isPermanent
           ? `Permanently delete ${selectedIds.length} page${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`
           : `Apply "${bulkAction}" to ${selectedIds.length} page${selectedIds.length === 1 ? "" : "s"}?`,
        isPermanent ? "Delete permanently" : "Are you sure?",
        isPermanent || bulkAction === "Move to Trash" ? { confirmText: bulkAction, danger: true } : { confirmText: bulkAction }
     );
     if (!ok) return;

     let success = 0;
     const failures = [];
     for (const id of selectedIds) {
        const page = pages.find(p => p._id === id);
        if (!page || page.isSystem) continue; // System pages are never trashed, deleted or bulk-duplicated
        try {
           let result;
           if (bulkAction === "Move to Trash") result = await trashRequest(id);
           else if (bulkAction === "Delete Permanently") result = await permanentDeleteRequest(id);
           else if (bulkAction === "Restore") result = await restoreRequest(id);
           else if (bulkAction === "Duplicate") result = await duplicateRequest(page);
           else continue;
           if (result.ok) success++;
           else failures.push(`${page.title}: ${result.error}`);
        } catch (err) {
           failures.push(`${page.title}: request failed`);
        }
     }

     setSelectedIds([]);
     setBulkAction("Bulk actions");
     fetchPages();
     if (success > 0) toast.success(`${bulkAction}: ${success} page${success === 1 ? "" : "s"} done`);
     if (failures.length > 0) toast.error(`${failures.length} failed — ${failures.join("; ")}`);
  };

  const toggleSelect = (id, isSystem) => {
     if (isSystem) return; // Prevent selecting system pages for bulk deletion
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const allPages = Array.isArray(pages) ? pages : [];
  const livePages = allPages.filter(p => !p.isDeleted);
  const trashedPages = allPages.filter(p => p.isDeleted);
  const counts = {
    all: livePages.length,
    published: livePages.filter(p => p.status === 'Published').length,
    draft: livePages.filter(p => p.status !== 'Published').length,
    trash: trashedPages.length
  };
  const isTrash = view === "trash";

  const viewPages = isTrash ? trashedPages
    : view === "published" ? livePages.filter(p => p.status === 'Published')
    : view === "draft" ? livePages.filter(p => p.status !== 'Published')
    : livePages;

  const filteredPages = viewPages.filter(p => 
    (p.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.slug || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelectAll = () => {
     const selectable = filteredPages.filter(p => !p.isSystem);
     if (selectedIds.length === selectable.length) setSelectedIds([]);
     else setSelectedIds(selectable.map(p => p._id));
  };

  const selectableCount = filteredPages.filter(p => !p.isSystem).length;
  const allSelected = selectedIds.length > 0 && selectedIds.length === selectableCount;

  // Bulk options depend on the view and on the user's permissions.
  const bulkOptions = isTrash
    ? [canEdit && "Restore", canDelete && "Delete Permanently"].filter(Boolean)
    : [canCreate && "Duplicate", canDelete && "Move to Trash"].filter(Boolean);

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input type="checkbox" aria-label="Select all pages" checked={allSelected} onChange={toggleSelectAll} />
      </th>
      <th scope="col">Title</th>
      <th scope="col" className="wp-hide-sm">Template</th>
      <th scope="col" className="wp-hide-sm">Author</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Date</th>
    </tr>
  );

  return (
    <RequirePermission permission="pages.view">
    <Page>
      <PageHeader
        title="Pages"
        actions={canCreate ? <Link href="/admin/pages/new" className="wp-btn">Add New Page</Link> : null}
      />

      {/* Status filter links */}
      <div className="wp-subsub" role="tablist" aria-label="Filter pages by status">
        {[
          { id: "all", label: "All" },
          { id: "published", label: "Published" },
          { id: "draft", label: "Drafts" },
          { id: "trash", label: "Trash" }
        ].map((v, i) => (
          <span key={v.id}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button type="button" role="tab" aria-selected={view === v.id} className={view === v.id ? "is-current" : undefined} onClick={() => changeView(v.id)}>
              {v.label} <span className="wp-count">({counts[v.id]})</span>
            </button>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="wp-toolbar">
        <label htmlFor="pages-bulk-action" className="sr-only">Select bulk action</label>
        {bulkOptions.length > 0 && (
          <>
            <select id="pages-bulk-action" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
              <option>Bulk actions</option>
              {bulkOptions.map(o => <option key={o}>{o}</option>)}
            </select>
            <button type="button" onClick={handleBulkAction} className="wp-btn">Apply</button>
          </>
        )}

        <span className="wp-spacer" />

        <div className="wp-search" role="search">
          <label htmlFor="pages-search" className="sr-only">Search pages</label>
          <input
            id="pages-search"
            type="search"
            placeholder="Search pages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="wp-input"
          />
          <button type="button" className="wp-btn">Search Pages</button>
        </div>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <div className="wp-pages"><span>{filteredPages.length} items</span></div>
      </div>

      {/* Data Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="wp-muted">Loading pages…</td></tr>
            ) : filteredPages.length === 0 ? (
              <tr><td colSpan={6} className="wp-muted">{isTrash ? "No pages found in Trash." : "No pages found."}</td></tr>
            ) : (
              filteredPages.map((p) => {
                const dateValue = p.updatedAt || p.createdAt;
                const templateName = TEMPLATE_REGISTRY[p.template || "default"]?.name || p.template || "Default";
                return (
                  <tr key={p._id} className={selectedIds.includes(p._id) ? "is-selected" : undefined}>
                    <td className="wp-check-col">
                      <input
                        type="checkbox"
                        aria-label={p.isSystem ? `${p.title} is a system page and cannot be selected` : `Select ${p.title}`}
                        checked={selectedIds.includes(p._id)}
                        onChange={() => toggleSelect(p._id, p.isSystem)}
                        disabled={p.isSystem}
                      />
                    </td>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      {canEdit && !isTrash ? (
                        <Link href={`/admin/pages/${p._id}`} className="wp-row-title">{p.title}</Link>
                      ) : (
                        <span className="wp-row-title">{p.title}</span>
                      )}
                      {p.status === 'Draft' && !p.isDeleted && <span className="wp-strong"> — Draft</span>}
                      {p.isSystem && <span className="wp-muted"> — System page</span>}
                      <div className="wp-mobile-meta">
                        {templateName}
                        {dateValue ? ` · ${formatDate(dateValue)}` : ""}
                      </div>
                      {isTrash ? (
                        <div className="wp-row-actions">
                          {canEdit && <span><button type="button" onClick={() => restorePage(p._id)}>Restore</button></span>}
                          {canDelete && !p.isSystem && <span><button type="button" onClick={() => permanentlyDeletePage(p)} className="is-danger">Delete permanently</button></span>}
                        </div>
                      ) : (
                        <div className="wp-row-actions">
                          {canEdit && <span><Link href={`/admin/pages/${p._id}`}>Edit</Link></span>}
                          {!p.isSystem && (
                            <>
                              {canCreate && <span><button type="button" onClick={() => handleDuplicate(p)}>Duplicate</button></span>}
                              {canDelete && <span><button type="button" onClick={() => deletePage(p._id, p.isSystem)} className="is-danger">Trash</button></span>}
                            </>
                          )}
                          <span><Link href={p.slug === 'home' ? '/' : `/${p.slug}`} target="_blank">View</Link></span>
                        </div>
                      )}
                    </td>
                    <td className="wp-hide-sm">{templateName}</td>
                    <td className="wp-hide-sm"><span className="wp-link">Admin</span></td>
                    <td>
                      <span className={`wp-pill ${p.status === 'Published' && !p.isDeleted ? 'wp-st-published' : 'wp-st-draft'}`}>{p.isDeleted ? "Trash" : p.status}</span>
                    </td>
                    <td className="wp-hide-sm wp-muted">
                      {p.isDeleted ? 'Trashed' : p.status === 'Published' ? 'Published' : 'Last Modified'}<br />
                      {p.isDeleted ? (p.deletedAt ? formatDate(p.deletedAt) : "—") : dateValue ? formatDate(dateValue) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>
    </Page>
    </RequirePermission>
  );
}
