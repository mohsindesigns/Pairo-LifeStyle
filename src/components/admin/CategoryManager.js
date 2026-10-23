"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ImageIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Notice, Skeleton } from "@/components/admin/ui";
import Link from "next/link";
import { getCategoryUrl } from "@/lib/routes";
import { usePopup } from "@/context/PopupContext";
import { buildCategoryDuplicate } from "@/app/api/admin/categories/helpers";

const PER_PAGE = 20;
const VIEWS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "trash", label: "Trash" },
];

const statusOf = (c) => c.status || "Published";

export default function CategoryManager({ type = "product", title = "Categories" }) {
  const { showConfirm } = usePopup();
  const [categories, setCategories] = useState([]);
  const [trashedCategories, setTrashedCategories] = useState([]);
  const [view, setView] = useState("all"); // all | published | draft | trash
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const [busy, setBusy] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const [res, trashRes] = await Promise.all([
        fetch(`/api/admin/categories?type=${type}`),
        fetch(`/api/admin/categories?type=${type}&trash=true`),
      ]);
      const [data, trashData] = await Promise.all([
        res.json().catch(() => []),
        trashRes.json().catch(() => []),
      ]);
      if (res.ok) setCategories(Array.isArray(data) ? data : []);
      if (trashRes.ok) setTrashedCategories(Array.isArray(trashData) ? trashData : []);
      if (!res.ok || !trashRes.ok) {
        setLoadError((!res.ok ? data?.error : trashData?.error) || "Failed to load categories.");
      } else {
        setLoadError("");
      }
    } catch (err) {
      console.error(err);
      setLoadError("Could not reach the server to load categories.");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCategories();
    });
  }, [fetchCategories]);

  // Typing filters live (debounced); the Search button / Enter applies immediately.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const errorOf = async (res) => (await res.json().catch(() => ({}))).error || `Request failed (${res.status})`;

  // Soft delete: mode=trash never hard-deletes, even if the item is already trashed.
  const trashCategory = (id) => fetch(`/api/admin/categories?id=${id}&mode=trash`, { method: "DELETE" });
  // Hard delete: the API only allows this for categories already in the trash.
  const deletePermanently = (id) => fetch(`/api/admin/categories?id=${id}&mode=permanent`, { method: "DELETE" });
  const restoreCategory = (id) => fetch("/api/admin/categories", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, isDeleted: false }),
  });

  // Products currently linked to a category (same source the editor uses).
  // Blog posts hold a single category name, so duplicating their link would
  // move them off the original category; blog copies start with no linked posts.
  const fetchLinkedProductsMap = async () => {
    if (type !== "product") return null;
    try {
      const res = await fetch("/api/admin/products?status=Published");
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) ? data : (data.products || []);
    } catch {
      return null;
    }
  };

  const duplicateOne = async (cat, products) => {
    const linked = products
      ? products.filter(p => (p.categories || []).map(String).includes(String(cat._id))).map(p => p._id)
      : [];
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCategoryDuplicate(cat, linked)),
    });
    if (!res.ok) throw new Error(await errorOf(res));
    return res.json().catch(() => ({}));
  };

  const runSingle = async (fn, okMsg, failMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(`${failMsg}: ${await errorOf(res)}`);
    } catch (err) {
      console.error(err);
      toast.error(failMsg);
    } finally {
      setBusy(false);
      fetchCategories();
    }
  };

  const handleDelete = async (cat) => {
    const ok = await showConfirm(
      `Move "${cat.name}" to the trash? You can restore it from the Trash view.`,
      "Move to Trash",
      { confirmText: "Move to Trash" }
    );
    if (!ok) return;
    runSingle(() => trashCategory(cat._id), `"${cat.name}" moved to the trash`, "Could not move to trash");
  };

  const handleRestore = (cat) =>
    runSingle(() => restoreCategory(cat._id), `"${cat.name}" restored`, "Could not restore");

  const handlePermanentDelete = async (cat) => {
    const ok = await showConfirm(
      `Permanently delete "${cat.name}"? It will be removed from all ${type === "product" ? "products" : "posts"}. This cannot be undone.`,
      "Delete permanently",
      { confirmText: "Delete permanently", danger: true }
    );
    if (!ok) return;
    runSingle(() => deletePermanently(cat._id), `"${cat.name}" deleted permanently`, "Could not delete");
  };

  const handleDuplicate = async (cat) => {
    setBusy(true);
    try {
      const copy = await duplicateOne(cat, await fetchLinkedProductsMap());
      toast.success(`Duplicated as "${copy?.name || `${cat.name} (Copy)`}" (draft)`);
    } catch (err) {
      console.error("Duplicate failed:", err);
      toast.error(err.message || "Duplicate failed.");
    } finally {
      setBusy(false);
      fetchCategories();
    }
  };

  const allSource = view === "trash" ? trashedCategories : categories;

  const handleBulkAction = async () => {
    if (bulkAction === "Bulk actions") return toast.error("Choose a bulk action first");
    if (selectedIds.length === 0) return toast.error("Select at least one category");
    const count = selectedIds.length;
    const noun = `categor${count === 1 ? "y" : "ies"}`;
    const isPermanent = bulkAction === "Delete Permanently";
    const ok = await showConfirm(
      isPermanent
        ? `Permanently delete ${count} ${noun}? They will be removed from all ${type === "product" ? "products" : "posts"}. This cannot be undone.`
        : `${bulkAction}: ${count} ${noun}?`,
      isPermanent ? "Delete permanently" : bulkAction,
      isPermanent ? { confirmText: "Delete permanently", danger: true } : { confirmText: bulkAction }
    );
    if (!ok) return;

    setBusy(true);
    let done = 0;
    const failures = [];
    const products = bulkAction === "Duplicate" ? await fetchLinkedProductsMap() : null;
    for (const id of selectedIds) {
      const cat = allSource.find(c => c._id === id);
      const label = cat?.name || id;
      try {
        let res = null;
        if (bulkAction === "Move to Trash") res = await trashCategory(id);
        else if (bulkAction === "Restore") res = await restoreCategory(id);
        else if (bulkAction === "Delete Permanently") res = await deletePermanently(id);
        else if (bulkAction === "Duplicate") {
          if (!cat) throw new Error("not found");
          await duplicateOne(cat, products);
        }
        if (res && !res.ok) failures.push(`${label}: ${await errorOf(res)}`);
        else done += 1;
      } catch (err) {
        failures.push(`${label}: ${err.message || "failed"}`);
      }
    }
    setSelectedIds([]);
    setBulkAction("Bulk actions");
    setBusy(false);
    await fetchCategories();
    if (failures.length === 0) toast.success(`${bulkAction}: ${done} done`);
    else {
      toast.error(`${bulkAction}: ${done} done, ${failures.length} failed`);
      console.error(`${bulkAction} failures:`, failures);
    }
  };

  const switchView = (next) => {
    setSelectedIds([]);
    setBulkAction("Bulk actions");
    setCurrentPage(1);
    setView(next);
  };

  const runSearch = (e) => {
    e.preventDefault();
    setSearchTerm(searchInput);
    setCurrentPage(1);
  };

  const term = searchTerm.trim().toLowerCase();
  const filteredCategories = allSource.filter(c => {
    if (view === "published" && statusOf(c) !== "Published") return false;
    if (view === "draft" && statusOf(c) !== "Draft") return false;
    if (!term) return true;
    return c.name?.toLowerCase().includes(term) || c.slug?.toLowerCase().includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const pageCategories = filteredCategories.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const counts = {
    all: categories.length,
    published: categories.filter(c => statusOf(c) === "Published").length,
    draft: categories.filter(c => statusOf(c) === "Draft").length,
    trash: trashedCategories.length,
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const allSelected = pageCategories.length > 0 && pageCategories.every(c => selectedIds.includes(c._id));
  const someSelected = pageCategories.some(c => selectedIds.includes(c._id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(pageCategories.map(c => c._id));
  };

  const goToPage = (n) => {
    setSelectedIds([]);
    setCurrentPage(Math.min(Math.max(1, n), totalPages));
  };

  const newLink = type === "product" ? "/admin/products/categories/new" : "/admin/blogs/categories/new";
  const getEditLink = (id) => type === "product" ? `/admin/products/categories/${id}` : `/admin/blogs/categories/${id}`;
  const itemLabel = type === "product" ? "products" : "posts";

  const pagination = (
    <div className="wp-pages">
      <span>{filteredCategories.length} item{filteredCategories.length === 1 ? "" : "s"}</span>
      {totalPages > 1 && (
        <>
          <button type="button" className="wp-pager" aria-label="First page" disabled={page <= 1} onClick={() => goToPage(1)}><ChevronsLeft className="w-4 h-4" /></button>
          <button type="button" className="wp-pager" aria-label="Previous page" disabled={page <= 1} onClick={() => goToPage(page - 1)}><ChevronLeft className="w-4 h-4" /></button>
          <span>{page} of {totalPages}</span>
          <button type="button" className="wp-pager" aria-label="Next page" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}><ChevronRight className="w-4 h-4" /></button>
          <button type="button" className="wp-pager" aria-label="Last page" disabled={page >= totalPages} onClick={() => goToPage(totalPages)}><ChevronsRight className="w-4 h-4" /></button>
        </>
      )}
    </div>
  );

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all categories"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleSelectAll}
        />
      </th>
      <th scope="col" style={{ width: 60 }}>
        <ImageIcon className="w-4 h-4" aria-hidden="true" style={{ color: "#8c8f94" }} />
        <span className="sr-only">Image</span>
      </th>
      <th scope="col" style={{ width: "30%" }}>Name</th>
      <th scope="col" className="wp-hide-sm">Description</th>
      <th scope="col" className="wp-hide-sm" style={{ width: "20%" }}>Slug</th>
      <th scope="col" className="wp-hide-sm" style={{ width: 110 }}>Status</th>
      <th scope="col" className="wp-num" style={{ width: 70 }}>Count</th>
    </tr>
  );

  const emptyText = term
    ? "No categories match your search."
    : view === "trash"
      ? "The trash is empty."
      : view === "draft"
        ? "No draft categories."
        : view === "published"
          ? "No published categories."
          : "No categories yet.";

  return (
    <Page>
      <PageHeader
        title={title}
        actions={<Link href={newLink} className="wp-btn">Add new category</Link>}
      />
      <p className="wp-desc" style={{ marginTop: 0 }}>
        Categories group your {itemLabel} so {type === "product" ? "shoppers can browse them together. Each category gets its own page." : "readers can find related posts."}
      </p>

      {loadError && (
        <Notice type="error" onDismiss={() => setLoadError("")}>{loadError}</Notice>
      )}

      <div className="wp-subsub" role="tablist" aria-label="Filter categories by status">
        {VIEWS.map((v, i) => (
          <React.Fragment key={v.value}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={view === v.value}
              className={view === v.value ? "is-current" : undefined}
              onClick={() => switchView(v.value)}
            >
              {v.label} <span className="wp-count">({counts[v.value]})</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="wp-toolbar">
        <label htmlFor="category-bulk-action" className="sr-only">Select bulk action</label>
        <select id="category-bulk-action" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
          <option>Bulk actions</option>
          {view === "trash" ? (
            <>
              <option>Restore</option>
              <option>Delete Permanently</option>
            </>
          ) : (
            <>
              <option>Move to Trash</option>
              <option>Duplicate</option>
            </>
          )}
        </select>
        <button type="button" onClick={handleBulkAction} className="wp-btn" disabled={busy}>Apply</button>

        <span className="wp-spacer" />

        <form className="wp-search" role="search" onSubmit={runSearch}>
          <label htmlFor="category-search" className="sr-only">Search categories</label>
          <input
            id="category-search"
            type="search"
            className="wp-input"
            placeholder="Search categories..."
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setCurrentPage(1); }}
          />
          <button type="submit" className="wp-btn">Search categories</button>
        </form>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading && allSource.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td className="wp-check-col"><Skeleton height={16} width={16} /></td>
                  <td><Skeleton height={40} width={40} /></td>
                  <td><Skeleton width="70%" /><Skeleton width="40%" height={12} style={{ marginTop: 6 }} /></td>
                  <td className="wp-hide-sm"><Skeleton width="80%" /></td>
                  <td className="wp-hide-sm"><Skeleton width="60%" /></td>
                  <td className="wp-hide-sm"><Skeleton width={70} /></td>
                  <td className="wp-num"><Skeleton width={24} style={{ marginLeft: "auto" }} /></td>
                </tr>
              ))
            ) : pageCategories.length === 0 ? (
              <tr>
                <td colSpan={7} className="wp-muted" style={{ padding: 20, textAlign: "center" }}>
                  {emptyText}
                  {view === "all" && !term && (
                    <> <Link href={newLink} className="wp-link">Add the first one</Link>.</>
                  )}
                </td>
              </tr>
            ) : (
              pageCategories.map((cat) => {
                const status = statusOf(cat);
                const checked = selectedIds.includes(cat._id);
                return (
                  <tr key={cat._id} className={checked ? "is-selected" : undefined}>
                    <td className="wp-check-col">
                      <input type="checkbox" aria-label={`Select ${cat.name}`} checked={checked} onChange={() => toggleSelect(cat._id)} />
                    </td>
                    <td>
                      <div className="wp-thumb">
                        {cat.image ? <img src={cat.image} alt="" /> : <ImageIcon className="w-5 h-5 text-[#a7aaad]" aria-hidden="true" />}
                      </div>
                    </td>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <Link href={getEditLink(cat._id)} className="wp-row-title">{cat.name}</Link>
                      {view !== "trash" && status === "Draft" && <span className="wp-muted"> — Draft</span>}
                      <div className="wp-mobile-meta">
                        /{cat.slug} · {status}
                      </div>
                      {view === "trash" ? (
                        <div className="wp-row-actions">
                          <span><button type="button" disabled={busy} onClick={() => handleRestore(cat)}>Restore</button></span>
                          <span><button type="button" disabled={busy} className="is-danger" style={{ whiteSpace: "nowrap" }} onClick={() => handlePermanentDelete(cat)}>Delete permanently</button></span>
                        </div>
                      ) : (
                        <div className="wp-row-actions">
                          <span><Link href={getEditLink(cat._id)}>Edit</Link></span>
                          <span><button type="button" disabled={busy} onClick={() => handleDuplicate(cat)}>Duplicate</button></span>
                          <span><button type="button" disabled={busy} className="is-danger" onClick={() => handleDelete(cat)}>Trash</button></span>
                          {/* Blog categories have no public per-category page (/blog lists all posts). */}
                          {type === "product" && <span><Link href={getCategoryUrl(cat)} target="_blank">View</Link></span>}
                        </div>
                      )}
                    </td>
                    <td className="wp-hide-sm">
                      {cat.description ? (
                        <span className="line-clamp-2">{cat.description}</span>
                      ) : (
                        <span className="wp-muted" aria-label="No description">—</span>
                      )}
                    </td>
                    <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>{cat.slug}</td>
                    <td className="wp-hide-sm">
                      <span className={`wp-pill wp-pill-sm ${status === "Published" ? "wp-st-published" : "wp-st-draft"}`}>{status}</span>
                    </td>
                    <td className="wp-num">
                      <Link href={getEditLink(cat._id)} className="wp-link" aria-label={`${cat.productCount || 0} ${itemLabel} in ${cat.name}`}>{cat.productCount || 0}</Link>
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
  );
}
