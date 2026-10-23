"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Image as ImageIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Page, PageHeader, formatDate } from "@/components/admin/ui";
import { getProductUrl } from "@/lib/routes";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

export default function AdminProducts() {
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All categories");
  const [selectedStock, setSelectedStock] = useState("All stock");
  const [selectedType, setSelectedType] = useState("All types");
  const [categories, setCategories] = useState([]);
  const [view, setView] = useState("all"); 
  const [quickEditId, setQuickEditId] = useState(null);
  const [quickEditData, setQuickEditData] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const [counts, setCounts] = useState({ all: 0, published: 0, trash: 0 });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/admin/products";
      if (view === "trash") url += "?isDeleted=true";
      else if (view === "published") url += "?status=Published";
      
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
         const list = Array.isArray(data) ? data : [];
         setProducts(list);
         if (view === "all") {
            const all = list.length;
            const published = list.filter(p => p.status === "Published").length;
            setCounts(prev => ({ ...prev, all, published }));
         }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [view]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories?type=product");
      const data = await res.json();
      if (res.ok) setCategories(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleTrash = async (id) => {
    if (!(await showConfirm("Move this product to trash?", "Move to Trash"))) return;
    try {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestoreProduct = async (id) => {
    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDeleted: false, status: 'Draft' })
      });
      if (res.ok) fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePermanentDeleteProduct = async (id, name) => {
    if (!(await showConfirm(`Are you sure you want to permanently delete "${name}"? This cannot be undone.`, "Permanently Delete"))) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (res.ok) fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicate = async (product) => {
     try {
        const { _id, createdAt, updatedAt, ...rest } = product;
        const copy = {
           ...rest,
           name: `${product.name} (Copy)`,
           slug: `${product.slug}-copy-${Math.floor(Math.random() * 1000)}`,
           status: "Draft"
        };
        const res = await fetch("/api/admin/products", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify(copy)
        });
        if (res.ok) fetchProducts();
     } catch (err) {
        console.error("Duplicate failed:", err);
     }
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     if (await showConfirm(`Apply "${bulkAction}" to ${selectedIds.length} items?`, "Bulk Action")) {
        try {
           for (const id of selectedIds) {
              if (bulkAction === "Move to Trash") {
                 await fetch(`/api/admin/products?id=${id}`, { method: "DELETE" });
              } else if (bulkAction === "Duplicate") {
                 const p = products.find(prod => prod._id === id);
                 if (p) await handleDuplicate(p);
              } else if (bulkAction === "Delete Permanently") {
                 await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
              }
           }
           setSelectedIds([]);
           fetchProducts();
        } catch (err) {
           console.error("Bulk action failed:", err);
        }
     }
  };

  const openQuickEdit = (p) => {
    setQuickEditId(p._id);
    setQuickEditData({
      name: p.name,
      slug: p.slug,
      price: p.price,
      status: p.status,
      sku: p.sku
    });
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     if (selectedIds.length === filteredProducts.length) setSelectedIds([]);
     else setSelectedIds(filteredProducts.map(p => p._id));
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchProducts();
      fetchCategories();
    });
  }, [fetchProducts, fetchCategories]);

  const filteredProducts = products.filter(p => {
    const nameMatch = p.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const skuMatch = p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = nameMatch || skuMatch;
    
    const matchesCategory = selectedCategory === "All categories" || 
                            p.categories?.some(catId => {
                               const cat = categories.find(c => c._id === catId);
                               return cat?.name === selectedCategory;
                            });

    const matchesStock = selectedStock === "All stock" ||
                         (selectedStock === "In stock" && (!p.manageStock || p.stock > (p.lowStockThreshold || 5))) ||
                         (selectedStock === "Low stock" && p.manageStock && p.stock > 0 && p.stock <= (p.lowStockThreshold || 5)) ||
                         (selectedStock === "Out of stock" && p.manageStock && p.stock <= 0);

    const matchesType = selectedType === "All types" || p.productType === selectedType;

    return matchesSearch && matchesCategory && matchesStock && matchesType;
  });

  const stockClass = (p) =>
    !p.manageStock
      ? "wp-stock-in"
      : p.stock <= 0
        ? "wp-stock-out"
        : p.stock <= (p.lowStockThreshold || 5)
          ? "wp-stock-low"
          : "wp-stock-in";

  const stockLabel = (p) =>
    !p.manageStock
      ? "In stock"
      : p.stock <= 0
        ? "Out of stock"
        : p.stock <= (p.lowStockThreshold || 5)
          ? `Low stock (${p.stock})`
          : `In stock (${p.stock})`;

  const allSelected = filteredProducts.length > 0 && selectedIds.length === filteredProducts.length;

  const pagination = (
    <div className="wp-pages">
      <span>{filteredProducts.length} items</span>
      <button type="button" className="wp-pager" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
      <span>1 of 1</span>
      <button type="button" className="wp-pager" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
    </div>
  );

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all products"
          checked={allSelected}
          onChange={toggleSelectAll}
        />
      </th>
      <th scope="col" style={{ width: 60 }}>
        <ImageIcon className="w-4 h-4" aria-hidden="true" style={{ color: "#8c8f94" }} />
        <span className="sr-only">Image</span>
      </th>
      <th scope="col">Name</th>
      <th scope="col" className="wp-hide-sm">SKU</th>
      <th scope="col" className="wp-hide-sm">Stock</th>
      <th scope="col" className="wp-hide-sm">Price</th>
      <th scope="col" className="wp-hide-sm">Categories</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Date</th>
    </tr>
  );

  return (
    <RequirePermission permission="products.view">
    <Page>
      <PageHeader
        title="Products"
        actions={<Link href="/admin/products/new" className="wp-btn">Add new product</Link>}
      />

      {/* Status filter links */}
      <div className="wp-subsub" role="tablist" aria-label="Filter products by status">
        <button type="button" role="tab" aria-selected={view === "all"} className={view === "all" ? "is-current" : undefined} onClick={() => setView("all")}>
          All <span className="wp-count">({counts.all})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "published"} className={view === "published" ? "is-current" : undefined} onClick={() => setView("published")}>
          Published <span className="wp-count">({counts.published})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "trash"} className={view === "trash" ? "is-current" : undefined} onClick={() => setView("trash")}>
          Trash <span className="wp-count">({view === "trash" ? products.length : "-"})</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="wp-toolbar">
        <label htmlFor="products-bulk-action" className="sr-only">Select bulk action</label>
        <select
          id="products-bulk-action"
          className="wp-select"
          value={bulkAction}
          onChange={(e) => setBulkAction(e.target.value)}
        >
          <option>Bulk actions</option>
          {view === "trash" ? (
            <option>Delete Permanently</option>
          ) : (
            <>
              <option>Move to Trash</option>
              <option>Duplicate</option>
            </>
          )}
        </select>
        <button type="button" onClick={handleBulkAction} className="wp-btn">
          Apply
        </button>

        <label htmlFor="products-filter-category" className="sr-only">Filter by category</label>
        <select
          id="products-filter-category"
          className="wp-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option>All categories</option>
          {categories.map(cat => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
        </select>

        <label htmlFor="products-filter-stock" className="sr-only">Filter by stock status</label>
        <select
          id="products-filter-stock"
          className="wp-select"
          value={selectedStock}
          onChange={(e) => setSelectedStock(e.target.value)}
        >
          <option>All stock</option>
          <option>In stock</option>
          <option>Low stock</option>
          <option>Out of stock</option>
        </select>

        <label htmlFor="products-filter-type" className="sr-only">Filter by product type</label>
        <select
          id="products-filter-type"
          className="wp-select"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="All types">All types</option>
          <option value="simple">Simple product</option>
          <option value="variable">Variable product</option>
          <option value="gifting">Gifting product</option>
        </select>

        <button type="button" className="wp-btn">
          Filter
        </button>

        <span className="wp-spacer" />

        <div className="wp-search" role="search">
          <label htmlFor="products-search" className="sr-only">Search products</label>
          <input
            id="products-search"
            type="search"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="wp-input"
          />
          <button type="button" className="wp-btn">
            Search products
          </button>
        </div>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>

      {/* Data Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="wp-muted">Loading products…</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={9} className="wp-muted">No products found.</td></tr>
            ) : (
              filteredProducts.map((p) => (
                <tr key={p._id} className={selectedIds.includes(p._id) ? "is-selected" : undefined}>
                  <td className="wp-check-col">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.name}`}
                      checked={selectedIds.includes(p._id)}
                      onChange={() => toggleSelect(p._id)}
                    />
                  </td>
                  <td>
                    <div className="wp-thumb">
                      {p.images?.length > 0 ? <img src={p.images[0]} alt="" /> : <ImageIcon className="w-5 h-5" aria-hidden="true" style={{ color: "#a7aaad" }} />}
                    </div>
                  </td>
                  <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                    <Link href={`/admin/products/${p._id}`} className="wp-row-title">{p.name}</Link>
                    <div className="wp-mobile-meta">
                      {p.sku ? `SKU: ${p.sku} · ` : ""}
                      <span className={stockClass(p)}>{stockLabel(p)}</span>
                      {" · "}
                      <span className="wp-strong">${p.price?.toFixed(2)}</span>
                    </div>
                    <div className="wp-row-actions">
                      <span className="is-muted">ID: {String(p._id).slice(-6)}</span>
                      {view === "trash" ? (
                        <>
                          <span><button type="button" onClick={() => handleRestoreProduct(p._id)}>Restore</button></span>
                          <span><button type="button" onClick={() => handlePermanentDeleteProduct(p._id, p.name)} className="is-danger">Delete Permanently</button></span>
                        </>
                      ) : (
                        <>
                          <span><Link href={`/admin/products/${p._id}`}>Edit</Link></span>
                          <span><button type="button" onClick={() => openQuickEdit(p)}>Quick Edit</button></span>
                          <span><button type="button" onClick={() => handleDuplicate(p)}>Duplicate</button></span>
                          <span><button type="button" onClick={() => handleTrash(p._id)} className="is-danger">Trash</button></span>
                          <span>
                            <Link href={getProductUrl({
                              ...p,
                              categories: p.categories?.map(id => categories.find(c => c._id === id)).filter(Boolean),
                              primaryCategory: p.primaryCategory ? categories.find(c => c._id === p.primaryCategory) : null
                            })} target="_blank">View</Link>
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="wp-hide-sm wp-muted" style={{ wordBreak: "break-all" }}>{p.sku || "—"}</td>
                  <td className="wp-hide-sm">
                    <span className={stockClass(p)}>{stockLabel(p)}</span>
                  </td>
                  <td className="wp-hide-sm">
                    <span className="wp-price"><ins>${p.price?.toFixed(2)}</ins></span>
                  </td>
                  <td className="wp-hide-sm">
                    {p.categories?.length > 0 ? (
                      p.categories.map((catId, idx) => {
                        const cat = categories.find(c => c._id === catId);
                        return (
                          <React.Fragment key={catId}>
                            <span className="wp-link">{cat?.name || "—"}</span>
                            {idx < p.categories.length - 1 && ", "}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <span className="wp-muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={async () => {
                        const newStatus = p.status === 'Published' ? 'Draft' : 'Published';
                        const res = await fetch("/api/admin/products", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: p._id, status: newStatus })
                        });
                        if (res.ok) fetchProducts();
                      }}
                      title={p.status === 'Published' ? "Click to switch to Draft" : "Click to publish"}
                      aria-label={`Status: ${p.status}. Toggle status`}
                      className={`wp-pill ${p.status === 'Published' ? 'wp-st-published' : 'wp-st-draft'}`}
                      style={{ border: 0, cursor: "pointer" }}
                    >
                      {p.status}
                    </button>
                  </td>
                  <td className="wp-hide-sm wp-muted">
                    {formatDate(p.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>

      {/* Quick Edit Modal */}
      {quickEditId && (
        <div className="wp-modal-backdrop">
          <div className="wp-modal" role="dialog" aria-modal="true" aria-labelledby="quick-edit-title">
            <div className="wp-modal-head">
              <h2 id="quick-edit-title" style={{ minWidth: 0, wordBreak: "break-word" }}>Quick Edit — {quickEditData.name}</h2>
              <button type="button" onClick={() => setQuickEditId(null)} className="wp-notice-dismiss" aria-label="Close quick edit"><X className="w-5 h-5" /></button>
            </div>
            <div className="wp-modal-body grid grid-cols-1 md:grid-cols-2 gap-x-5">
              <div>
                <div className="wp-field">
                  <label htmlFor="qe-name" className="wp-label">Title</label>
                  <input id="qe-name" className="wp-input wp-full" value={quickEditData.name} onChange={e => setQuickEditData({...quickEditData, name: e.target.value})} />
                </div>
                <div className="wp-field">
                  <label htmlFor="qe-slug" className="wp-label">Slug</label>
                  <input id="qe-slug" className="wp-input wp-full" style={{ fontFamily: "monospace" }} value={quickEditData.slug} onChange={e => setQuickEditData({...quickEditData, slug: e.target.value})} />
                </div>
              </div>
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <div className="wp-field">
                    <label htmlFor="qe-price" className="wp-label">Price ($)</label>
                    <input id="qe-price" type="number" className="wp-input wp-full" value={quickEditData.price} onChange={e => setQuickEditData({...quickEditData, price: parseFloat(e.target.value)})} />
                  </div>
                  <div className="wp-field">
                    <label htmlFor="qe-sku" className="wp-label">SKU</label>
                    <input id="qe-sku" className="wp-input wp-full uppercase" value={quickEditData.sku} onChange={e => setQuickEditData({...quickEditData, sku: e.target.value})} />
                  </div>
                </div>
                <div className="wp-field">
                  <label htmlFor="qe-status" className="wp-label">Status</label>
                  <select id="qe-status" className="wp-select wp-full" value={quickEditData.status} onChange={e => setQuickEditData({...quickEditData, status: e.target.value})}>
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="wp-modal-foot">
              <button type="button" onClick={() => setQuickEditId(null)} className="wp-btn">Cancel</button>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch("/api/admin/products", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...quickEditData, id: quickEditId })
                  });
                  if (res.ok) {
                    setQuickEditId(null);
                    fetchProducts();
                  }
                }}
                className="wp-btn wp-btn-primary"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
    </RequirePermission>
  );
}
