"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Page, PageHeader, Postbox, Notice, Skeleton } from "@/components/admin/ui";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import { useRBAC } from "@/hooks/useRBAC";
import RequirePermission from "@/components/admin/RequirePermission";
import PermissionMatrix, { countPermissions, TOTAL_PERMISSIONS } from "./PermissionMatrix";

async function readError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

// Why the role can't be trashed/deleted, or "" when it can (the server re-checks).
function removalBlock(role) {
  if (role.isSystem) return "System role";
  const total = (role.staffCount || 0) + (role.trashedStaffCount || 0);
  if (total > 0) return `In use by ${total} user${total === 1 ? "" : "s"}`;
  return "";
}

export default function RoleManagement() {
  return (
    <RequirePermission permission={["staff.view", "staff.manage_roles"]}>
      <RoleManagementScreen />
    </RequirePermission>
  );
}

function RoleManagementScreen() {
  const { showConfirm } = usePopup();
  const { can } = useRBAC();
  const canManage = can("staff.manage_roles");
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  const fetchRoles = useCallback(async (selectId) => {
    try {
      const res = await fetch("/api/admin/roles?withTrashed=1");
      if (!res.ok) throw new Error(await readError(res, "Failed to load roles."));
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRoles(list);
      setLoadError("");
      setSelectedId((prev) => {
        const wanted = selectId || prev;
        const live = list.filter((r) => !r.isDeleted);
        return live.some((r) => r._id === wanted) ? wanted : live[0]?._id || null;
      });
    } catch (err) {
      setLoadError(err.message || "Failed to load roles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchRoles());
  }, [fetchRoles]);

  // Editing copy of the selected role (name, description, permissions).
  const selectedRole = roles.find((r) => r._id === selectedId) || null;
  useEffect(() => {
    Promise.resolve().then(() => {
      setDraft(selectedRole ? {
        _id: selectedRole._id,
        name: selectedRole.name || "",
        description: selectedRole.description || "",
        permissions: { ...(selectedRole.permissions || {}) },
      } : null);
    });
  }, [selectedRole]);

  const liveRoles = roles.filter((r) => !r.isDeleted);
  const trashedRoles = roles.filter((r) => r.isDeleted);
  const isTrash = view === "trash";
  const visible = isTrash ? trashedRoles : view === "custom" ? liveRoles.filter((r) => !r.isSystem) : liveRoles;

  const changeView = (next) => {
    setSelectedIds([]);
    setBulkAction("Bulk actions");
    setView(next);
  };

  // --- requests (throw on failure) ---
  const trashRole = async (id) => {
    const res = await fetch(`/api/admin/roles/${id}?mode=trash`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readError(res, "Failed to move role to the Trash."));
  };
  const restoreRole = async (id) => {
    const res = await fetch(`/api/admin/roles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeleted: false }),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to restore role."));
  };
  const deleteRolePermanently = async (id) => {
    const res = await fetch(`/api/admin/roles/${id}?mode=permanent`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readError(res, "Failed to delete role."));
  };

  const run = async (fn, success) => {
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(err.message);
    }
    fetchRoles();
  };

  const handleTrash = async (role) => {
    const block = removalBlock(role);
    if (block) return toast.error(`${role.name}: ${block}. ${role.isSystem ? "System roles can't be removed." : "Assign those users another role first."}`);
    const ok = await showConfirm(`The "${role.name}" role will be moved to the Trash. You can restore it later.`, "Move to Trash?", { confirmText: "Move to Trash", danger: true });
    if (ok) run(() => trashRole(role._id), `"${role.name}" moved to the Trash.`);
  };

  const handleRestore = (role) => run(() => restoreRole(role._id), `"${role.name}" restored.`);

  const handleDeletePermanently = async (role) => {
    const ok = await showConfirm(`The "${role.name}" role will be deleted permanently. This cannot be undone.`, "Delete permanently?", { confirmText: "Delete Permanently", danger: true });
    if (ok) run(() => deleteRolePermanently(role._id), "Role deleted permanently.");
  };

  const handleDuplicate = async (role) => {
    try {
      const res = await fetch(`/api/admin/roles/${role._id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Failed to duplicate role."));
      const copy = await res.json();
      toast.success(`Created "${copy.name}". Adjust its permissions below.`);
      setView("all");
      await fetchRoles(copy._id);
      document.getElementById("role-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast.error("Role name is required.");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/roles/${draft._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, description: draft.description, permissions: draft.permissions }),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to save role."));
      toast.success("Role saved.");
      fetchRoles(draft._id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const BULK = {
    "Move to Trash": { verb: "moved to the Trash", run: trashRole },
    Restore: { verb: "restored", run: restoreRole },
    "Delete Permanently": { verb: "deleted permanently", run: deleteRolePermanently },
  };

  const handleBulk = async () => {
    const def = BULK[bulkAction];
    if (!def || selectedIds.length === 0) return;
    const n = selectedIds.length;
    const label = `${n} role${n === 1 ? "" : "s"}`;
    const ok = bulkAction === "Restore"
      ? await showConfirm(`Restore ${label}?`)
      : await showConfirm(
        bulkAction === "Delete Permanently" ? `${label} will be deleted permanently. This cannot be undone.` : `${label} will be moved to the Trash.`,
        bulkAction === "Delete Permanently" ? "Delete permanently?" : "Move to Trash?",
        { confirmText: bulkAction, danger: true }
      );
    if (!ok) return;
    let done = 0;
    const failures = [];
    for (const id of selectedIds) {
      const role = roles.find((r) => r._id === id);
      try {
        await def.run(id);
        done++;
      } catch (err) {
        failures.push(`${role?.name || id}: ${err.message}`);
      }
    }
    setSelectedIds([]);
    setBulkAction("Bulk actions");
    fetchRoles();
    if (done) toast.success(`${done} role${done === 1 ? "" : "s"} ${def.verb}.`);
    if (failures.length) toast.error(`${failures.length} failed — ${failures.slice(0, 3).join("; ")}${failures.length > 3 ? "; …" : ""}`, { duration: 8000 });
  };

  const selectable = visible.filter((r) => isTrash || !removalBlock(r));
  const allSelected = selectable.length > 0 && selectable.every((r) => selectedIds.includes(r._id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : selectable.map((r) => r._id));
  const toggleOne = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const viewLink = (key, label, count) => (
    view === key ? (
      <span className="is-current" aria-current="page">{label} <span className="wp-count">({count})</span></span>
    ) : (
      <button type="button" onClick={() => changeView(key)}>{label} <span className="wp-count">({count})</span></button>
    )
  );

  const headerRow = (
    <tr>
      {canManage && (
        <th className="wp-check-col">
          <input type="checkbox" aria-label="Select all roles" checked={allSelected} disabled={selectable.length === 0} onChange={toggleAll} />
        </th>
      )}
      <th scope="col">Role</th>
      <th scope="col" className="wp-hide-sm">Description</th>
      <th scope="col">Type</th>
      <th scope="col" className="wp-num" style={{ textAlign: "right" }}>Users</th>
      <th scope="col" className="wp-num wp-hide-sm" style={{ textAlign: "right" }}>Permissions</th>
    </tr>
  );
  const colCount = canManage ? 6 : 5;

  const isSuperAdminDraft = selectedRole?.slug === "super-admin";

  return (
    <Page>
      <PageHeader
        title="Roles"
        actions={canManage ? <Link href="/admin/settings/roles/new" className="wp-btn">Add new role</Link> : null}
      />

      {loadError && <Notice type="error" onDismiss={() => setLoadError("")}>{loadError}</Notice>}

      <div className="wp-subsub">
        {viewLink("all", "All", liveRoles.length)}
        <span className="wp-sep" aria-hidden="true">|</span>
        {viewLink("custom", "Custom", liveRoles.filter((r) => !r.isSystem).length)}
        <span className="wp-sep" aria-hidden="true">|</span>
        {viewLink("trash", "Trash", trashedRoles.length)}
      </div>

      {canManage && (
        <div className="wp-toolbar">
          <label htmlFor="roles-bulk" className="sr-only">Select bulk action</label>
          <select id="roles-bulk" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
            <option>Bulk actions</option>
            {isTrash ? (
              <>
                <option>Restore</option>
                <option>Delete Permanently</option>
              </>
            ) : (
              <option>Move to Trash</option>
            )}
          </select>
          <button type="button" className="wp-btn" onClick={handleBulk}>Apply</button>
          <span className="wp-spacer" />
          <span className="wp-pages">{visible.length} item{visible.length === 1 ? "" : "s"}</span>
        </div>
      )}

      <div className="wp-table-box" style={{ marginBottom: 20 }}>
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i}><td colSpan={colCount}><Skeleton height={18} /></td></tr>
              ))
            ) : visible.length === 0 ? (
              <tr><td colSpan={colCount} className="wp-muted" style={{ padding: 20, textAlign: "center" }}>{isTrash ? "No roles found in Trash." : "No roles found."}</td></tr>
            ) : visible.map((role) => {
              const isSelected = !isTrash && selectedId === role._id;
              const block = removalBlock(role);
              const permCount = role.slug === "super-admin" ? "All" : `${countPermissions(role.permissions)}/${TOTAL_PERMISSIONS}`;
              const users = role.staffCount || 0;
              return (
                <tr key={role._id} className={isSelected || selectedIds.includes(role._id) ? "is-selected" : undefined}>
                  {canManage && (
                    <td className="wp-check-col">
                      <input
                        type="checkbox"
                        aria-label={`Select ${role.name}`}
                        checked={selectedIds.includes(role._id)}
                        disabled={!isTrash && Boolean(block)}
                        title={!isTrash && block ? block : undefined}
                        onChange={() => toggleOne(role._id)}
                      />
                    </td>
                  )}
                  <td>
                    {isTrash ? (
                      <span className="wp-row-title" style={{ color: "inherit", overflowWrap: "anywhere" }}>{role.name}</span>
                    ) : (
                      <button
                        type="button"
                        className="wp-row-title"
                        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", overflowWrap: "anywhere" }}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedId(role._id)}
                      >
                        {role.name}
                      </button>
                    )}
                    {isSelected && <span className="wp-muted"> — Editing</span>}
                    {role.description && <div className="wp-mobile-meta">{role.description}</div>}
                    <div className="wp-row-actions">
                      {isTrash ? (
                        <>
                          <button type="button" onClick={() => handleRestore(role)}>Restore</button>
                          <button type="button" className="is-danger" onClick={() => handleDeletePermanently(role)}>Delete Permanently</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => {
                            setSelectedId(role._id);
                            document.getElementById("role-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}>
                            {canManage ? "Edit" : "View permissions"}
                          </button>
                          {canManage && <button type="button" onClick={() => handleDuplicate(role)}>Duplicate</button>}
                          {canManage && (block
                            ? <span className="is-muted">{block}</span>
                            : <button type="button" className="is-danger" onClick={() => handleTrash(role)}>Trash</button>)}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="wp-hide-sm">{role.description || <span className="wp-muted">—</span>}</td>
                  <td>
                    {role.isSystem ? (
                      <span className="inline-flex items-center gap-1 wp-muted" style={{ whiteSpace: "nowrap" }}><Lock className="w-3 h-3" aria-hidden="true" /> System</span>
                    ) : (
                      "Custom"
                    )}
                  </td>
                  <td className="wp-num">
                    {users}
                    {role.trashedStaffCount ? <div className="wp-muted wp-small">+{role.trashedStaffCount} in Trash</div> : null}
                  </td>
                  <td className="wp-num wp-hide-sm">{permCount}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      {!isTrash && draft && selectedRole && (
        <Postbox
          id="role-editor"
          title={`${canManage ? "Edit role" : "Permissions"} — ${selectedRole.name}`}
          aside={selectedRole.isSystem ? "System role" : `${selectedRole.staffCount || 0} user${selectedRole.staffCount === 1 ? "" : "s"}`}
          footer={canManage ? (
            <>
              {removalBlock(selectedRole) ? (
                <span className="wp-muted wp-small">{removalBlock(selectedRole)} — can&apos;t be trashed</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTrash(selectedRole)}
                  className="wp-link"
                  style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--wp-danger)", minHeight: 30 }}
                >
                  Move to Trash
                </button>
              )}
              <span className="wp-spacer" />
              <button type="button" className="wp-btn" onClick={() => handleDuplicate(selectedRole)}>Duplicate</button>
              <button type="button" onClick={handleSave} disabled={saving} className="wp-btn wp-btn-primary">
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          ) : undefined}
        >
          <div className="grid gap-x-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div className="wp-field">
              <label htmlFor="role-edit-name" className="wp-label">Role name</label>
              <input
                id="role-edit-name"
                type="text"
                className="wp-input wp-full"
                value={draft.name}
                disabled={!canManage || selectedRole.isSystem}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              {selectedRole.isSystem && <p className="wp-desc">System role names can&apos;t be changed.</p>}
            </div>
            <div className="wp-field">
              <label htmlFor="role-edit-desc" className="wp-label">Description</label>
              <input
                id="role-edit-desc"
                type="text"
                className="wp-input wp-full"
                value={draft.description}
                disabled={!canManage}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
          </div>

          <h3 className="wp-label" style={{ margin: "4px 0 8px" }}>Permissions</h3>
          {isSuperAdminDraft ? (
            <div className="wp-notice wp-notice-info" style={{ margin: 0 }}>
              <p>
                <span className="wp-strong">Full access enabled.</span> The Super Admin role bypasses all permission checks and has full access to every module by default. Individual permissions cannot be toggled for this role.
              </p>
            </div>
          ) : (
            <PermissionMatrix
              permissions={draft.permissions}
              disabled={!canManage}
              idPrefix={`role-${draft._id}`}
              onChange={(permissions) => setDraft({ ...draft, permissions })}
            />
          )}
        </Postbox>
      )}
      {!isTrash && !loading && !selectedRole && liveRoles.length > 0 && (
        <p className="wp-empty">Select a role to manage permissions.</p>
      )}
    </Page>
  );
}
