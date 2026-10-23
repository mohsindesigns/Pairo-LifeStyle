"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, X } from "lucide-react";
import { Page, PageHeader } from "@/components/admin/ui";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "react-hot-toast";
import RequirePermission from "@/components/admin/RequirePermission";

export default function StaffManagement() {
  const router = useRouter();
  const { session } = useRBAC();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleView, setRoleView] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState({ open: false, id: null, name: "", loading: false });
  const [passwordTarget, setPasswordTarget] = useState({ open: false, id: null, name: "", password: "", showPass: false, loading: false });

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/admin/staff");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setStaff(data);
        } else if (Array.isArray(data?.staff)) {
          setStaff(data.staff);
        } else {
          setStaff([]);
        }
      } else {
        setStaff([]);
      }
    } catch (err) {
      console.error(err);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) fetchStaff();
    });
    return () => {
      active = false;
    };
  }, []);

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    try {
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setStaff(prev => (Array.isArray(prev) ? prev : []).map(s => s._id === id ? { ...s, status: newStatus } : s));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDeleteStaff = async () => {
    if (!deleteTarget.id) return;
    setDeleteTarget(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/admin/staff/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setStaff(prev => (Array.isArray(prev) ? prev : []).filter(s => s._id !== deleteTarget.id));
        toast.success(`Staff member "${deleteTarget.name}" deleted successfully.`);
        setDeleteTarget({ open: false, id: null, name: "", loading: false });
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to delete staff member.");
        setDeleteTarget(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting staff member.");
      setDeleteTarget(prev => ({ ...prev, loading: false }));
    }
  };

  const submitResetPassword = async (e) => {
    e?.preventDefault();
    if (!passwordTarget.password || passwordTarget.password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setPasswordTarget(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/admin/staff/${passwordTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordTarget.password })
      });
      if (res.ok) {
        toast.success(`Password for "${passwordTarget.name}" updated successfully!`);
        setPasswordTarget({ open: false, id: null, name: "", password: "", showPass: false, loading: false });
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reset password");
        setPasswordTarget(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error(err);
      toast.error("Error resetting password");
      setPasswordTarget(prev => ({ ...prev, loading: false }));
    }
  };

  const staffList = Array.isArray(staff) ? staff : [];
  const currentUserId = session?.user?.id || session?.user?._id;

  const filteredStaff = staffList.filter(s => {
    if (!s) return false;
    const nameStr = s.name ? String(s.name).toLowerCase() : "";
    const emailStr = s.email ? String(s.email).toLowerCase() : "";
    const search = searchTerm.toLowerCase();
    return nameStr.includes(search) || emailStr.includes(search);
  });

  const formatDate = (dateVal) => {
    if (!dateVal) return "Never";
    try {
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? "Never" : d.toLocaleDateString();
    } catch {
      return "Never";
    }
  };

  const roleOptions = Array.from(
    new Map(
      staffList
        .filter(s => s?.roleId && typeof s.roleId === "object" && s.roleId.name)
        .map(s => [s.roleId.slug || s.roleId.name, s.roleId.name])
    ).entries()
  );
  const visibleStaff = roleView === "all"
    ? filteredStaff
    : filteredStaff.filter(s => (s?.roleId?.slug || s?.roleId?.name) === roleView);

  const headerRow = (
    <tr>
      <th scope="col">Username</th>
      <th scope="col" className="wp-hide-sm">Email</th>
      <th scope="col">Role</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Last login</th>
    </tr>
  );

  return (
    <RequirePermission permission="staff.view">
    <Page>
      <PageHeader
        title="Users"
        actions={<Link href="/admin/settings/team/new" className="wp-btn">Add new user</Link>}
      />

      <div className="wp-subsub" role="tablist" aria-label="Filter users by role">
        <button type="button" role="tab" aria-selected={roleView === "all"} className={roleView === "all" ? "is-current" : undefined} onClick={() => setRoleView("all")}>
          All <span className="wp-count">({staffList.length})</span>
        </button>
        {roleOptions.map(([key, label]) => (
          <span key={key} style={{ display: "contents" }}>
            <span className="wp-sep" aria-hidden="true">|</span>
            <button type="button" role="tab" aria-selected={roleView === key} className={roleView === key ? "is-current" : undefined} onClick={() => setRoleView(key)}>
              {label} <span className="wp-count">({staffList.filter(s => (s?.roleId?.slug || s?.roleId?.name) === key).length})</span>
            </button>
          </span>
        ))}
        <span className="wp-sep" aria-hidden="true">|</span>
        <span className="wp-muted">Active <span className="wp-count">({staffList.filter(s => s?.status === 'Active').length})</span></span>
        <span className="wp-sep" aria-hidden="true">|</span>
        <span className="wp-muted">Suspended <span className="wp-count">({staffList.filter(s => s?.status && s.status !== 'Active').length})</span></span>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <div className="wp-search" role="search">
          <label htmlFor="team-search" className="sr-only">Search users</label>
          <input
            id="team-search"
            type="search"
            className="wp-input"
            placeholder="Search by name or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="wp-muted">Loading users…</td></tr>
            ) : visibleStaff.length === 0 ? (
              <tr><td colSpan={5} className="wp-muted">No users found.</td></tr>
            ) : (
              visibleStaff.map((s, index) => {
                const isSuperAdmin = s?.roleId?.slug === 'super-admin';
                const isSelf = currentUserId && s?._id === currentUserId;
                const roleName = s?.roleId?.name || (typeof s?.roleId === 'string' ? 'Assigned' : 'No Role');
                const isActive = (s?.status || "Active") === 'Active';

                return (
                  <tr key={s?._id || index}>
                    <td>
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="wp-avatar" aria-hidden="true">{(s?.name || "U").charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <Link href={`/admin/settings/team/${s._id}`} className="wp-row-title" style={{ wordBreak: "break-word" }}>
                            {s?.name || "Unnamed"}
                          </Link>
                          {isSelf && <span className="wp-muted"> — You</span>}
                          <div className="wp-mobile-meta" style={{ wordBreak: "break-all" }}>{s?.email || "No email"}</div>
                          <div className="wp-row-actions">
                            <button type="button" onClick={() => router.push(`/admin/settings/team/${s._id}`)}>Edit</button>
                            {!isSuperAdmin && !isSelf && (
                              <button type="button" onClick={() => toggleStatus(s._id, s.status)}>
                                {s?.status === 'Active' ? 'Suspend' : 'Activate'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPasswordTarget({ open: true, id: s._id, name: s.name, password: "", showPass: false, loading: false })}
                            >
                              Reset password
                            </button>
                            {!isSuperAdmin && !isSelf && (
                              <button
                                type="button"
                                className="is-danger"
                                onClick={() => setDeleteTarget({ open: true, id: s._id, name: s.name, loading: false })}
                              >
                                Delete
                              </button>
                            )}
                            {isSuperAdmin && <span className="is-muted">System protected</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="wp-hide-sm" style={{ wordBreak: "break-all" }}>
                      {s?.email ? <a href={`mailto:${s.email}`} className="wp-link">{s.email}</a> : <span className="wp-muted">No email</span>}
                    </td>
                    <td>{roleName}</td>
                    <td>
                      <span className={`wp-pill wp-pill-sm ${isActive ? 'wp-st-published' : 'wp-st-cancelled'}`}>
                        {s?.status || "Active"}
                      </span>
                    </td>
                    <td className="wp-hide-sm wp-muted" suppressHydrationWarning>
                      {formatDate(s?.security?.lastLogin)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <span className="wp-muted">{visibleStaff.length} item{visibleStaff.length === 1 ? "" : "s"}</span>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget.open && (
        <div
          className="wp-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget && !deleteTarget.loading) setDeleteTarget({ open: false, id: null, name: "", loading: false }); }}
        >
          <div className="wp-modal" style={{ maxWidth: 460 }} role="dialog" aria-modal="true" aria-labelledby="delete-staff-title">
            <div className="wp-modal-head">
              <h2 id="delete-staff-title">Delete user</h2>
              <button
                type="button"
                className="wp-notice-dismiss"
                aria-label="Close"
                disabled={deleteTarget.loading}
                onClick={() => setDeleteTarget({ open: false, id: null, name: "", loading: false })}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="wp-modal-body">
              <p style={{ margin: 0 }}>
                Are you sure you want to delete <span className="wp-strong">{deleteTarget.name}</span>? This action cannot be undone and will revoke their access immediately.
              </p>
            </div>
            <div className="wp-modal-foot">
              <button
                type="button"
                className="wp-btn"
                disabled={deleteTarget.loading}
                onClick={() => setDeleteTarget({ open: false, id: null, name: "", loading: false })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wp-btn wp-btn-primary"
                style={{ background: "#b32d2e", borderColor: "#b32d2e", color: "#fff" }}
                disabled={deleteTarget.loading}
                onClick={confirmDeleteStaff}
              >
                {deleteTarget.loading ? "Deleting…" : "Delete user"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {passwordTarget.open && (
        <div
          className="wp-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget && !passwordTarget.loading) setPasswordTarget({ open: false, id: null, name: "", password: "", showPass: false, loading: false }); }}
        >
          <div className="wp-modal" style={{ maxWidth: 460 }} role="dialog" aria-modal="true" aria-labelledby="reset-pass-title">
            <form onSubmit={submitResetPassword}>
              <div className="wp-modal-head">
                <h2 id="reset-pass-title" style={{ minWidth: 0, wordBreak: "break-word" }}>Set new password — {passwordTarget.name}</h2>
                <button
                  type="button"
                  className="wp-notice-dismiss"
                  aria-label="Close"
                  disabled={passwordTarget.loading}
                  onClick={() => setPasswordTarget({ open: false, id: null, name: "", password: "", showPass: false, loading: false })}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="wp-modal-body">
                <label htmlFor="reset-pass-input" className="wp-label">New password</label>
                <div className="flex gap-2">
                  <input
                    id="reset-pass-input"
                    type={passwordTarget.showPass ? "text" : "password"}
                    autoFocus
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    value={passwordTarget.password}
                    onChange={(e) => setPasswordTarget(prev => ({ ...prev, password: e.target.value }))}
                    className="wp-input"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="button"
                    className="wp-btn"
                    aria-label={passwordTarget.showPass ? "Hide password" : "Show password"}
                    onClick={() => setPasswordTarget(prev => ({ ...prev, showPass: !prev.showPass }))}
                  >
                    {passwordTarget.showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {passwordTarget.showPass ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="wp-desc">Minimum 6 characters.</p>
              </div>
              <div className="wp-modal-foot">
                <button
                  type="button"
                  className="wp-btn"
                  disabled={passwordTarget.loading}
                  onClick={() => setPasswordTarget({ open: false, id: null, name: "", password: "", showPass: false, loading: false })}
                >
                  Cancel
                </button>
                <button type="submit" className="wp-btn wp-btn-primary" disabled={passwordTarget.loading}>
                  {passwordTarget.loading ? "Saving…" : "Update password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Page>
    </RequirePermission>
  );
}
