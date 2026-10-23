"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Page, PageHeader, Postbox, Notice, Skeleton, formatDate } from "@/components/admin/ui";
import { toast } from "react-hot-toast";
import RequirePermission from "@/components/admin/RequirePermission";
import { useRBAC } from "@/hooks/useRBAC";
import { usePopup } from "@/context/PopupContext";

async function readError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export default function EditStaff() {
  return (
    <RequirePermission permission="staff.view">
      <EditStaffForm />
    </RequirePermission>
  );
}

function EditStaffForm() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const { can, session } = useRBAC();
  const { showConfirm } = usePopup();
  const canEdit = can("staff.edit");
  const canDelete = can("staff.delete");
  const canChangeRole = can("staff.manage_roles");
  const currentUserId = session?.user?.id || session?.user?._id;
  const currentIsSuperAdmin = (session?.user?.role?.slug || session?.user?.roleId?.slug) === "super-admin";

  const [roles, setRoles] = useState([]);
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", roleId: "", status: "Active", password: "" });

  const load = useCallback(async () => {
    try {
      const [rolesRes, staffRes] = await Promise.all([
        fetch("/api/admin/roles"),
        fetch(`/api/admin/staff/${id}`),
      ]);
      if (!staffRes.ok) throw new Error(await readError(staffRes, "User not found."));
      const staffData = await staffRes.json();
      const rolesData = rolesRes.ok ? await rolesRes.json().catch(() => []) : [];
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setStaff(staffData);
      setFormData({
        name: staffData.name || "",
        email: staffData.email || "",
        roleId: staffData.roleId?._id || staffData.roleId || "",
        status: staffData.status || "Active",
        password: "",
      });
      setLoadError("");
    } catch (err) {
      setLoadError(err.message || "Error loading user details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) Promise.resolve().then(() => load());
  }, [id, load]);

  const isTrashed = Boolean(staff?.isDeleted);
  const targetIsSuperAdmin = staff?.roleId?.slug === "super-admin";
  const isSelf = Boolean(currentUserId) && String(currentUserId) === String(id);
  const canTrash = canDelete && !isSelf && (!targetIsSuperAdmin || currentIsSuperAdmin);
  const canSetPassword = canEdit && (!targetIsSuperAdmin || currentIsSuperAdmin);
  const lockStatus = isSelf || targetIsSuperAdmin;
  const readOnly = !canEdit || isTrashed;

  // The current role must stay selectable even if the picker list doesn't include it.
  const roleOptions = roles.some((r) => r._id === formData.roleId) || !staff?.roleId?._id
    ? roles
    : [staff.roleId, ...roles];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (formData.password && formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      const body = { name: formData.name, email: formData.email, roleId: formData.roleId };
      if (!lockStatus) body.status = formData.status;
      if (formData.password) body.password = formData.password;
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to update user."));
      toast.success("User updated.");
      setShowPassword(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTrash = async () => {
    const ok = await showConfirm(
      `${staff.name} will be moved to the Trash. They are signed out right away and can't sign in until restored.`,
      "Move to Trash?",
      { confirmText: "Move to Trash", danger: true }
    );
    if (!ok) return;
    const res = await fetch(`/api/admin/staff/${id}?mode=trash`, { method: "DELETE" });
    if (!res.ok) return toast.error(await readError(res, "Failed to move user to the Trash."));
    toast.success(`${staff.name} moved to the Trash.`);
    router.push("/admin/settings/team");
  };

  const handleRestore = async () => {
    const res = await fetch(`/api/admin/staff/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeleted: false }),
    });
    if (!res.ok) return toast.error(await readError(res, "Failed to restore user."));
    toast.success(`${staff.name} restored.`);
    load();
  };

  const handleDeletePermanently = async () => {
    const ok = await showConfirm(`${staff.name} will be deleted permanently. This cannot be undone.`, "Delete permanently?", { confirmText: "Delete Permanently", danger: true });
    if (!ok) return;
    const res = await fetch(`/api/admin/staff/${id}?mode=permanent`, { method: "DELETE" });
    if (!res.ok) return toast.error(await readError(res, "Failed to delete user."));
    toast.success("User deleted permanently.");
    router.push("/admin/settings/team");
  };

  if (loading) {
    return (
      <Page>
        <PageHeader title="Edit user" />
        <Postbox title="Account details">
          <Skeleton height={30} style={{ marginBottom: 12 }} />
          <Skeleton height={30} />
        </Postbox>
      </Page>
    );
  }

  if (loadError || !staff) {
    return (
      <Page>
        <PageHeader title="Edit user" actions={<Link href="/admin/settings/team" className="wp-btn">Back to Users</Link>} />
        <Notice type="error">{loadError || "User not found."}</Notice>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Edit user"
        actions={can("staff.create") ? <Link href="/admin/settings/team/new" className="wp-btn">Add new user</Link> : null}
      />
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/admin/settings/team" className="wp-link">← Back to Users</Link>
      </p>

      {isTrashed && (
        <Notice type="warning">This user is in the Trash and can&apos;t sign in. Restore them to make changes.</Notice>
      )}
      {error && <Notice type="error" onDismiss={() => setError("")}>{error}</Notice>}

      <form onSubmit={handleSubmit} className="wp-cols">
        <div className="wp-col-main">
          <Postbox id="user-account" title="Account details">
            <div className="wp-field">
              <label htmlFor="edit-user-name" className="wp-label">Full name <span className="wp-muted" style={{ fontWeight: 400 }}>(required)</span></label>
              <input
                id="edit-user-name"
                type="text"
                required
                disabled={readOnly}
                className="wp-input wp-full"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="wp-field" style={{ marginBottom: 0 }}>
              <label htmlFor="edit-user-email" className="wp-label">Email <span className="wp-muted" style={{ fontWeight: 400 }}>(required)</span></label>
              <input
                id="edit-user-email"
                type="email"
                required
                disabled={readOnly}
                className="wp-input wp-full"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </Postbox>

          {canSetPassword && !isTrashed && (
            <Postbox id="user-password" title="Password">
              <label htmlFor="edit-user-password" className="wp-label">New password</label>
              <div className="flex gap-2">
                <input
                  id="edit-user-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current password"
                  className="wp-input"
                  style={{ flex: 1, minWidth: 0 }}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  className="wp-btn"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="wp-desc">Only fill this in to change the password (at least 6 characters).</p>
            </Postbox>
          )}
        </div>

        <div className="wp-col-side">
          <Postbox
            id="user-publish"
            title="Save"
            flush
            footer={isTrashed ? (
              canDelete ? (
                <>
                  <button type="button" onClick={handleDeletePermanently} className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--wp-danger)", minHeight: 30 }}>
                    Delete Permanently
                  </button>
                  <span className="wp-spacer" />
                  <button type="button" onClick={handleRestore} className="wp-btn wp-btn-primary">Restore</button>
                </>
              ) : undefined
            ) : (
              <>
                {canTrash && (
                  <button type="button" onClick={handleTrash} className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--wp-danger)", minHeight: 30 }}>
                    Move to Trash
                  </button>
                )}
                <span className="wp-spacer" />
                <button type="submit" disabled={saving || !canEdit} className="wp-btn wp-btn-primary">
                  {saving ? "Updating…" : "Update user"}
                </button>
              </>
            )}
          >
            <div className="wp-misc">
              <div className="wp-misc-row">
                <label htmlFor="edit-user-role" style={{ minWidth: 48 }}>Role:</label>
                <select
                  id="edit-user-role"
                  required
                  disabled={readOnly || !canChangeRole}
                  className="wp-select"
                  style={{ flex: "1 1 140px", minWidth: 0 }}
                  value={formData.roleId}
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                >
                  <option value="">Select a role…</option>
                  {roleOptions.map((role) => (
                    <option key={role._id} value={role._id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="wp-misc-row">
                <label htmlFor="edit-user-status" style={{ minWidth: 48 }}>Status:</label>
                {isTrashed ? (
                  <span className="wp-strong">In Trash</span>
                ) : (
                  <select
                    id="edit-user-status"
                    disabled={readOnly || lockStatus}
                    className="wp-select"
                    style={{ flex: "1 1 140px", minWidth: 0 }}
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Locked">Locked</option>
                  </select>
                )}
              </div>
              <div className="wp-misc-row"><span>Last login:</span><span className="wp-strong">{staff.security?.lastLogin ? formatDate(staff.security.lastLogin) : "Never"}</span></div>
              <div className="wp-misc-row"><span>Added:</span><span className="wp-strong">{staff.createdAt ? formatDate(staff.createdAt) : "—"}</span></div>
              {lockStatus && !isTrashed && (
                <p className="wp-desc" style={{ margin: 0 }}>{isSelf ? "You can't suspend your own account." : "Super Admin accounts can't be suspended."}</p>
              )}
              {!canChangeRole && !isTrashed && <p className="wp-desc" style={{ margin: 0 }}>You don&apos;t have permission to change roles.</p>}
              {!canEdit && <p className="wp-desc" style={{ margin: 0 }}>You don&apos;t have permission to edit users.</p>}
            </div>
          </Postbox>
        </div>
      </form>
    </Page>
  );
}
