"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Page, PageHeader, Postbox, Notice } from "@/components/admin/ui";
import { toast } from "react-hot-toast";
import RequirePermission from "@/components/admin/RequirePermission";
import PermissionMatrix, { countPermissions, TOTAL_PERMISSIONS } from "../PermissionMatrix";

export default function CreateRole() {
  return (
    <RequirePermission permission="staff.manage_roles">
      <CreateRoleForm />
    </RequirePermission>
  );
}

function CreateRoleForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: "", description: "", permissions: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!formData.name.trim()) {
      setError("Role name is required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Role created successfully!");
        router.push("/admin/settings/roles");
        return;
      }
      setError(data.error || "Failed to create role.");
    } catch (err) {
      console.error(err);
      setError("Failed to create role.");
    } finally {
      setLoading(false);
    }
  };

  const granted = countPermissions(formData.permissions);

  return (
    <Page>
      <PageHeader title="Add new role" />
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/admin/settings/roles" className="wp-link">← Back to Roles</Link>
      </p>

      {error && <Notice type="error" onDismiss={() => setError("")}>{error}</Notice>}

      <form onSubmit={handleSubmit} className="wp-cols">
        <div className="wp-col-main">
          <Postbox id="role-details" title="Role details">
            <div className="wp-field">
              <label htmlFor="role-name" className="wp-label">Role name <span className="wp-muted" style={{ fontWeight: 400 }}>(required)</span></label>
              <input
                id="role-name"
                type="text"
                required
                placeholder="e.g. Marketing Manager"
                className="wp-input wp-full"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="wp-field" style={{ marginBottom: 0 }}>
              <label htmlFor="role-description" className="wp-label">Description</label>
              <textarea
                id="role-description"
                rows={3}
                className="wp-textarea"
                placeholder="What can users with this role do?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </Postbox>

          <Postbox id="role-permissions" title="Permissions" aside={`${granted}/${TOTAL_PERMISSIONS} granted`}>
            <PermissionMatrix
              permissions={formData.permissions}
              idPrefix="new-role"
              onChange={(permissions) => setFormData({ ...formData, permissions })}
            />
          </Postbox>
        </div>

        <div className="wp-col-side">
          <Postbox
            id="role-publish"
            title="Publish"
            flush
            footer={
              <>
                <Link href="/admin/settings/roles" className="wp-link" style={{ color: "var(--wp-danger)" }}>Cancel</Link>
                <span className="wp-spacer" />
                <button type="submit" disabled={loading} className="wp-btn wp-btn-primary">
                  {loading ? "Creating…" : "Add new role"}
                </button>
              </>
            }
          >
            <div className="wp-misc">
              <div className="wp-misc-row"><span>Type:</span><span className="wp-strong">Custom</span></div>
              <div className="wp-misc-row"><span>Permissions:</span><span className="wp-strong">{granted} of {TOTAL_PERMISSIONS}</span></div>
            </div>
          </Postbox>
        </div>
      </form>
    </Page>
  );
}
