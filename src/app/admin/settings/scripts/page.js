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

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/scripts");
      const data = await res.json();
      if (res.ok) setScripts(data);
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
        toast.success(`${script.name} ${!script.isActive ? 'activated' : 'deactivated'}`);
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

  const filteredScripts = scripts.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.type.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = scripts.filter(s => s.isActive).length;

  const headerRow = (
    <tr>
      <td className="wp-check-col"><input type="checkbox" aria-label="Select all scripts" /></td>
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
        <select id="scripts-bulk-action" className="wp-select">
          <option>Bulk actions</option>
          <option>Activate</option>
          <option>Deactivate</option>
          <option>Delete</option>
        </select>
        <button type="button" className="wp-btn">Apply</button>
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
                  <td className="wp-check-col"><input type="checkbox" aria-label={`Select ${s.name}`} /></td>
                  <td style={{ wordBreak: "break-word" }}>
                    <Link href={`/admin/settings/scripts/${s._id}`} className="wp-row-title">{s.name}</Link>
                    <div className="wp-mobile-meta">
                      <span className="capitalize">{s.type.replace('_', ' ')}</span> · <span className="capitalize">{s.location.replace('_', ' ')}</span>
                    </div>
                    <div className="wp-row-actions">
                      <Link href={`/admin/settings/scripts/${s._id}`}>Edit</Link>
                      <button type="button" onClick={() => toggleStatus(s)}>{s.isActive ? 'Pause' : 'Activate'}</button>
                      <button type="button" className="is-danger" onClick={() => deleteScript(s._id)}>Delete</button>
                    </div>
                  </td>
                  <td className="wp-hide-sm capitalize">{s.type.replace('_', ' ')}</td>
                  <td className="wp-hide-sm capitalize">{s.location.replace('_', ' ')}</td>
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
