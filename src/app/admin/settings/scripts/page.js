"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Page, PageHeader, Notice, Skeleton } from "@/components/admin/ui";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

const VIEWS = [
  ["all", "All"],
  ["active", "Active"],
  ["paused", "Paused"],
  ["trash", "Trash"],
];

async function readError(res, fallback) {
  const data = await res.json().catch(() => null);
  return data?.error || `${fallback} (HTTP ${res.status})`;
}

export default function ScriptManagementPage() {
  return (
    <RequirePermission permission="scripts.view">
      <ScriptsList />
    </RequirePermission>
  );
}

function ScriptsList() {
  const { can } = useRBAC();
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  const [busy, setBusy] = useState(false);

  const canCreate = can("scripts.create");
  const canEdit = can("scripts.edit");
  const canDelete = can("scripts.delete");

  const fetchScripts = useCallback(async () => {
    try {
      // scope=all returns trashed scripts too, so every view and count comes from one request.
      const res = await fetch("/api/admin/scripts?scope=all", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Failed to load scripts"));
      const data = await res.json();
      setScripts(Array.isArray(data) ? data : []);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message || "Failed to load scripts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(fetchScripts);
  }, [fetchScripts]);

  // Debounced live search; the Search button applies immediately.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const live = scripts.filter((s) => s && !s.isDeleted);
  const trashed = scripts.filter((s) => s && s.isDeleted);
  const counts = {
    all: live.length,
    active: live.filter((s) => s.isActive).length,
    paused: live.filter((s) => !s.isActive).length,
    trash: trashed.length,
  };
  const inView = view === "trash" ? trashed : view === "active" ? live.filter((s) => s.isActive) : view === "paused" ? live.filter((s) => !s.isActive) : live;
  const term = search.toLowerCase();
  const visible = inView.filter((s) =>
    !term || [s.name, s.type, s.location].some((v) => String(v || "").toLowerCase().includes(term))
  );

  const visibleIds = visible.map((s) => s._id);
  const selectedVisible = selectedIds.filter((id) => visibleIds.includes(id));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : visibleIds);

  const switchView = (v) => {
    setView(v);
    setSelectedIds([]);
    setBulkAction("");
  };

  // ── single-item requests (each returns the fetch Response) ──
  const setActive = (id, isActive) => fetch(`/api/admin/scripts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  });
  const trashReq = (id) => fetch(`/api/admin/scripts/${id}`, { method: "DELETE" });
  const restoreReq = (id) => fetch(`/api/admin/scripts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "restore" }),
  });
  const permanentReq = (id) => fetch(`/api/admin/scripts/${id}?permanent=true`, { method: "DELETE" });

  const runSingle = async (request, success, failure) => {
    try {
      const res = await request();
      if (!res.ok) throw new Error(await readError(res, failure));
      toast.success(success);
      await fetchScripts();
    } catch (err) {
      toast.error(err.message || failure);
    }
  };

  const toggleStatus = (s) =>
    runSingle(() => setActive(s._id, !s.isActive), `${s.name || "Script"} ${s.isActive ? "paused" : "activated"}`, "Failed to update status");

  const trashScript = async (s) => {
    const ok = await showConfirm(
      `Move "${s.name}" to the Trash? It stops loading on the store immediately. You can restore it from the Trash.`,
      "Move to Trash",
      { confirmText: "Move to Trash", danger: true }
    );
    if (ok) runSingle(() => trashReq(s._id), "Script moved to the Trash", "Failed to trash script");
  };

  const restoreScript = (s) => runSingle(() => restoreReq(s._id), "Script restored (paused)", "Failed to restore script");

  const deletePermanently = async (s) => {
    const ok = await showConfirm(`Permanently delete "${s.name}"? This cannot be undone.`, "Delete permanently", { confirmText: "Delete permanently", danger: true });
    if (ok) runSingle(() => permanentReq(s._id), "Script permanently deleted", "Failed to delete script");
  };

  const duplicateScript = async (s) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/scripts/${s._id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Failed to duplicate script"));
      const copy = await res.json();
      toast.success(`Created "${copy.name}" (paused)`);
      router.push(`/admin/settings/scripts/${copy._id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const bulkOptions = view === "trash"
    ? [canEdit && ["restore", "Restore"], canDelete && ["permanent", "Delete permanently"]]
    : [canEdit && ["activate", "Activate"], canEdit && ["pause", "Pause"], canDelete && ["trash", "Move to Trash"]];
  const bulkChoices = bulkOptions.filter(Boolean);

  const applyBulkAction = async () => {
    const ids = selectedVisible;
    if (!bulkAction) return toast.error("Choose a bulk action first.");
    if (ids.length === 0) return toast.error("Select at least one script.");
    const n = `${ids.length} script${ids.length === 1 ? "" : "s"}`;
    if (bulkAction === "permanent") {
      const ok = await showConfirm(`Permanently delete ${n}? This cannot be undone.`, "Delete permanently", { confirmText: "Delete permanently", danger: true });
      if (!ok) return;
    } else if (bulkAction === "trash") {
      const ok = await showConfirm(`Move ${n} to the Trash? They stop loading on the store immediately.`, "Move to Trash", { confirmText: "Move to Trash", danger: true });
      if (!ok) return;
    }

    const request = {
      activate: (id) => setActive(id, true),
      pause: (id) => setActive(id, false),
      trash: trashReq,
      restore: restoreReq,
      permanent: permanentReq,
    }[bulkAction];

    setBusy(true);
    let done = 0;
    const failures = [];
    for (const id of ids) {
      const name = scripts.find((s) => s?._id === id)?.name || "Untitled script";
      try {
        const res = await request(id);
        if (res.ok) done++;
        else failures.push(`${name}: ${await readError(res, "failed")}`);
      } catch {
        failures.push(`${name}: network error`);
      }
    }
    setBusy(false);
    setSelectedIds([]);
    setBulkAction("");
    await fetchScripts();

    const msg = [done && `${done} done`, failures.length && `${failures.length} failed`].filter(Boolean).join(", ");
    if (failures.length) toast.error(`${msg} — ${failures.slice(0, 2).join("; ")}${failures.length > 2 ? "…" : ""}`);
    else toast.success(msg);
  };

  const label = (v) => String(v || "").replace(/_/g, " ");
  const showChecks = bulkChoices.length > 0;
  const colCount = (showChecks ? 1 : 0) + 5;

  const headerRow = (
    <tr>
      {showChecks && (
        <td className="wp-check-col"><input type="checkbox" aria-label="Select all scripts" checked={allSelected} onChange={toggleSelectAll} disabled={visibleIds.length === 0 || busy} /></td>
      )}
      <th scope="col">Name</th>
      <th scope="col" className="wp-hide-sm">Type</th>
      <th scope="col" className="wp-hide-sm">Placement</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm wp-num" style={{ width: 80 }}>Priority</th>
    </tr>
  );

  return (
    <Page>
      <PageHeader
        title="Scripts"
        actions={canCreate && <Link href="/admin/settings/scripts/new" className="wp-btn">Add new script</Link>}
      />
      <p className="wp-muted" style={{ margin: "0 0 6px" }}>
        Manage tracking pixels, analytics, and custom injections across the store.
      </p>

      {loadError && <Notice type="error">{loadError}</Notice>}

      <div className="wp-subsub" role="tablist" aria-label="Filter scripts by status">
        {VIEWS.map(([key, text], i) => (
          <span key={key} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button type="button" role="tab" aria-selected={view === key} className={view === key ? "is-current" : undefined} onClick={() => switchView(key)}>
              {text} <span className="wp-count">({counts[key]})</span>
            </button>
          </span>
        ))}
      </div>

      <div className="wp-toolbar">
        {showChecks && (
          <>
            <label htmlFor="scripts-bulk-action" className="sr-only">Select bulk action</label>
            <select id="scripts-bulk-action" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} disabled={busy}>
              <option value="">Bulk actions</option>
              {bulkChoices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button type="button" className="wp-btn" onClick={applyBulkAction} disabled={busy}>
              {busy ? "Applying…" : "Apply"}
            </button>
          </>
        )}
        <span className="wp-spacer" />
        <form className="wp-search" role="search" onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}>
          <label htmlFor="scripts-search" className="sr-only">Search scripts</label>
          <input id="scripts-search" type="search" className="wp-input" placeholder="Search scripts" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button type="submit" className="wp-btn">Search</button>
        </form>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              [0, 1].map((i) => <tr key={i}><td colSpan={colCount}><Skeleton height={18} width={i ? "55%" : "75%"} /></td></tr>)
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="wp-muted">
                  {search ? `No scripts match “${search}”.` : view === "trash" ? "No scripts in the Trash." : "No scripts found."}
                </td>
              </tr>
            ) : (
              visible.map((s) => (
                <tr key={s._id} className={selectedIds.includes(s._id) ? "is-selected" : undefined}>
                  {showChecks && (
                    <td className="wp-check-col"><input type="checkbox" aria-label={`Select ${s.name || "script"}`} checked={selectedIds.includes(s._id)} onChange={() => toggleSelect(s._id)} disabled={busy} /></td>
                  )}
                  <td style={{ wordBreak: "break-word" }}>
                    {s.isDeleted ? (
                      <span className="wp-row-title">{s.name || "(no name)"}</span>
                    ) : (
                      <Link href={`/admin/settings/scripts/${s._id}`} className="wp-row-title">{s.name || "(no name)"}</Link>
                    )}
                    <div className="wp-mobile-meta">
                      <span className="capitalize">{label(s.type) || "—"}</span> · <span className="capitalize">{label(s.location) || "—"}</span> · Priority {s.priority ?? 10}
                    </div>
                    <div className="wp-row-actions">
                      {s.isDeleted ? (
                        <>
                          {canEdit && <span><button type="button" onClick={() => restoreScript(s)} disabled={busy}>Restore</button></span>}
                          {canDelete && <span><button type="button" className="is-danger" onClick={() => deletePermanently(s)} disabled={busy}>Delete permanently</button></span>}
                        </>
                      ) : (
                        <>
                          <span><Link href={`/admin/settings/scripts/${s._id}`}>{canEdit ? "Edit" : "View"}</Link></span>
                          {canCreate && <span><button type="button" onClick={() => duplicateScript(s)} disabled={busy}>Duplicate</button></span>}
                          {canEdit && <span><button type="button" onClick={() => toggleStatus(s)} disabled={busy}>{s.isActive ? "Pause" : "Activate"}</button></span>}
                          {canDelete && <span><button type="button" className="is-danger" onClick={() => trashScript(s)} disabled={busy}>Trash</button></span>}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="wp-hide-sm capitalize">{label(s.type) || "—"}</td>
                  <td className="wp-hide-sm capitalize">{label(s.location) || "—"}</td>
                  <td>
                    {s.isDeleted ? (
                      <span className="wp-pill wp-pill-sm wp-st-cancelled">Trashed</span>
                    ) : canEdit ? (
                      <button
                        type="button"
                        onClick={() => toggleStatus(s)}
                        title={s.isActive ? "Click to pause" : "Click to activate"}
                        aria-label={`Status: ${s.isActive ? "Active" : "Paused"}. Toggle status`}
                        className={`wp-pill wp-pill-sm ${s.isActive ? "wp-st-published" : "wp-st-draft"}`}
                        style={{ border: 0, cursor: "pointer" }}
                        disabled={busy}
                      >
                        {s.isActive ? "Active" : "Paused"}
                      </button>
                    ) : (
                      <span className={`wp-pill wp-pill-sm ${s.isActive ? "wp-st-published" : "wp-st-draft"}`}>{s.isActive ? "Active" : "Paused"}</span>
                    )}
                  </td>
                  <td className="wp-hide-sm wp-num" style={{ fontFamily: "Menlo, Consolas, monospace" }}>{s.priority}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-muted">Scripts run in a secure sandbox. Trashed scripts are paused and never load on the store.</span>
        <span className="wp-spacer" />
        <span className="wp-muted">{visible.length} item{visible.length === 1 ? "" : "s"}</span>
      </div>
    </Page>
  );
}
