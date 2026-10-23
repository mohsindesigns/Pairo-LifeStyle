"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Notice } from "@/components/admin/ui";

export default function AdminTrash() {
  const [activeTab, setActiveTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: "", // "product", "category", "blog"
    id: null,
    name: ""
  });
  
  const [processing, setProcessing] = useState(false);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, blogRes] = await Promise.all([
        fetch("/api/admin/products?isDeleted=true"),
        fetch("/api/admin/categories?trash=true"),
        fetch("/api/admin/blogs?isDeleted=true")
      ]);
      
      const [prodData, catData, blogData] = await Promise.all([
        prodRes.json(),
        catRes.json(),
        blogRes.json()
      ]);
      
      setProducts(Array.isArray(prodData) ? prodData : []);
      setCategories(Array.isArray(catData) ? catData : []);
      setBlogs(Array.isArray(blogData) ? blogData : []);
    } catch (err) {
      console.error("Failed to fetch trash items:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async (type, id) => {
    try {
      let url = "";
      let payload = {};
      
      if (type === "product") {
        url = "/api/admin/products";
        payload = { id, isDeleted: false, status: 'Draft' };
      } else if (type === "category") {
        url = "/api/admin/categories";
        payload = { id, isDeleted: false };
      } else if (type === "blog") {
        url = "/api/admin/blogs";
        payload = { id, isDeleted: false };
      }
      
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        toast.success("Item restored successfully");
        fetchTrash();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to restore");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore item");
    }
  };

  const handlePermanentDelete = async () => {
    const { type, id } = confirmModal;
    if (!id) return;
    
    setProcessing(true);
    try {
      let url = "";
      if (type === "product") {
        url = `/api/admin/products/${id}`;
      } else if (type === "category") {
        url = `/api/admin/categories?id=${id}`;
      } else if (type === "blog") {
        url = `/api/admin/blogs?id=${id}`;
      }
      
      const res = await fetch(url, {
        method: "DELETE"
      });
      
      if (res.ok) {
        toast.success("Item permanently deleted");
        setConfirmModal({ open: false, type: "", id: null, name: "" });
        fetchTrash();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete permanently");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting item permanently");
    } finally {
      setProcessing(false);
    }
  };

  const openConfirmModal = (type, id, name) => {
    setConfirmModal({
      open: true,
      type,
      id,
      name
    });
  };

  const activeItemsCount = 
    activeTab === "products" ? products.length :
    activeTab === "categories" ? categories.length :
    blogs.length;

  const tabs = [
    { key: "products", label: "Products", count: products.length },
    { key: "categories", label: "Categories", count: categories.length },
    { key: "blogs", label: "Blogs", count: blogs.length },
  ];
  const colCount = activeTab === "products" ? 3 : activeTab === "categories" ? 2 : 1;

  return (
    <Page>
      <PageHeader
        title="Trash"
        actions={<button type="button" onClick={fetchTrash} className="wp-btn">Refresh</button>}
        aside={<Link href="/admin" className="wp-link">← Dashboard</Link>}
      />
      <p className="wp-desc" style={{ marginTop: 0 }}>Restore or permanently delete soft-deleted items.</p>

      <div className="wp-subsub" role="tablist" aria-label="Filter trash by type">
        {tabs.map((t, i) => (
          <span key={t.key} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              className={activeTab === t.key ? "is-current" : undefined}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label} <span className="wp-count">({t.count})</span>
            </button>
          </span>
        ))}
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <span className="wp-pages">{activeItemsCount} item{activeItemsCount === 1 ? "" : "s"}</span>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th scope="col">{activeTab === "products" ? "Name" : activeTab === "categories" ? "Name" : "Title"}</th>
              {activeTab === "products" && <th scope="col" className="wp-hide-sm">SKU</th>}
              {activeTab === "products" && <th scope="col" className="wp-hide-sm">Price</th>}
              {activeTab === "categories" && <th scope="col" className="wp-hide-sm">Type</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colCount} className="wp-muted">Loading deleted items…</td></tr>
            ) : activeItemsCount === 0 ? (
              <tr><td colSpan={colCount} className="wp-muted">No {activeTab} found in Trash.</td></tr>
            ) : (
              <>
                {activeTab === "products" && products.map(p => (
                  <tr key={p._id}>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div className="wp-thumb">
                          {p.images?.[0] && <img src={p.images[0]} alt="" />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <span className="wp-row-title">{p.name}</span>
                          <div className="wp-mobile-meta">
                            {p.sku ? `SKU: ${p.sku} · ` : ""}<span className="wp-strong">${p.price?.toFixed(2)}</span>
                          </div>
                          <div className="wp-row-actions">
                            <span className="is-muted">ID: {p._id}</span>
                            <span><button type="button" onClick={() => handleRestore("product", p._id)}>Restore</button></span>
                            <span><button type="button" onClick={() => openConfirmModal("product", p._id, p.name)} className="is-danger">Delete permanently</button></span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="wp-hide-sm wp-muted" style={{ wordBreak: "break-all" }}>{p.sku || "—"}</td>
                    <td className="wp-hide-sm wp-strong">${p.price?.toFixed(2)}</td>
                  </tr>
                ))}

                {activeTab === "categories" && categories.map(c => (
                  <tr key={c._id}>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <span className="wp-row-title">{c.name}</span>
                      <div className="wp-muted wp-small">Slug: {c.slug}</div>
                      <div className="wp-mobile-meta">Type: {c.type || "product"}</div>
                      <div className="wp-row-actions">
                        <span><button type="button" onClick={() => handleRestore("category", c._id)}>Restore</button></span>
                        <span><button type="button" onClick={() => openConfirmModal("category", c._id, c.name)} className="is-danger">Delete permanently</button></span>
                      </div>
                    </td>
                    <td className="wp-hide-sm">{c.type || "product"}</td>
                  </tr>
                ))}

                {activeTab === "blogs" && blogs.map(b => (
                  <tr key={b._id}>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        {b.image && (
                          <div className="wp-thumb">
                            <img src={b.image} alt="" />
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <span className="wp-row-title">{b.title}</span>
                          <div className="wp-muted wp-small">Author: {b.author || "Pairo Studio"}</div>
                          <div className="wp-row-actions">
                            <span><button type="button" onClick={() => handleRestore("blog", b._id)}>Restore</button></span>
                            <span><button type="button" onClick={() => openConfirmModal("blog", b._id, b.title)} className="is-danger">Delete permanently</button></span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <Notice type="warning">
          <strong>Deleting permanently</strong> removes documents from their collections and cleans references across products, categories, blogs and media usage indexes. This cannot be undone.
        </Notice>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="wp-modal-backdrop">
          <div className="wp-modal" role="dialog" aria-modal="true" aria-labelledby="trash-confirm-title" style={{ maxWidth: 480 }}>
            <div className="wp-modal-head">
              <h2 id="trash-confirm-title">Delete permanently</h2>
              <button type="button" onClick={() => setConfirmModal({ open: false, type: "", id: null, name: "" })} className="wp-notice-dismiss" aria-label="Close dialog">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="wp-modal-body">
              <p style={{ marginTop: 0 }}>Are you sure you want to permanently delete this {confirmModal.type}?</p>
              <p className="wp-strong" style={{ wordBreak: "break-word" }}>{confirmModal.name}</p>
              <p className="wp-desc" style={{ color: "#d63638" }}>All references, media links and relations will be removed. This cannot be undone.</p>
            </div>
            <div className="wp-modal-foot">
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, type: "", id: null, name: "" })}
                disabled={processing}
                className="wp-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={processing}
                className="wp-btn wp-btn-primary"
                style={{ background: "#d63638", borderColor: "#d63638" }}
              >
                {processing ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
