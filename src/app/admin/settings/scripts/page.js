"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Page, PageHeader } from "@/components/admin/ui";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

export default function ScriptManagementPage() {
  const { can } = useRBAC();
  const { showConfirm } = usePopup();
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/scripts");
      const data = await res.json();
      if (res.ok) setScripts(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load scripts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchScripts();
    });
  }, [fetchScripts]);

  const toggleStatus = async (script) => {
    try {
      const res = await fetch(`/api/admin/scripts/${script._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !script.isActive })
      });
      if (res.ok) {
        toast.success(`${script.name || "Script"} ${!script.isActive ? 'activated' : 'deactivated'}`);
        fetchScripts();
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const deleteScript = async (id) => {
    const ok = await showConfirm("Are you sure you want to delete this script? This will stop tracking immediately.");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/scripts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Script deleted");
        fetchScripts();
      }
    } catch (err) {
      toast.error("Failed to delete script");
    }
  };

  const label = (v) => String(v || "").replace(/_/g, " ");
  const term = search.toLowerCase();
  const filteredScripts = (Array.isArray(scripts) ? scripts : []).filter(s =>
    s && (
      String(s.name || "").toLowerCase().includes(term) ||
      String(s.type || "").toLowerCase().includes(term)
    )
  );

  const visibleIds = filteredScripts.map(s => s._id);
  const selectedVisible = selectedIds.filter(id => visibleIds.includes(id));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : visibleIds);
  };

  const applyBulkAction = async () => {
    const ids = selectedVisible;
    if (!bulkAction) return toast.error("Choose a bulk action first.");
    if (ids.length === 0) return toast.error("Select at least one script.");

    if (bulkAction === "delete") {
      const ok = await showConfirm(
        `Permanently delete ${ids.length} script${ids.length === 1 ? "" : "s"}? This will stop tracking immediately and cannot be undone.`,
        "Delete scripts",
        { confirmText: "Delete", danger: true }
      );
      if (!ok) return;
    }

    setBulkRunning(true);
    let success = 0;
    const failures = [];
    for (const id of ids) {
      const script = scripts.find(s => s?._id === id);
      const name = script?.name || "Untitled script";
      try {
        const res = bulkAction === "delete"
          ? await fetch(`/api/admin/scripts/${id}`, { method: 'DELETE' })
          : await fetch(`/api/admin/scripts/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive: bulkAction === "activate" })
            });
        if (res.ok) {
          success++;
        } else {
          const data = await res.json().catch(() => ({}));
          failures.push(`${name}: ${data.error || `HTTP ${res.status}`}`);
        }
      } catch {
        failures.push(`${name}: network error`);
      }
    }
    setBulkRunning(false);
    setSelectedIds([]);
    setBulkAction("");
    await fetchScripts();

    const verb = bulkAction === "delete" ? "deleted" : bulkAction === "activate" ? "activated" : "paused";
    if (success > 0) toast.success(`${success} script${success === 1 ? "" : "s"} ${verb}.`);
    if (failures.length > 0) {
      toast.error(`${failures.length} failed: ${failures.slice(0, 3).join("; ")}${failures.length > 3 ? "…" : ""}`);
    }
  };

  const activeCount = scripts.filter(s => s.isActive).length;

  const headerRow = (
    <tr>
      <td className="wp-check-col"><input type="checkbox" aria-label="Select all scripts" checked={allSelected} onChange={toggleSelectAll} disabled={visibleIds.length === 0} /></td>
      <th scope="col">Name</th>
      <th scope="col" className="wp-hide-sm">Type</th>
      <th scope="col" className="wp-hide-sm">Placement</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Priority</th>
    </tr>
  );

  return (
    <RequirePermission permission="scripts.view">
    <Page>
      <PageHeader
        title="Scripts"
        actions={<Link href="/admin/settings/scripts/new" className="wp-btn">Add new script</Link>}
      />
      <p className="wp-muted" style={{ margin: "0 0 6px" }}>
        Manage tracking pixels, analytics, and custom injections across the store.
      </p>

      <div className="wp-subsub" aria-label="Script counts">
        <span className="is-current">All <span className="wp-count">({scripts.length})</span></span>
        <span className="wp-sep" aria-hidden="true">|</span>
        <span>Active <span className="wp-count">({activeCount})</span></span>
        <span className="wp-sep" aria-hidden="true">|</span>
        <span>Paused <span className="wp-count">({scripts.length - activeCount})</span></span>
      </div>

      <div className="wp-toolbar">
        <label htmlFor="scripts-bulk-action" className="sr-only">Select bulk action</label>
        <select id="scripts-bulk-action" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
          <option value="">Bulk actions</option>
          <option value="activate">Activate</option>
          <option value="pause">Pause</option>
          <option value="delete">Delete</option>
        </select>
        <button type="button" className="wp-btn" onClick={applyBulkAction} disabled={bulkRunning}>
          {bulkRunning ? "Applying…" : "Apply"}
        </button>
        <span className="wp-spacer" />
        <div className="wp-search" role="search">
          <label htmlFor="scripts-search" className="sr-only">Filter scripts</label>
          <input
            id="scripts-search"
            type="search"
            className="wp-input"
            placeholder="Filter scripts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="wp-muted">Fetching scripts…</td></tr>
            ) : filteredScripts.length === 0 ? (
              <tr><td colSpan={6} className="wp-muted">No scripts found.</td></tr>
            ) : (
              filteredScripts.map((s) => (
                <tr key={s._id}>
                  <td className="wp-check-col"><input type="checkbox" aria-label={`Select ${s.name || "script"}`} checked={selectedIds.includes(s._id)} onChange={() => toggleSelect(s._id)} /></td>
                  <td style={{ wordBreak: "break-word" }}>
                    <Link href={`/admin/settings/scripts/${s._id}`} className="wp-row-title">{s.name || "(no name)"}</Link>
                    <div className="wp-mobile-meta">
                      <span className="capitalize">{label(s.type) || "—"}</span> · <span className="capitalize">{label(s.location) || "—"}</span>
                    </div>
                    <div className="wp-row-actions">
                      <Link href={`/admin/settings/scripts/${s._id}`}>Edit</Link>
                      <button type="button" onClick={() => toggleStatus(s)}>{s.isActive ? 'Pause' : 'Activate'}</button>
                      <button type="button" className="is-danger" onClick={() => deleteScript(s._id)}>Delete</button>
                    </div>
                  </td>
                  <td className="wp-hide-sm capitalize">{label(s.type) || "—"}</td>
                  <td className="wp-hide-sm capitalize">{label(s.location) || "—"}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleStatus(s)}
                      title={s.isActive ? "Click to pause" : "Click to activate"}
                      aria-label={`Status: ${s.isActive ? 'Active' : 'Paused'}. Toggle status`}
                      className={`wp-pill wp-pill-sm ${s.isActive ? 'wp-st-published' : 'wp-st-draft'}`}
                      style={{ border: 0, cursor: "pointer" }}
                    >
                      {s.isActive ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="wp-hide-sm" style={{ fontFamily: "Menlo, Consolas, monospace" }}>{s.priority}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-muted">Secure sandbox enabled</span>
        <span className="wp-spacer" />
        <span className="wp-muted">{scripts.length} item{scripts.length === 1 ? "" : "s"}</span>
      </div>
    </Page>
    </RequirePermission>
  );
}
