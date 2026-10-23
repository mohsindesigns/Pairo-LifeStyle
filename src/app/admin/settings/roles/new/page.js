"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Page, PageHeader, Postbox } from "@/components/admin/ui";
import { ALL_PERMISSIONS } from "@/lib/rbac";
import { toast } from "react-hot-toast";

export default function CreateRole() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: {}
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success("Role created successfully!");
        router.push("/admin/settings/roles");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create role");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Add new role" />
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/admin/settings/roles" className="wp-link">← Back to Roles</Link>
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: 760 }}>
        <Postbox title="Role details">
          <div className="wp-frow">
            <label htmlFor="role-name" className="wp-flabel">Role name <span className="wp-muted">(required)</span></label>
            <input
              id="role-name"
              type="text"
              required
              placeholder="e.g. Marketing Manager"
              className="wp-input"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="wp-frow" style={{ alignItems: "flex-start" }}>
            <label htmlFor="role-description" className="wp-flabel" style={{ paddingTop: 6 }}>Description</label>
            <textarea
              id="role-description"
              rows={3}
              className="wp-textarea"
              style={{ flex: "1 1 320px", width: "auto", minWidth: 0 }}
              placeholder="What can users with this role do?"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </Postbox>

        <div className="wp-notice wp-notice-info">
          <p>You will be able to configure granular permissions on the Roles screen after the role is created.</p>
        </div>

        <button type="submit" disabled={loading} className="wp-btn wp-btn-primary">
          {loading ? "Creating…" : "Add new role"}
        </button>
      </form>
    </Page>
  );
}
