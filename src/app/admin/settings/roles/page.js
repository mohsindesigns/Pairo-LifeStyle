"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Page, PageHeader, Postbox } from "@/components/admin/ui";
import { ALL_PERMISSIONS, ACTIONS } from "@/lib/rbac";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

export default function RoleManagement() {
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/admin/roles");
      if (res.ok) {
        const data = await res.json();
        const rolesList = Array.isArray(data) ? data : [];
        setRoles(rolesList);
        if (rolesList.length > 0 && !selectedRole) setSelectedRole(rolesList[0]);
      } else {
        setRoles([]);
      }
    } catch (err) {
      console.error(err);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchRoles();
    });
  }, []);

  const togglePermission = (module, action) => {
    if (selectedRole?.slug === 'super-admin') return; // Super admin permissions are handled by bypass logic

    const currentPerms = { ...selectedRole.permissions };
    const modulePerms = [...(currentPerms[module] || [])];

    if (modulePerms.includes(action)) {
      currentPerms[module] = modulePerms.filter(a => a !== action);
    } else {
      currentPerms[module] = [...modulePerms, action];
    }

    setSelectedRole({ ...selectedRole, permissions: currentPerms });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/roles/${selectedRole._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedRole)
      });
      if (res.ok) {
        setRoles(roles.map(r => r._id === selectedRole._id ? selectedRole : r));
        toast.success("Permissions saved successfully!");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save permissions");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = () => {
    router.push("/admin/settings/roles/new");
  };

  const deleteRole = async (role) => {
    if (role.isSystem) return toast.error("System roles cannot be deleted.");
    const confirmed = await showConfirm(
      `Are you sure you want to delete the "${role.name}" role?`,
      "Delete Role"
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/roles/${role._id}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = roles.filter(r => r._id !== role._id);
        setRoles(remaining);
        if (selectedRole?._id === role._id) setSelectedRole(remaining[0] || null);
        toast.success("Role deleted successfully.");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete role");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete role");
    }
  };

  const toggleModule = (module) => {
    // Modules default to expanded (undefined === expanded), so the first click collapses.
    setExpandedModules(prev => ({ ...prev, [module]: prev[module] === false }));
  };

  const isModuleExpanded = (module) => expandedModules[module] !== false;

  const prettify = (key) => String(key).replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());

  if (loading) return (
    <Page>
      <PageHeader title="Roles" />
      <p className="wp-muted" role="status">Loading roles…</p>
    </Page>
  );

  const headerRow = (
    <tr>
      <th scope="col">Role</th>
      <th scope="col" className="wp-hide-sm">Description</th>
      <th scope="col">Type</th>
      <th scope="col" className="wp-hide-sm">Permissions</th>
    </tr>
  );

  return (
    <RequirePermission permission={["staff.view", "staff.manage_roles"]}>
    <Page>
      <PageHeader
        title="Roles"
        actions={<button type="button" onClick={handleCreateRole} className="wp-btn">Add new role</button>}
      />

      <div className="wp-table-box" style={{ marginBottom: 20 }}>
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {roles.length === 0 ? (
              <tr><td colSpan={4} className="wp-muted">No roles found.</td></tr>
            ) : roles.map((role) => {
              const isSelected = selectedRole?._id === role._id;
              const permCount = role.slug === 'super-admin'
                ? "All"
                : Object.values(role.permissions || {}).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
              return (
                <tr key={role._id} className={isSelected ? "is-selected" : undefined}>
                  <td>
                    <button
                      type="button"
                      className="wp-row-title"
                      style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", wordBreak: "break-word" }}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedRole(role)}
                    >
                      {role.name}
                    </button>
                    {isSelected && <span className="wp-muted"> — Editing</span>}
                    {role.description && <div className="wp-mobile-meta">{role.description}</div>}
                    <div className="wp-row-actions">
                      <button type="button" onClick={() => setSelectedRole(role)}>Edit permissions</button>
                      {!role.isSystem && (
                        <button type="button" className="is-danger" onClick={() => deleteRole(role)}>Delete</button>
                      )}
                    </div>
                  </td>
                  <td className="wp-hide-sm">{role.description || <span className="wp-muted">—</span>}</td>
                  <td>
                    {role.isSystem ? (
                      <span className="inline-flex items-center gap-1 wp-muted"><Lock className="w-3 h-3" aria-hidden="true" /> System</span>
                    ) : (
                      "Custom"
                    )}
                  </td>
                  <td className="wp-hide-sm">{permCount}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      {selectedRole ? (
        <Postbox
          id="role-editor"
          title={`Permissions — ${selectedRole.name}`}
          aside={selectedRole.isSystem ? "System role" : undefined}
          footer={
            <>
              {!selectedRole.isSystem && (
                <button
                  type="button"
                  onClick={() => deleteRole(selectedRole)}
                  className="wp-link"
                  style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "#b32d2e", minHeight: 30 }}
                >
                  Delete role
                </button>
              )}
              <span className="wp-spacer" />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || selectedRole.slug === 'super-admin'}
                className="wp-btn wp-btn-primary"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          }
        >
          {selectedRole.description && <p className="wp-muted" style={{ margin: "0 0 12px" }}>{selectedRole.description}</p>}

          {selectedRole.slug === 'super-admin' ? (
            <div className="wp-notice wp-notice-info" style={{ margin: 0 }}>
              <p>
                <span className="wp-strong">Full access enabled.</span> The Super Admin role bypasses all permission checks and has full access to every module by default. Individual permissions cannot be toggled for this role.
              </p>
            </div>
          ) : (
            <div style={{ border: "1px solid #dcdcde" }}>
              {Object.entries(ALL_PERMISSIONS).map(([module, actions], i) => {
                const granted = selectedRole?.permissions?.[module]?.length || 0;
                return (
                  <fieldset
                    key={module}
                    className="flex flex-wrap items-start gap-x-4 gap-y-1"
                    style={{
                      margin: 0,
                      padding: "8px 12px",
                      border: 0,
                      borderTop: i === 0 ? 0 : "1px solid #dcdcde",
                      background: i % 2 ? "#f6f7f7" : "#fff",
                      minWidth: 0,
                    }}
                  >
                    <legend className="sr-only">{prettify(module)} permissions</legend>
                    <div className="flex items-center gap-2" style={{ width: 190, flex: "none", minHeight: 26, maxWidth: "100%" }}>
                      <span className="wp-strong">{prettify(module)}</span>
                      <span className="wp-muted wp-small">{granted}/{actions.length}</span>
                      <button
                        type="button"
                        onClick={() => toggleModule(module)}
                        aria-expanded={isModuleExpanded(module)}
                        aria-label={`Toggle ${prettify(module)} permissions`}
                        className="wp-muted"
                        style={{ background: "none", border: 0, padding: 2, cursor: "pointer", display: "inline-flex" }}
                      >
                        {isModuleExpanded(module) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                    {isModuleExpanded(module) && (
                      <div className="flex flex-wrap gap-x-5 gap-y-0" style={{ flex: "1 1 260px", minWidth: 0 }}>
                        {actions.map((action) => {
                          const isChecked = Boolean(selectedRole?.permissions?.[module]?.includes(action));
                          return (
                            <label key={action} className="wp-check">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(module, action)}
                              />
                              <span>{prettify(action)}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                );
              })}
            </div>
          )}
        </Postbox>
      ) : (
        <p className="wp-empty">Select a role to manage permissions.</p>
      )}
    </Page>
    </RequirePermission>
  );
}
