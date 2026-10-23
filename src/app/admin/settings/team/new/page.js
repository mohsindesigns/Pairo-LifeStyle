"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Page, PageHeader, Postbox, Notice } from "@/components/admin/ui";
import { toast } from "react-hot-toast";
import RequirePermission from "@/components/admin/RequirePermission";

function generatePassword(length = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

export default function InviteStaff() {
  return (
    <RequirePermission permission="staff.create">
      <InviteStaffForm />
    </RequirePermission>
  );
}

function InviteStaffForm() {
  const router = useRouter();
  const [roles, setRoles] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", roleId: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch("/api/admin/roles");
        const data = res.ok ? await res.json() : [];
        setRoles(Array.isArray(data) ? data : []);
      } catch {
        setRoles([]);
      }
    };
    fetchRoles();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("User created successfully!");
        router.push(data.id ? `/admin/settings/team/${data.id}` : "/admin/settings/team");
        return;
      }
      setError(data.error || "Failed to create user.");
    } catch (err) {
      console.error(err);
      setError("Failed to create user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Add new user" />
      <p className="wp-muted" style={{ margin: "0 0 14px" }}>
        Create a brand new staff user and add them to this site. <Link href="/admin/settings/team" className="wp-link">Back to Users</Link>
      </p>

      {error && <Notice type="error" onDismiss={() => setError("")}>{error}</Notice>}

      <form onSubmit={handleSubmit} className="wp-cols">
        <div className="wp-col-main">
          <Postbox id="new-user-account" title="Account details">
            <div className="wp-field">
              <label htmlFor="new-user-name" className="wp-label">Full name <span className="wp-muted" style={{ fontWeight: 400 }}>(required)</span></label>
              <input
                id="new-user-name"
                type="text"
                required
                autoComplete="off"
                className="wp-input wp-full"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="wp-field">
              <label htmlFor="new-user-email" className="wp-label">Email <span className="wp-muted" style={{ fontWeight: 400 }}>(required)</span></label>
              <input
                id="new-user-email"
                type="email"
                required
                autoComplete="off"
                className="wp-input wp-full"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="wp-field" style={{ marginBottom: 0 }}>
              <label htmlFor="new-user-password" className="wp-label">Password <span className="wp-muted" style={{ fontWeight: 400 }}>(required)</span></label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="new-user-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="wp-input"
                  style={{ flex: "1 1 200px", minWidth: 0 }}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button type="button" className="wp-btn" onClick={() => { setFormData({ ...formData, password: generatePassword() }); setShowPassword(true); }}>
                  Generate
                </button>
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
              <p className="wp-desc">At least 6 characters. Share it with the user securely; they can sign in right away.</p>
            </div>
          </Postbox>
        </div>

        <div className="wp-col-side">
          <Postbox
            id="new-user-publish"
            title="Publish"
            flush
            footer={
              <>
                <Link href="/admin/settings/team" className="wp-link" style={{ color: "var(--wp-danger)" }}>Cancel</Link>
                <span className="wp-spacer" />
                <button type="submit" disabled={loading} className="wp-btn wp-btn-primary">
                  {loading ? "Adding…" : "Add new user"}
                </button>
              </>
            }
          >
            <div className="wp-misc">
              <div className="wp-misc-row">
                <label htmlFor="new-user-role" style={{ minWidth: 48 }}>Role:</label>
                <select
                  id="new-user-role"
                  required
                  className="wp-select"
                  style={{ flex: "1 1 140px", minWidth: 0 }}
                  value={formData.roleId}
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                >
                  <option value="">Select a role…</option>
                  {roles.map((role) => (
                    <option key={role._id} value={role._id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="wp-misc-row"><span style={{ minWidth: 48 }}>Status:</span><span className="wp-strong">Active</span></div>
            </div>
          </Postbox>
        </div>
      </form>
    </Page>
  );
}
