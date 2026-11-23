"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Image as ImageIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import Link from "next/link";
import { Page, PageHeader, Notice, Skeleton, formatDate } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { toast } from "react-hot-toast";
import { paginate } from "@/lib/admin-products-utils";
import ThemedSelect from "@/components/ui/ThemedSelect";

const VIEWS = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "trash", label: "Trash" },
];

const errorFrom = async (res, fallback) => {
  const data = await res.json().catch(() => ({}));
  return data?.error || fallback;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function AdminBlogs() {
  const { showConfirm } = usePopup();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All categories");
  const [view, setView] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const [counts, setCounts] = useState({ all: 0, published: 0, draft: 0, trash: 0 });
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/blogs?counts=true");
      if (res.ok) {
        const data = await res.json();
        setCounts({ all: data.all || 0, published: data.published || 0, draft: data.draft || 0, trash: data.trash || 0 });
      }
    } catch (err) {
      console.error("Failed to fetch counts:", err);
    }
  }, []);

  const fetchBlogs = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({ fields: "list" });
      if (view === "trash") params.set("isDeleted", "true");
      else if (view === "published") params.set("status", "Published");
      else if (view === "draft") params.set("status", "Draft");

      const res = await fetch(`/api/admin/blogs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBlogs(Array.isArray(data) ? data : []);
      } else {
        setBlogs([]);
        setLoadError(await errorFrom(res, "Failed to load posts."));
      }
    } catch (err) {
      console.error(err);
      setBlogs([]);
      setLoadError("Failed to load posts. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
    fetchCounts();
  }, [view, fetchCounts]);

  useEffect(() => {
    Promise.resolve().then(fetchBlogs);
  }, [fetchBlogs]);

  // ---- Single-row actions ----
  const trashRequest = (id) => fetch(`/api/admin/blogs?id=${id}&mode=trash`, { method: "DELETE" });
  const restoreRequest = (id) =>
    fetch("/api/admin/blogs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDeleted: false }),
    });
  // permanent=true: the API refuses unless the post is already in Trash
  const permanentRequest = (id) => fetch(`/api/admin/blogs?id=${id}&permanent=true`, { method: "DELETE" });
  const duplicateRequest = (id) => fetch(`/api/admin/blogs/${id}/duplicate`, { method: "POST" });

  const runSingle = async (request, success, failure) => {
    setBusy(true);
    try {
      const res = await request();
      if (res.ok) {
        toast.success(success);
        fetchBlogs();
      } else {
        toast.error(await errorFrom(res, failure));
      }
    } catch (err) {
      console.error(err);
      toast.error(failure);
    } finally {
      setBusy(false);
    }
  };

  const handleTrash = async (b) => {
    if (!(await showConfirm(`Move "${b.title}" to the Trash? You can restore it from the Trash view.`, "Move to Trash", { confirmText: "Move to Trash" }))) return;
    runSingle(() => trashRequest(b._id), "Post moved to the Trash.", "Failed to move the post to the Trash.");
  };

  const handleRestore = (b) =>
    runSingle(() => restoreRequest(b._id), "Post restored.", "Failed to restore the post.");

  const handlePermanentDelete = async (b) => {
    if (!(await showConfirm(`Permanently delete "${b.title}"? This cannot be undone.`, "Delete Permanently", { confirmText: "Delete Permanently", danger: true }))) return;
    runSingle(() => permanentRequest(b._id), "Post permanently deleted.", "Failed to delete the post.");
  };

  const handleDuplicate = (b) =>
    runSingle(() => duplicateRequest(b._id), "Post duplicated as a draft.", "Failed to duplicate the post.");

  // ---- Bulk actions (permanent delete only offered in Trash) ----
  const bulkOptions = view === "trash" ? ["Restore", "Delete Permanently"] : ["Duplicate", "Move to Trash"];

  const handleBulkAction = async () => {
    if (!bulkOptions.includes(bulkAction)) {
      toast.error("Choose a bulk action first.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Select at least one post.");
      return;
    }
    const n = selectedIds.length;
    const isPermanent = bulkAction === "Delete Permanently";
    const ok = isPermanent
      ? await showConfirm(`Permanently delete ${plural(n, "post")}? This cannot be undone.`, "Delete Permanently", { confirmText: "Delete Permanently", danger: true })
      : await showConfirm(`Apply "${bulkAction}" to ${plural(n, "post")}?`, "Bulk action", { confirmText: bulkAction });
    if (!ok) return;

    const request = {
      "Move to Trash": trashRequest,
      Restore: restoreRequest,
      "Delete Permanently": permanentRequest,
      Duplicate: duplicateRequest,
    }[bulkAction];

    setBusy(true);
    const ids = [...selectedIds];
    const results = [];
    for (const id of ids) {
      try {
        const res = await request(id);
        results.push(res.ok);
      } catch {
        results.push(false);
      }
    }
    setBusy(false);
    const succeeded = results.filter(Boolean).length;
    const failed = results.length - succeeded;
    // Keep failed rows selected so they can be retried
    setSelectedIds(ids.filter((_, i) => !results[i]));
    fetchBlogs();
    if (failed === 0) toast.success(`${bulkAction}: ${plural(succeeded, "post")} done.`);
    else toast.error(`${bulkAction}: ${succeeded} done, ${failed} failed.`);
  };

  // ---- Filtering, paging, selection ----
  const term = searchTerm.trim().toLowerCase();
  const filteredBlogs = blogs.filter((b) => {
    const matchesSearch = !term
      || (b.title || "").toLowerCase().includes(term)
      || (b.slug || "").toLowerCase().includes(term)
      || (b.author || "").toLowerCase().includes(term);
    const matchesCategory = selectedCategory === "All categories"
      || (selectedCategory === "Uncategorized" ? (!b.category || b.category === "Uncategorized") : b.category === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const { items: pageBlogs, page: currentPage, totalPages } = paginate(filteredBlogs, page);
  const visibleIds = pageBlogs.map((b) => b._id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someSelected = visibleIds.some((id) => selectedIds.includes(id));

  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    else setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const resetPaging = () => { setPage(1); setSelectedIds([]); };
  const changeView = (v) => { setView(v); setBulkAction("Bulk actions"); resetPaging(); };
  const goToPage = (p) => { setPage(Math.min(Math.max(1, p), totalPages)); setSelectedIds([]); };

  const categoryOptions = Array.from(new Set(blogs.map((b) => b.category).filter((c) => c && c !== "Uncategorized"))).sort();

  const dateCell = (b) => {
    if (view === "trash") return { label: "Trashed", date: b.deletedAt || b.updatedAt };
    if (b.status === "Published") return { label: "Published", date: b.publishedAt || b.createdAt };
    return { label: "Last Modified", date: b.updatedAt || b.createdAt };
  };

  const pagination = (
    <div className="wp-pages">
      <span>{plural(filteredBlogs.length, "item")}</span>
      <button type="button" className="wp-pager" aria-label="First page" disabled={currentPage <= 1} onClick={() => goToPage(1)}><ChevronsLeft className="w-4 h-4" aria-hidden="true" /></button>
      <button type="button" className="wp-pager" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
      <span>{currentPage} of {totalPages}</span>
      <button type="button" className="wp-pager" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
      <button type="button" className="wp-pager" aria-label="Last page" disabled={currentPage >= totalPages} onClick={() => goToPage(totalPages)}><ChevronsRight className="w-4 h-4" aria-hidden="true" /></button>
    </div>
  );

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all posts on this page"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleSelectAll}
        />
      </th>
      <th scope="col" style={{ width: 60 }}>
        <ImageIcon className="w-4 h-4" aria-hidden="true" style={{ color: "#8c8f94" }} />
        <span className="sr-only">Featured image</span>
      </th>
      <th scope="col">Title</th>
      <th scope="col" className="wp-hide-sm">Author</th>
      <th scope="col" className="wp-hide-sm">Categories</th>
      <th scope="col" style={{ width: 110 }}>Status</th>
      <th scope="col" className="wp-hide-sm" style={{ width: 150 }}>Date</th>
    </tr>
  );

  return (
    <RequirePermission permission="blogs.view">
    <Page>
      <PageHeader
        title="Posts"
        actions={<Link href="/admin/blogs/new" className="wp-btn">Add new post</Link>}
      />

      {/* Status filter links */}
      <div className="wp-subsub" role="tablist" aria-label="Filter posts by status">
        {VIEWS.map((v, i) => (
          <React.Fragment key={v.key}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button type="button" role="tab" aria-selected={view === v.key} className={view === v.key ? "is-current" : undefined} onClick={() => changeView(v.key)}>
              {v.label} <span className="wp-count">({counts[v.key] || 0})</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Bulk actions, filters, search */}
      <div className="wp-toolbar">
        <label htmlFor="blogs-bulk-action" className="sr-only">Select bulk action</label>
        <ThemedSelect id="blogs-bulk-action" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
          <option>Bulk actions</option>
          {bulkOptions.map((opt) => <option key={opt}>{opt}</option>)}
        </ThemedSelect>
        <button type="button" onClick={handleBulkAction} className="wp-btn" disabled={busy}>Apply</button>

        <label htmlFor="blogs-filter-category" className="sr-only">Filter by category</label>
        <ThemedSelect
          id="blogs-filter-category"
          className="wp-select"
          value={selectedCategory}
          onChange={(e) => { setSelectedCategory(e.target.value); resetPaging(); }}
        >
          <option>All categories</option>
          {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          <option value="Uncategorized">Uncategorized</option>
        </ThemedSelect>

        <span className="wp-spacer" />

        {/* Results filter live as you type; Search / Enter submits the same term */}
        <form className="wp-search" role="search" onSubmit={(e) => { e.preventDefault(); resetPaging(); }}>
          <label htmlFor="blogs-search" className="sr-only">Search posts</label>
          <input
            id="blogs-search"
            type="search"
            placeholder="Search posts..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); resetPaging(); }}
            className="wp-input"
          />
          <button type="submit" className="wp-btn">Search posts</button>
        </form>
      </div>

      {loadError && (
        <Notice type="error">
          {loadError}{" "}
          <button type="button" className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }} onClick={fetchBlogs}>Try again</button>
        </Notice>
      )}

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i}>
                  <td colSpan={7}><Skeleton height={18} width={i === 1 ? "60%" : "80%"} /></td>
                </tr>
              ))
            ) : pageBlogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="wp-muted">
                  {term || selectedCategory !== "All categories"
                    ? "No posts match your search."
                    : view === "trash"
                      ? "No posts found in the Trash."
                      : view === "draft"
                        ? "No drafts."
                        : <>No posts yet. <Link href="/admin/blogs/new" className="wp-link">Write your first post</Link>.</>}
                </td>
              </tr>
            ) : (
              pageBlogs.map((b) => {
                const d = dateCell(b);
                const categoryLabel = b.category && b.category !== "Uncategorized" ? b.category : "Uncategorized";
                return (
                  <tr key={b._id} className={selectedIds.includes(b._id) ? "is-selected" : undefined}>
                    <td className="wp-check-col">
                      <input type="checkbox" aria-label={`Select ${b.title}`} checked={selectedIds.includes(b._id)} onChange={() => toggleSelect(b._id)} />
                    </td>
                    <td>
                      <div className="wp-thumb">
                        {b.image ? <img src={b.image} alt="" /> : <ImageIcon className="w-5 h-5" aria-hidden="true" style={{ color: "#a7aaad" }} />}
                      </div>
                    </td>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      {view === "trash" ? (
                        <span className="wp-row-title" style={{ color: "#1d2327" }}>{b.title}</span>
                      ) : (
                        <Link href={`/admin/blogs/${b._id}`} className="wp-row-title">{b.title}</Link>
                      )}
                      {view !== "trash" && b.status === "Draft" && <span className="wp-strong"> — Draft</span>}
                      {b.isFeatured && <span className="wp-muted"> — Featured</span>}
                      <div className="wp-mobile-meta">
                        {categoryLabel} · {d.label} {formatDate(d.date)}
                      </div>
                      <div className="wp-row-actions">
                        {view === "trash" ? (
                          <>
                            <span><button type="button" disabled={busy} onClick={() => handleRestore(b)}>Restore</button></span>
                            <span><button type="button" disabled={busy} onClick={() => handlePermanentDelete(b)} className="is-danger">Delete Permanently</button></span>
                          </>
                        ) : (
                          <>
                            <span><Link href={`/admin/blogs/${b._id}`}>Edit</Link></span>
                            <span><button type="button" disabled={busy} onClick={() => handleDuplicate(b)}>Duplicate</button></span>
                            <span><button type="button" disabled={busy} onClick={() => handleTrash(b)} className="is-danger">Trash</button></span>
                            <span><Link href={`/blog/${b.slug}`} target="_blank">{b.status === "Published" ? "View" : "Preview"}</Link></span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="wp-hide-sm">{b.author?.trim() ? b.author : "—"}</td>
                    <td className="wp-hide-sm">{b.category && b.category !== "Uncategorized" ? b.category : <span className="wp-muted">Uncategorized</span>}</td>
                    <td>
                      <span className={`wp-pill ${b.status === "Published" ? "wp-st-published" : "wp-st-draft"}`}>
                        {b.status || "Draft"}
                      </span>
                    </td>
                    <td className="wp-hide-sm">
                      {d.label}<br />
                      <span className="wp-muted">{formatDate(d.date)}</span>
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
        {pagination}
      </div>
    </Page>
    </RequirePermission>
  );
}
