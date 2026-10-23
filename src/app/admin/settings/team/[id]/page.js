"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Page, PageHeader, Postbox } from "@/components/admin/ui";
import { toast } from "react-hot-toast";
import RequirePermission from "@/components/admin/RequirePermission";
import { useRBAC } from "@/hooks/useRBAC";

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
  const canEdit = can("staff.edit");
  const currentIsSuperAdmin = (session?.user?.role?.slug || session?.user?.roleId?.slug) === "super-admin";
  const [targetIsSuperAdmin, setTargetIsSuperAdmin] = useState(false);

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    roleId: "",
    status: "Active",
    password: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesRes, staffRes] = await Promise.all([
          fetch("/api/admin/roles"),
          fetch(`/api/admin/staff/${id}`),
        ]);

        const rolesData = rolesRes.ok ? await rolesRes.json().catch(() => []) : [];
        const staffData = staffRes.ok ? await staffRes.json().catch(() => ({})) : {};

        setRoles(Array.isArray(rolesData) ? rolesData : []);
        setTargetIsSuperAdmin(staffData.roleId?.slug === "super-admin");
        setFormData({
          name: staffData.name || "",
          email: staffData.email || "",
          roleId: staffData.roleId?._id || staffData.roleId || "",
          status: staffData.status || "Active",
          password: "",
        });
      } catch (err) {
        toast.error("Error loading staff details");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success("Staff member updated successfully");
        router.push("/admin/settings/team");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update staff member");
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Edit user"
        actions={<Link href="/admin/settings/team/new" className="wp-btn">Add new user</Link>}
      />
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/admin/settings/team" className="wp-link">← Back to Users</Link>
      </p>

      {loading ? (
        <Postbox title="Account details">
          <div className="flex items-center gap-2 wp-muted" role="status">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading user…
          </div>
        </Postbox>
      ) : (
        <form onSubmit={handleSubmit} style={{ maxWidth: 760 }}>
          <Postbox title="Name">
            <div className="wp-frow">
              <label htmlFor="edit-user-name" className="wp-flabel">Full name <span className="wp-muted">(required)</span></label>
              <input
                id="edit-user-name"
                type="text"
                required
                className="wp-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="wp-frow">
              <label htmlFor="edit-user-role" className="wp-flabel">Role</label>
              <select
                id="edit-user-role"
                required
                className="wp-select"
                value={formData.roleId}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              >
                <option value="">Select a role…</option>
                {roles.map((role) => (
                  <option key={role._id} value={role._id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="wp-frow">
              <label htmlFor="edit-user-status" className="wp-flabel">Account status</label>
              <select
                id="edit-user-status"
                className="wp-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Locked">Locked</option>
              </select>
            </div>
          </Postbox>

          <Postbox title="Contact info">
            <div className="wp-frow">
              <label htmlFor="edit-user-email" className="wp-flabel">Email <span className="wp-muted">(required)</span></label>
              <input
                id="edit-user-email"
                type="email"
                required
                className="wp-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </Postbox>

          {(!targetIsSuperAdmin || currentIsSuperAdmin) && (
          <Postbox title="Account management">
            <div className="wp-frow">
              <label htmlFor="edit-user-password" className="wp-flabel">New password</label>
              <input
                id="edit-user-password"
                type={showPassword ? "text" : "password"}
                placeholder="Leave blank to keep current password"
                className="wp-input"
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
              <span className="wp-hint">Only fill this in if you want to change the password.</span>
            </div>
          </Postbox>
          )}

          {!canEdit && (
            <p className="wp-desc">You don&apos;t have permission to edit users.</p>
          )}
          <button type="submit" disabled={saving || !canEdit} className="wp-btn wp-btn-primary">
            {saving ? "Updating…" : "Update user"}
          </button>
        </form>
      )}
    </Page>
  );
}
