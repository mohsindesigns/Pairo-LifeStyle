"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ImageIcon } from "lucide-react";
import { Page, PageHeader, Postbox } from "@/components/admin/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCategoryUrl } from "@/lib/routes";
import { usePopup } from "@/context/PopupContext";
import { buildCategoryDuplicate } from "@/app/api/admin/categories/helpers";

export default function CategoryManager({ type = "product", title = "Categories" }) {
  const router = useRouter();
  const { showConfirm, showAlert } = usePopup();
  const [categories, setCategories] = useState([]);
  const [trashedCategories, setTrashedCategories] = useState([]);
  const [view, setView] = useState("all"); // "all" | "trash"
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCategories();
    });
  }, [fetchCategories]);

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
  };

  const handleDelete = async (id) => {
    const ok = await showConfirm("Move this category to the trash? You can restore it from the Trash view.", "Move to Trash", { confirmText: "Move to Trash" });
    if (!ok) return;
    try {
      const res = await trashCategory(id);
      if (!res.ok) showAlert(await errorOf(res), "Could not move to trash", "error");
      fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestore = async (id) => {
    try {
      const res = await restoreCategory(id);
      if (!res.ok) showAlert(await errorOf(res), "Could not restore", "error");
      fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePermanentDelete = async (cat) => {
    const ok = await showConfirm(
      `Permanently delete "${cat.name}"? It will be removed from all products. This cannot be undone.`,
      "Delete permanently",
      { confirmText: "Delete permanently", danger: true }
    );
    if (!ok) return;
    try {
      const res = await deletePermanently(cat._id);
      if (!res.ok) showAlert(await errorOf(res), "Could not delete", "error");
      fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicate = async (cat) => {
    try {
      await duplicateOne(cat, await fetchLinkedProductsMap());
    } catch (err) {
      console.error("Duplicate failed:", err);
      showAlert(err.message || "Duplicate failed.", "Could not duplicate", "error");
    }
    fetchCategories();
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     const isPermanent = bulkAction === "Delete Permanently";
     const ok = await showConfirm(
       isPermanent
         ? `Permanently delete ${selectedIds.length} categories? They will be removed from all products. This cannot be undone.`
         : `Apply "${bulkAction}" to ${selectedIds.length} categories?`,
       isPermanent ? "Delete permanently" : undefined,
       isPermanent ? { confirmText: "Delete permanently", danger: true } : {}
     );
     if (!ok) return;

     const failures = [];
     const products = bulkAction === "Duplicate" ? await fetchLinkedProductsMap() : null;
     const source = view === "trash" ? trashedCategories : categories;
     for (const id of selectedIds) {
        const cat = source.find(c => c._id === id);
        const label = cat?.name || id;
        try {
           let res = null;
           if (bulkAction === "Move to Trash") res = await trashCategory(id);
           else if (bulkAction === "Restore") res = await restoreCategory(id);
           else if (bulkAction === "Delete Permanently") res = await deletePermanently(id);
           else if (bulkAction === "Duplicate" && cat) await duplicateOne(cat, products);
           if (res && !res.ok) failures.push(`${label}: ${await errorOf(res)}`);
        } catch (err) {
           failures.push(`${label}: ${err.message || "failed"}`);
        }
     }
     setSelectedIds([]);
     setBulkAction("Bulk actions");
     await fetchCategories();
     if (failures.length) {
        showAlert(`${failures.length} of ${selectedIds.length} failed: ${failures.join("; ")}`, `${bulkAction} incomplete`, "error");
     }
  };

  const switchView = (next) => {
     setSelectedIds([]);
     setBulkAction("Bulk actions");
     setView(next);
  };

  // Search button / Enter apply immediately (typing also filters live).
  const runSearch = (e) => {
     e.preventDefault();
     setSearchTerm(searchInput);
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     if (selectedIds.length === filteredCategories.length) setSelectedIds([]);
     else setSelectedIds(filteredCategories.map(c => c._id));
  };

  const filteredCategories = (view === "trash" ? trashedCategories : categories).filter(c => 
     c.name?.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const newLink = type === 'product' ? '/admin/products/categories/new' : '/admin/blogs/categories/new';
  const getEditLink = (id) => type === 'product' ? `/admin/products/categories/${id}` : `/admin/blogs/categories/${id}`;

  const allSelected = selectedIds.length > 0 && selectedIds.length === filteredCategories.length;
  const itemLabel = type === "product" ? "products" : "posts";

  return (
    <Page>
      <PageHeader
        title={title}
        actions={<Link href={newLink} className="wp-btn">Add New</Link>}
        aside={
          <form className="wp-search" role="search" onSubmit={runSearch}>
            <label htmlFor="category-search" className="sr-only">Search categories</label>
            <input
              id="category-search"
              type="search"
              className="wp-input"
              placeholder="Search categories..."
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setSearchTerm(e.target.value); }}
            />
            <button type="submit" className="wp-btn">Search Categories</button>
          </form>
        }
      />

      <div className="wp-cols">
        {/* Left column: add new */}
        <div className="wp-col-side" style={{ flex: "1 1 300px", maxWidth: "100%" }}>
          <Postbox id="add-category" title="Add new category">
            <p className="wp-desc" style={{ marginTop: 0 }}>
              Categories group your {itemLabel} so shoppers can browse them together. Each category gets its own page.
            </p>
            <p className="wp-desc">
              The editor lets you set the name, slug, short and full description, image, banner, {type === "product" ? "default size chart, " : ""}FAQs and SEO details.
            </p>
            <div style={{ marginTop: 14 }}>
              <Link href={newLink} className="wp-btn wp-btn-primary">Add new category</Link>
            </div>
          </Postbox>
        </div>

        {/* Right column: list table */}
        <div className="wp-col-main">
          <div className="wp-subsub">
            {view === "all" ? (
              <span className="is-current" aria-current="page">
                All <span className="wp-count">({categories.length})</span>
              </span>
            ) : (
              <button type="button" onClick={() => switchView("all")}>
                All <span className="wp-count">({categories.length})</span>
              </button>
            )}
            <span className="wp-sep">|</span>
            {view === "trash" ? (
              <span className="is-current" aria-current="page">
                Trash <span className="wp-count">({trashedCategories.length})</span>
              </span>
            ) : (
              <button type="button" onClick={() => switchView("trash")}>
                Trash <span className="wp-count">({trashedCategories.length})</span>
              </button>
            )}
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
                  <option>Duplicate</option>
                  <option>Move to Trash</option>
                </>
              )}
            </select>
            <button onClick={handleBulkAction} className="wp-btn">Apply</button>
            <span className="wp-spacer" />
            <span className="wp-pages">
              {filteredCategories.length} item{filteredCategories.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="wp-table-box">
            <table className="wp-list-table">
              <thead>
                <tr>
                  <th className="wp-check-col">
                    <input type="checkbox" aria-label="Select all categories" checked={allSelected} onChange={toggleSelectAll} />
                  </th>
                  <th style={{ width: 56 }}>
                    <ImageIcon className="w-4 h-4 text-[#8c8f94]" aria-hidden="true" />
                    <span className="sr-only">Image</span>
                  </th>
                  <th>Name</th>
                  <th className="wp-hide-sm">Description</th>
                  <th className="wp-hide-sm">Slug</th>
                  <th className="wp-hide-sm">Status</th>
                  <th className="wp-num">Count</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="wp-muted" style={{ padding: 20, textAlign: "center" }}>Loading...</td></tr>
                ) : filteredCategories.length === 0 ? (
                  <tr><td colSpan={7} className="wp-muted" style={{ padding: 20, textAlign: "center" }}>{view === "trash" ? "No categories found in Trash." : "No categories found."}</td></tr>
                ) : (
                  filteredCategories.map((cat) => {
                    const status = cat.status || "Published";
                    return (
                      <tr key={cat._id} className={selectedIds.includes(cat._id) ? "is-selected" : undefined}>
                        <td className="wp-check-col">
                          <input type="checkbox" aria-label={`Select ${cat.name}`} checked={selectedIds.includes(cat._id)} onChange={() => toggleSelect(cat._id)} />
                        </td>
                        <td>
                          <div className="wp-thumb">
                            {cat.image ? <img src={cat.image} alt="" /> : <ImageIcon className="w-5 h-5 text-[#a7aaad]" aria-hidden="true" />}
                          </div>
                        </td>
                        <td style={{ minWidth: 0 }}>
                          <Link href={getEditLink(cat._id)} className="wp-row-title break-words">{cat.name}</Link>
                          <div className="wp-mobile-meta">
                            /{cat.slug} · {status}
                          </div>
                          {view === "trash" ? (
                            <div className="wp-row-actions">
                              <button type="button" onClick={() => handleRestore(cat._id)}>Restore</button>
                              <button type="button" className="is-danger" onClick={() => handlePermanentDelete(cat)}>Delete permanently</button>
                            </div>
                          ) : (
                            <div className="wp-row-actions">
                              <Link href={getEditLink(cat._id)}>Edit</Link>
                              <button type="button" onClick={() => handleDuplicate(cat)}>Duplicate</button>
                              <button type="button" className="is-danger" onClick={() => handleDelete(cat._id)}>Trash</button>
                              <Link href={getCategoryUrl(cat)} target="_blank">View</Link>
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
                        <td className="wp-hide-sm" style={{ wordBreak: "break-all" }}>{cat.slug}</td>
                        <td className="wp-hide-sm">
                          <span className={`wp-pill wp-pill-sm ${status === "Published" ? "wp-st-published" : "wp-st-draft"}`}>{status}</span>
                        </td>
                        <td className="wp-num">
                          <Link href={getEditLink(cat._id)} className="wp-link">{cat.productCount || 0}</Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th className="wp-check-col">
                    <input type="checkbox" aria-label="Select all categories" checked={allSelected} onChange={toggleSelectAll} />
                  </th>
                  <th><span className="sr-only">Image</span></th>
                  <th>Name</th>
                  <th className="wp-hide-sm">Description</th>
                  <th className="wp-hide-sm">Slug</th>
                  <th className="wp-hide-sm">Status</th>
                  <th className="wp-num">Count</th>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="wp-toolbar">
            <span className="wp-spacer" />
            <span className="wp-pages">
              {filteredCategories.length} item{filteredCategories.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
    </Page>
  );
}
