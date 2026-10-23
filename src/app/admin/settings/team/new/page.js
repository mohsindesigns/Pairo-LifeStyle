"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Page, PageHeader, Postbox } from "@/components/admin/ui";
import { toast } from "react-hot-toast";
import RequirePermission from "@/components/admin/RequirePermission";

export default function InviteStaff() {
  const router = useRouter();
  const [roles, setRoles] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    roleId: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch("/api/admin/roles");
        if (res.ok) {
          const data = await res.json();
          setRoles(Array.isArray(data) ? data : []);
        } else {
          setRoles([]);
        }
      } catch {
        setRoles([]);
      }
    };
    fetchRoles();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success("Staff member created successfully!");
        router.push("/admin/settings/team");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create staff member");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequirePermission permission="staff.create">
    <Page>
      <PageHeader title="Add new user" />
      <p className="wp-muted" style={{ margin: "0 0 14px" }}>
        Create a brand new staff user and add them to this site. <Link href="/admin/settings/team" className="wp-link">Back to Users</Link>
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: 760 }}>
        <Postbox title="Account details">
          <div className="wp-frow">
            <label htmlFor="new-user-name" className="wp-flabel">Full name <span className="wp-muted">(required)</span></label>
            <input
              id="new-user-name"
              type="text"
              required
              className="wp-input"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="wp-frow">
            <label htmlFor="new-user-email" className="wp-flabel">Email <span className="wp-muted">(required)</span></label>
            <input
              id="new-user-email"
              type="email"
              required
              className="wp-input"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="wp-frow">
            <label htmlFor="new-user-password" className="wp-flabel">Password <span className="wp-muted">(required)</span></label>
            <input
              id="new-user-password"
              type={showPassword ? "text" : "password"}
              required
              className="wp-input"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
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
            <span className="wp-hint">Share this password with the user securely. They can sign in with it right away; you can set a new one later from the Users list.</span>
          </div>
          <div className="wp-frow">
            <label htmlFor="new-user-role" className="wp-flabel">Role</label>
            <select
              id="new-user-role"
              required
              className="wp-select"
              value={formData.roleId}
              onChange={(e) => setFormData({...formData, roleId: e.target.value})}
            >
              <option value="">Select a role…</option>
              {roles.map((role) => (
                <option key={role._id} value={role._id}>{role.name}</option>
              ))}
            </select>
          </div>
        </Postbox>

        <button type="submit" disabled={loading} className="wp-btn wp-btn-primary">
          {loading ? "Adding…" : "Add new user"}
        </button>
      </form>
    </Page>
    </RequirePermission>
  );
}
