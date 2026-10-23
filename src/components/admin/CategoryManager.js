"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ImageIcon } from "lucide-react";
import { Page, PageHeader, Postbox } from "@/components/admin/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCategoryUrl } from "@/lib/routes";
import { usePopup } from "@/context/PopupContext";

export default function CategoryManager({ type = "product", title = "Categories" }) {
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/categories?type=${type}`);
      const data = await res.json();
      if (res.ok) {
        setCategories(Array.isArray(data) ? data : []);
      }
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

  const handleDelete = async (id) => {
    const ok = await showConfirm("Are you sure you want to delete this category?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicate = async (cat) => {
    try {
      const { _id, ...rest } = cat;
      const copy = {
        ...rest,
        name: `${cat.name} (Copy)`,
        slug: `${cat.slug}-copy-${Math.floor(Math.random() * 1000)}`,
        status: "Draft"
      };
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy)
      });
      if (res.ok) fetchCategories();
    } catch (err) {
      console.error("Duplicate failed:", err);
    }
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     const ok = await showConfirm(`Apply "${bulkAction}" to ${selectedIds.length} categories?`);
     if (ok) {
        try {
           for (const id of selectedIds) {
              if (bulkAction === "Move to Trash" || bulkAction === "Delete Permanently") {
                  await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
              } else if (bulkAction === "Duplicate") {
                  const cat = categories.find(c => c._id === id);
                  if (cat) await handleDuplicate(cat);
              }
           }
           setSelectedIds([]);
           fetchCategories();
        } catch (err) {
           console.error("Bulk action failed:", err);
        }
     }
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     if (selectedIds.length === filteredCategories.length) setSelectedIds([]);
     else setSelectedIds(filteredCategories.map(c => c._id));
  };

  const filteredCategories = categories.filter(c => 
     c.name?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <div className="wp-search" role="search">
            <label htmlFor="category-search" className="sr-only">Search categories</label>
            <input
              id="category-search"
              type="search"
              className="wp-input"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="wp-btn">Search Categories</button>
          </div>
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
            <span className="is-current">
              All <span className="wp-count">({categories.length})</span>
            </span>
          </div>

          <div className="wp-toolbar">
            <label htmlFor="category-bulk-action" className="sr-only">Select bulk action</label>
            <select id="category-bulk-action" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
              <option>Bulk actions</option>
              <option>Duplicate</option>
              <option>Move to Trash</option>
              <option>Delete Permanently</option>
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
                  <tr><td colSpan={7} className="wp-muted" style={{ padding: 20, textAlign: "center" }}>No categories found.</td></tr>
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
                          <div className="wp-row-actions">
                            <Link href={getEditLink(cat._id)}>Edit</Link>
                            <button type="button" onClick={() => handleDuplicate(cat)}>Duplicate</button>
                            <button type="button" className="is-danger" onClick={() => handleDelete(cat._id)}>Trash</button>
                            <Link href={getCategoryUrl(cat)} target="_blank">View</Link>
                          </div>
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
