"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, EyeOff, X } from "lucide-react";
import { Page, PageHeader, Notice, Skeleton, formatDate } from "@/components/admin/ui";
import { useRBAC } from "@/hooks/useRBAC";
import { usePopup } from "@/context/PopupContext";
import { toast } from "react-hot-toast";
import RequirePermission from "@/components/admin/RequirePermission";
import ThemedSelect from "@/components/ui/ThemedSelect";

const PAGE_SIZE = 20;

async function readError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

const EMPTY_PASSWORD = { open: false, id: null, name: "", password: "", showPass: false, loading: false };

export default function StaffManagement() {
  return (
    <RequirePermission permission="staff.view">
      <StaffList />
    </RequirePermission>
  );
}

function StaffList() {
  const { session, can } = useRBAC();
  const { showConfirm } = usePopup();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState("all");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const [passwordTarget, setPasswordTarget] = useState(EMPTY_PASSWORD);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff?withTrashed=1");
      if (!res.ok) throw new Error(await readError(res, "Failed to load users."));
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : Array.isArray(data?.staff) ? data.staff : []);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchStaff());
  }, [fetchStaff]);

  // Live search after a short pause; the Search button / Enter applies immediately.
  useEffect(() => {
    const term = searchInput.trim();
    if (term === searchTerm) return;
    const t = setTimeout(() => {
      setPage(1);
      setSearchTerm(term);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, searchTerm]);

  const runSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchTerm(searchInput.trim());
  };

  const currentUserId = session?.user?.id || session?.user?._id;
  const currentIsSuperAdmin = (session?.user?.role?.slug || session?.user?.roleId?.slug) === "super-admin";
  const canEdit = can("staff.edit");
  const canDelete = can("staff.delete");
  const canCreate = can("staff.create");

  const list = Array.isArray(staff) ? staff : [];
  const live = list.filter((s) => !s.isDeleted);
  const trashed = list.filter((s) => s.isDeleted);
  const isTrash = view === "trash";
  const counts = {
    all: live.length,
    active: live.filter((s) => (s.status || "Active") === "Active").length,
    suspended: live.filter((s) => s.status && s.status !== "Active").length,
    trash: trashed.length,
  };

  const roleKey = (s) => s?.roleId?.slug || s?.roleId?.name || "";
  const roleOptions = Array.from(
    new Map(list.filter((s) => s?.roleId?.name).map((s) => [roleKey(s), s.roleId.name])).entries()
  );

  const search = searchTerm.toLowerCase();
  const filtered = (isTrash ? trashed : live).filter((s) => {
    if (view === "active" && (s.status || "Active") !== "Active") return false;
    if (view === "suspended" && (!s.status || s.status === "Active")) return false;
    if (roleFilter && roleKey(s) !== roleFilter) return false;
    if (!search) return true;
    return String(s.name || "").toLowerCase().includes(search) || String(s.email || "").toLowerCase().includes(search);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeView = (next) => {
    setSelectedIds([]);
    setBulkAction("Bulk actions");
    setPage(1);
    setView(next);
  };

  // What the signed-in user may do with this row (the server re-checks everything).
  const rowRules = (s) => {
    const isSuperAdmin = s?.roleId?.slug === "super-admin";
    const isSelf = Boolean(currentUserId) && String(s?._id) === String(currentUserId);
    return {
      isSuperAdmin,
      isSelf,
      canToggle: canEdit && !isSuperAdmin && !isSelf,
      canTrash: canDelete && !isSelf && (!isSuperAdmin || currentIsSuperAdmin),
      canResetPassword: canEdit && (!isSuperAdmin || currentIsSuperAdmin),
    };
  };

  const nameOf = (s) => s?.name || s?.email || "this user";

  // --- requests (throw on failure) ---
  const trashStaff = async (id) => {
    const res = await fetch(`/api/admin/staff/${id}?mode=trash`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readError(res, "Failed to move user to the Trash."));
  };
  const restoreStaff = async (id) => {
    const res = await fetch(`/api/admin/staff/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeleted: false }),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to restore user."));
  };
  const deleteStaffPermanently = async (id) => {
    const res = await fetch(`/api/admin/staff/${id}?mode=permanent`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readError(res, "Failed to delete user."));
  };

  const runRow = async (fn, success) => {
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(err.message);
    }
    fetchStaff();
  };

  const toggleStatus = async (s) => {
    const newStatus = s.status === "Active" ? "Suspended" : "Active";
    if (newStatus === "Suspended") {
      const ok = await showConfirm(`${nameOf(s)} will be signed out and won't be able to sign in until reactivated.`, "Suspend user?", { confirmText: "Suspend", danger: true });
      if (!ok) return;
    }
    runRow(async () => {
      const res = await fetch(`/api/admin/staff/${s._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to update status."));
    }, newStatus === "Active" ? `${nameOf(s)} activated.` : `${nameOf(s)} suspended.`);
  };

  const handleTrash = async (s) => {
    const ok = await showConfirm(
      `${nameOf(s)} will be moved to the Trash. They are signed out right away and can't sign in until restored.`,
      "Move to Trash?",
      { confirmText: "Move to Trash", danger: true }
    );
    if (ok) runRow(() => trashStaff(s._id), `${nameOf(s)} moved to the Trash.`);
  };

  const handleRestore = (s) => runRow(() => restoreStaff(s._id), `${nameOf(s)} restored.`);

  const handleDeletePermanently = async (s) => {
    const ok = await showConfirm(`${nameOf(s)} will be deleted permanently. This cannot be undone.`, "Delete permanently?", { confirmText: "Delete Permanently", danger: true });
    if (ok) runRow(() => deleteStaffPermanently(s._id), "User deleted permanently.");
  };

  const BULK = {
    "Move to Trash": { verb: "moved to the Trash", run: trashStaff },
    Restore: { verb: "restored", run: restoreStaff },
    "Delete Permanently": { verb: "deleted permanently", run: deleteStaffPermanently },
  };

  const handleBulk = async () => {
    const def = BULK[bulkAction];
    if (!def || selectedIds.length === 0) return;
    const n = selectedIds.length;
    const label = `${n} user${n === 1 ? "" : "s"}`;
    const ok = bulkAction === "Restore"
      ? await showConfirm(`Restore ${label}?`)
      : bulkAction === "Delete Permanently"
        ? await showConfirm(`${label} will be deleted permanently. This cannot be undone.`, "Delete permanently?", { confirmText: "Delete Permanently", danger: true })
        : await showConfirm(`${label} will be moved to the Trash and signed out.`, "Move to Trash?", { confirmText: "Move to Trash", danger: true });
    if (!ok) return;

    let done = 0;
    const failures = [];
    for (const id of selectedIds) {
      const s = list.find((x) => x._id === id);
      try {
        await def.run(id);
        done++;
      } catch (err) {
        failures.push(`${nameOf(s)}: ${err.message}`);
      }
    }
    setSelectedIds([]);
    setBulkAction("Bulk actions");
    fetchStaff();
    if (done) toast.success(`${done} user${done === 1 ? "" : "s"} ${def.verb}.`);
    if (failures.length) toast.error(`${failures.length} failed — ${failures.slice(0, 5).join("; ")}${failures.length > 5 ? "; …" : ""}`, { duration: 8000 });
  };

  const selectable = rows.filter((s) => isTrash || rowRules(s).canTrash);
  const allSelected = selectable.length > 0 && selectable.every((s) => selectedIds.includes(s._id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : selectable.map((s) => s._id));
  const toggleOne = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submitResetPassword = async (e) => {
    e?.preventDefault();
    if (!passwordTarget.password || passwordTarget.password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    setPasswordTarget((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/admin/staff/${passwordTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordTarget.password }),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to reset password"));
      toast.success(`Password for "${passwordTarget.name}" updated.`);
      setPasswordTarget(EMPTY_PASSWORD);
    } catch (err) {
      toast.error(err.message);
      setPasswordTarget((prev) => ({ ...prev, loading: false }));
    }
  };

  const viewLink = (key, label, count) => (
    view === key ? (
      <span className="is-current" aria-current="page">{label} <span className="wp-count">({count})</span></span>
    ) : (
      <button type="button" onClick={() => changeView(key)}>{label} <span className="wp-count">({count})</span></button>
    )
  );

  const headerRow = (
    <tr>
      {canDelete && (
        <th className="wp-check-col">
          <input type="checkbox" aria-label="Select all users" checked={allSelected} disabled={selectable.length === 0} onChange={toggleAll} />
        </th>
      )}
      <th scope="col">Username</th>
      <th scope="col" className="wp-hide-sm">Email</th>
      <th scope="col">Role</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">{isTrash ? "Trashed" : "Last login"}</th>
    </tr>
  );
  const colCount = canDelete ? 6 : 5;
  const itemsLabel = `${filtered.length} item${filtered.length === 1 ? "" : "s"}`;

  return (
    <Page>
      <PageHeader
        title="Users"
        actions={canCreate ? <Link href="/admin/settings/team/new" className="wp-btn">Add new user</Link> : null}
        aside={
          <form className="wp-search" role="search" onSubmit={runSearch}>
            <label htmlFor="team-search" className="sr-only">Search users</label>
            <input
              id="team-search"
              type="search"
              className="wp-input"
              placeholder="Search by name or email"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="wp-btn">Search Users</button>
          </form>
        }
      />

      {loadError && <Notice type="error" onDismiss={() => setLoadError("")}>{loadError}</Notice>}

      <div className="wp-subsub">
        {viewLink("all", "All", counts.all)}
        <span className="wp-sep" aria-hidden="true">|</span>
        {viewLink("active", "Active", counts.active)}
        <span className="wp-sep" aria-hidden="true">|</span>
        {viewLink("suspended", "Suspended", counts.suspended)}
        <span className="wp-sep" aria-hidden="true">|</span>
        {viewLink("trash", "Trash", counts.trash)}
      </div>

      <div className="wp-toolbar">
        {canDelete && (
          <>
            <label htmlFor="team-bulk" className="sr-only">Select bulk action</label>
            <ThemedSelect id="team-bulk" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
              <option>Bulk actions</option>
              {isTrash ? (
                <>
                  <option>Restore</option>
                  <option>Delete Permanently</option>
                </>
              ) : (
                <option>Move to Trash</option>
              )}
            </ThemedSelect>
            <button type="button" className="wp-btn" onClick={handleBulk}>Apply</button>
          </>
        )}
        <label htmlFor="team-role-filter" className="sr-only">Filter by role</label>
        <ThemedSelect
          id="team-role-filter"
          className="wp-select"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); setSelectedIds([]); }}
        >
          <option value="">All roles</option>
          {roleOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </ThemedSelect>
        <span className="wp-spacer" />
        <span className="wp-pages">{itemsLabel}</span>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => <tr key={i}><td colSpan={colCount}><Skeleton height={18} /></td></tr>)
            ) : rows.length === 0 ? (
              <tr><td colSpan={colCount} className="wp-muted" style={{ padding: 20, textAlign: "center" }}>{isTrash ? "No users found in Trash." : "No users found."}</td></tr>
            ) : rows.map((s) => {
              const rules = rowRules(s);
              const roleName = s?.roleId?.name || "No role";
              const status = s?.status || "Active";
              const isActive = status === "Active";
              return (
                <tr key={s._id} className={selectedIds.includes(s._id) ? "is-selected" : undefined}>
                  {canDelete && (
                    <td className="wp-check-col">
                      <input
                        type="checkbox"
                        aria-label={`Select ${nameOf(s)}`}
                        checked={selectedIds.includes(s._id)}
                        disabled={!isTrash && !rules.canTrash}
                        onChange={() => toggleOne(s._id)}
                      />
                    </td>
                  )}
                  <td>
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="wp-avatar" aria-hidden="true">{(s?.name || "U").charAt(0).toUpperCase()}</div>
                      <div className="min-w-0">
                        {isTrash ? (
                          <span className="wp-row-title" style={{ color: "inherit", overflowWrap: "anywhere" }}>{s?.name || "Unnamed"}</span>
                        ) : (
                          <Link href={`/admin/settings/team/${s._id}`} className="wp-row-title" style={{ overflowWrap: "anywhere" }}>
                            {s?.name || "Unnamed"}
                          </Link>
                        )}
                        {rules.isSelf && <span className="wp-muted"> — You</span>}
                        <div className="wp-mobile-meta" style={{ overflowWrap: "anywhere" }}>{s?.email || "No email"}</div>
                        <div className="wp-row-actions">
                          {isTrash ? (
                            <>
                              <button type="button" onClick={() => handleRestore(s)}>Restore</button>
                              <button type="button" className="is-danger" onClick={() => handleDeletePermanently(s)}>Delete Permanently</button>
                            </>
                          ) : (
                            <>
                              <Link href={`/admin/settings/team/${s._id}`}>{canEdit ? "Edit" : "View"}</Link>
                              {rules.canToggle && (
                                <button type="button" onClick={() => toggleStatus(s)}>{isActive ? "Suspend" : "Activate"}</button>
                              )}
                              {rules.canResetPassword && (
                                <button type="button" onClick={() => setPasswordTarget({ ...EMPTY_PASSWORD, open: true, id: s._id, name: s.name })}>
                                  Reset password
                                </button>
                              )}
                              {rules.canTrash && (
                                <button type="button" className="is-danger" onClick={() => handleTrash(s)}>Trash</button>
                              )}
                              {rules.isSuperAdmin && !rules.canTrash && !rules.isSelf && <span className="is-muted">Protected</span>}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="wp-hide-sm" style={{ overflowWrap: "anywhere" }}>
                    {s?.email ? <a href={`mailto:${s.email}`} className="wp-link">{s.email}</a> : <span className="wp-muted">No email</span>}
                  </td>
                  <td>{roleName}</td>
                  <td>
                    <span className={`wp-pill wp-pill-sm ${isTrash ? "wp-st-draft" : isActive ? "wp-st-published" : "wp-st-cancelled"}`}>
                      {isTrash ? "Trashed" : status}
                    </span>
                  </td>
                  <td className="wp-hide-sm wp-muted" suppressHydrationWarning>
                    {isTrash
                      ? (s.deletedAt ? formatDate(s.deletedAt) : "—")
                      : (s?.security?.lastLogin ? formatDate(s.security.lastLogin) : "Never")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <span className="wp-pages">
          {itemsLabel}
          {pages > 1 && (
            <>
              <button type="button" className="wp-pager" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => { setSelectedIds([]); setPage(currentPage - 1); }}><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
              <span>{currentPage} of {pages}</span>
              <button type="button" className="wp-pager" aria-label="Next page" disabled={currentPage >= pages} onClick={() => { setSelectedIds([]); setPage(currentPage + 1); }}><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
            </>
          )}
        </span>
      </div>

      {passwordTarget.open && (
        <div
          className="wp-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget && !passwordTarget.loading) setPasswordTarget(EMPTY_PASSWORD); }}
        >
          <div className="wp-modal" style={{ maxWidth: 460 }} role="dialog" aria-modal="true" aria-labelledby="reset-pass-title">
            <form onSubmit={submitResetPassword}>
              <div className="wp-modal-head">
                <h2 id="reset-pass-title" style={{ minWidth: 0, overflowWrap: "anywhere" }}>Set new password — {passwordTarget.name}</h2>
                <button type="button" className="wp-notice-dismiss" aria-label="Close" disabled={passwordTarget.loading} onClick={() => setPasswordTarget(EMPTY_PASSWORD)}>
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
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    value={passwordTarget.password}
                    onChange={(e) => setPasswordTarget((prev) => ({ ...prev, password: e.target.value }))}
                    className="wp-input"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="button"
                    className="wp-btn"
                    aria-label={passwordTarget.showPass ? "Hide password" : "Show password"}
                    onClick={() => setPasswordTarget((prev) => ({ ...prev, showPass: !prev.showPass }))}
                  >
                    {passwordTarget.showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {passwordTarget.showPass ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="wp-desc">Minimum 6 characters.</p>
              </div>
              <div className="wp-modal-foot">
                <button type="button" className="wp-btn" disabled={passwordTarget.loading} onClick={() => setPasswordTarget(EMPTY_PASSWORD)}>Cancel</button>
                <button type="submit" className="wp-btn wp-btn-primary" disabled={passwordTarget.loading}>
                  {passwordTarget.loading ? "Saving…" : "Update password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Page>
  );
}
