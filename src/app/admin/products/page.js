"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Image as ImageIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Notice, Skeleton, formatDate, formatMoney } from "@/components/admin/ui";
import { getProductUrl } from "@/lib/routes";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { paginate, parseRequiredPrice } from "@/lib/admin-products-utils";

export default function AdminProducts() {
  const { showConfirm } = usePopup();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All categories");
  const [selectedStock, setSelectedStock] = useState("All stock");
  const [selectedType, setSelectedType] = useState("All types");
  const [categories, setCategories] = useState([]);
  const [view, setView] = useState("all"); 
  const [quickEditId, setQuickEditId] = useState(null);
  const [quickEditData, setQuickEditData] = useState(null);
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const [counts, setCounts] = useState({ all: 0, published: 0, draft: 0, trash: 0 });
  const [page, setPage] = useState(1);

  // Any change to what is listed (filters, search, view) goes back to page 1 and drops the selection
  const resetPaging = () => {
    setPage(1);
    setSelectedIds([]);
  };

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products?counts=true");
      if (res.ok) {
        const data = await res.json();
        setCounts({
          all: data.all || 0,
          published: data.published || 0,
          draft: data.draft || 0,
          trash: data.trash || 0,
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const requestRef = useRef(0);
  const fetchProducts = useCallback(async () => {
    const reqId = ++requestRef.current; // only the newest request may update the list
    setLoading(true);
    try {
      let url = "/api/admin/products";
      if (view === "trash") url += "?isDeleted=true";
      else if (view === "published") url += "?status=Published";
      else if (view === "draft") url += "?status=Draft";
      
      const res = await fetch(url);
      const data = await res.json();
      if (reqId !== requestRef.current) return;
      if (res.ok) {
         setProducts(Array.isArray(data) ? data : []);
         setLoadError("");
      } else {
         setLoadError(data?.error || "Failed to load products");
      }
    } catch (err) {
      console.error(err);
      if (reqId === requestRef.current) setLoadError("Failed to load products");
    } finally {
      if (reqId === requestRef.current) setLoading(false);
    }
    fetchCounts();
  }, [view, fetchCounts]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories?type=product");
      const data = await res.json();
      if (res.ok) setCategories(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const errorFrom = async (res, fallback) => {
    const data = await res.json().catch(() => ({}));
    return data?.error || fallback;
  };

  const handleTrash = async (id) => {
    if (!(await showConfirm("Move this product to trash?", "Move to Trash"))) return;
    try {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Product moved to trash"); fetchProducts(); }
      else toast.error(await errorFrom(res, "Failed to move product to trash"));
    } catch (err) {
      console.error(err);
      toast.error("Failed to move product to trash");
    }
  };

  const handleRestoreProduct = async (id) => {
    try {
      // The API restores the status the product had before it was trashed (Draft if unknown)
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDeleted: false })
      });
      if (res.ok) { toast.success("Product restored"); fetchProducts(); }
      else toast.error(await errorFrom(res, "Failed to restore product"));
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore product");
    }
  };

  const handlePermanentDeleteProduct = async (id, name) => {
    if (!(await showConfirm(`Are you sure you want to permanently delete "${name}"? This cannot be undone.`, "Delete permanently", { confirmText: "Delete permanently", danger: true }))) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Product permanently deleted"); fetchProducts(); }
      else toast.error(await errorFrom(res, "Failed to delete product"));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete product");
    }
  };

  // Server copies the full product and picks a unique "<slug>-copy[-N]" slug
  const duplicateProduct = async (id) => {
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateOf: id })
    });
    return res;
  };

  const handleDuplicate = async (product) => {
     try {
        const res = await duplicateProduct(product._id);
        if (res.ok) {
           toast.success("Product duplicated as a draft");
           fetchProducts();
        } else {
           toast.error(await errorFrom(res, "Failed to duplicate product"));
        }
     } catch (err) {
        console.error("Duplicate failed:", err);
        toast.error("Failed to duplicate product");
     }
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions") { toast.error("Choose a bulk action first"); return; }
     if (selectedIds.length === 0) { toast.error("Select at least one product"); return; }
     const isPermanent = bulkAction === "Delete Permanently";
     const confirmed = await showConfirm(
        isPermanent
           ? `Permanently delete ${selectedIds.length} product${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`
           : `Apply "${bulkAction}" to ${selectedIds.length} product${selectedIds.length === 1 ? "" : "s"}?`,
        isPermanent ? "Delete permanently" : "Bulk action",
        isPermanent ? { confirmText: "Delete permanently", danger: true } : { confirmText: bulkAction }
     );
     if (!confirmed) return;
     setBulkRunning(true);
     let ok = 0;
     let failed = 0;
     for (const id of selectedIds) {
        try {
           let res = null;
           if (bulkAction === "Move to Trash") {
              res = await fetch(`/api/admin/products?id=${id}`, { method: "DELETE" });
           } else if (bulkAction === "Duplicate") {
              res = await duplicateProduct(id);
           } else if (bulkAction === "Restore") {
              res = await fetch("/api/admin/products", {
                 method: "PUT",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ id, isDeleted: false })
              });
           } else if (isPermanent) {
              res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
           }
           if (res?.ok) ok++;
           else failed++;
        } catch (err) {
           console.error("Bulk action failed:", err);
           failed++;
        }
     }
     setBulkRunning(false);
     setSelectedIds([]);
     setBulkAction("Bulk actions");
     fetchProducts();
     if (failed === 0) toast.success(`${bulkAction}: ${ok} done`);
     else toast.error(`${bulkAction}: ${ok} done, ${failed} failed`);
  };

  const handleToggleStatus = async (p) => {
    const oldStatus = p.status;
    const newStatus = oldStatus === 'Published' ? 'Draft' : 'Published';
    // Optimistic update, reverted if the save fails
    setProducts(prev => prev.map(x => x._id === p._id ? { ...x, status: newStatus } : x));
    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p._id, status: newStatus })
      });
      if (res.ok) {
        fetchProducts();
        return;
      }
      toast.error(await errorFrom(res, "Failed to update status"));
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
    setProducts(prev => prev.map(x => x._id === p._id ? { ...x, status: oldStatus } : x));
  };

  const openQuickEdit = (p) => {
    setQuickEditId(p._id);
    setQuickEditData({
      name: p.name,
      slug: p.slug,
      price: p.price ?? "",
      status: p.status,
      sku: p.sku
    });
  };

  const handleQuickEditSave = async () => {
    const parsed = parseRequiredPrice(quickEditData.price);
    if (parsed.error) {
      toast.error(parsed.error);
      return;
    }
    setQuickEditSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quickEditData, price: parsed.value, id: quickEditId })
      });
      if (res.ok) {
        const saved = await res.json().catch(() => ({}));
        toast.success("Product updated");
        if (saved?.slug && quickEditData.slug && saved.slug !== quickEditData.slug) {
          toast(`Slug saved as "${saved.slug}" (the one entered was taken or not URL-safe).`);
        }
        setQuickEditId(null);
        fetchProducts();
      } else {
        toast.error(await errorFrom(res, "Failed to update product"));
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update product");
    } finally {
      setQuickEditSaving(false);
    }
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Deep links from other screens: /admin/products?category=<id>&status=published|draft|trash
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    const status = (params.get("status") || "").toLowerCase();
    const viewFromStatus = { published: "published", draft: "draft", drafts: "draft", trash: "trash", all: "all" }[status];
    Promise.resolve().then(() => {
      if (category) setSelectedCategory(category);
      if (viewFromStatus) setView(viewFromStatus);
    });
  }, []);

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
    
    // selectedCategory holds a category id (so ?category=<id> links work), or "All categories"
    const matchesCategory = selectedCategory === "All categories" ||
                            p.categories?.some(catId => String(catId) === selectedCategory) ||
                            String(p.primaryCategory || "") === selectedCategory;

    const matchesStock = selectedStock === "All stock" ||
                         (selectedStock === "In stock" && (!p.manageStock || p.stock > (p.lowStockThreshold || 5))) ||
                         (selectedStock === "Low stock" && p.manageStock && p.stock > 0 && p.stock <= (p.lowStockThreshold || 5)) ||
                         (selectedStock === "Out of stock" && p.manageStock && p.stock <= 0);

    const matchesType = selectedType === "All types" || p.productType === selectedType;

    return matchesSearch && matchesCategory && matchesStock && matchesType;
  });

  const { items: pageProducts, page: currentPage, totalPages } = paginate(filteredProducts, page);
  const visibleIds = pageProducts.map(p => p._id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const someSelected = visibleIds.some(id => selectedIds.includes(id));

  const toggleSelectAll = () => {
     if (allSelected) setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
     else setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
  };

  const goToPage = (n) => {
    setPage(Math.min(Math.max(1, n), totalPages));
    setSelectedIds([]);
  };

  const changeView = (v) => {
    setView(v);
    setBulkAction("Bulk actions");
    resetPaging();
  };

  const filtersActive = searchTerm.trim() || selectedCategory !== "All categories" || selectedStock !== "All stock" || selectedType !== "All types";
  const emptyText = filtersActive
    ? "No products match your search or filters."
    : view === "trash"
      ? "No products in the Trash."
      : view === "draft"
        ? "No draft products."
        : view === "published"
          ? "No published products."
          : "No products yet. Click “Add new product” to create the first one.";

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

  const pagination = (
    <div className="wp-pages">
      <span>{filteredProducts.length} {filteredProducts.length === 1 ? "item" : "items"}</span>
      <button type="button" className="wp-pager" aria-label="First page" disabled={currentPage <= 1} onClick={() => goToPage(1)}><ChevronsLeft className="w-4 h-4" /></button>
      <button type="button" className="wp-pager" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}><ChevronLeft className="w-4 h-4" /></button>
      <span>{currentPage} of {totalPages}</span>
      <button type="button" className="wp-pager" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}><ChevronRight className="w-4 h-4" /></button>
      <button type="button" className="wp-pager" aria-label="Last page" disabled={currentPage >= totalPages} onClick={() => goToPage(totalPages)}><ChevronsRight className="w-4 h-4" /></button>
    </div>
  );

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all products"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
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
      <th scope="col" className="wp-hide-sm wp-num">Price</th>
      <th scope="col" className="wp-hide-sm">Categories</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">{view === "trash" ? "Trashed" : "Date"}</th>
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
        <button type="button" role="tab" aria-selected={view === "all"} className={view === "all" ? "is-current" : undefined} onClick={() => changeView("all")}>
          All <span className="wp-count">({counts.all})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "published"} className={view === "published" ? "is-current" : undefined} onClick={() => changeView("published")}>
          Published <span className="wp-count">({counts.published})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "draft"} className={view === "draft" ? "is-current" : undefined} onClick={() => changeView("draft")}>
          Drafts <span className="wp-count">({counts.draft})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "trash"} className={view === "trash" ? "is-current" : undefined} onClick={() => changeView("trash")}>
          Trash <span className="wp-count">({counts.trash})</span>
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
        <button type="button" onClick={handleBulkAction} disabled={bulkRunning} className="wp-btn">
          {bulkRunning ? "Applying…" : "Apply"}
        </button>

        <label htmlFor="products-filter-category" className="sr-only">Filter by category</label>
        <select
          id="products-filter-category"
          className="wp-select"
          value={selectedCategory}
          onChange={(e) => { setSelectedCategory(e.target.value); resetPaging(); }}
        >
          <option>All categories</option>
          {categories.map(cat => <option key={cat._id} value={String(cat._id)}>{cat.name}</option>)}
          {selectedCategory !== "All categories" && !categories.some(c => String(c._id) === selectedCategory) && (
            <option value={selectedCategory}>Linked category</option>
          )}
        </select>

        <label htmlFor="products-filter-stock" className="sr-only">Filter by stock status</label>
        <select
          id="products-filter-stock"
          className="wp-select"
          value={selectedStock}
          onChange={(e) => { setSelectedStock(e.target.value); resetPaging(); }}
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
          onChange={(e) => { setSelectedType(e.target.value); resetPaging(); }}
        >
          <option value="All types">All types</option>
          <option value="simple">Simple product</option>
          <option value="variable">Variable product</option>
          <option value="gifting">Gifting product</option>
        </select>

        <span className="wp-spacer" />

        {/* Results filter live as you type; Search / Enter submits the same term */}
        <form
          className="wp-search"
          role="search"
          onSubmit={(e) => { e.preventDefault(); resetPaging(); }}
        >
          <label htmlFor="products-search" className="sr-only">Search products</label>
          <input
            id="products-search"
            type="search"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); resetPaging(); }}
            className="wp-input"
          />
          <button type="submit" className="wp-btn">
            Search products
          </button>
        </form>
      </div>

      {loadError && (
        <Notice type="error" onDismiss={() => setLoadError("")}>
          {loadError}.{" "}
          <button type="button" className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={fetchProducts}>Try again</button>
        </Notice>
      )}

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>

      {/* Data Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading && products.length === 0 ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={`sk-${i}`} aria-hidden="true">
                  <td className="wp-check-col" />
                  <td><Skeleton height={40} width={40} /></td>
                  <td><Skeleton height={14} width="60%" /><Skeleton height={12} width="40%" style={{ marginTop: 6 }} /></td>
                  <td className="wp-hide-sm"><Skeleton height={14} width={60} /></td>
                  <td className="wp-hide-sm"><Skeleton height={14} width={70} /></td>
                  <td className="wp-hide-sm"><Skeleton height={14} width={60} style={{ marginLeft: "auto" }} /></td>
                  <td className="wp-hide-sm"><Skeleton height={14} width="70%" /></td>
                  <td><Skeleton height={22} width={70} /></td>
                  <td className="wp-hide-sm"><Skeleton height={14} width={80} /></td>
                </tr>
              ))
            ) : pageProducts.length === 0 ? (
              <tr><td colSpan={9} className="wp-empty" style={{ padding: "14px 10px" }}>{emptyText}</td></tr>
            ) : (
              pageProducts.map((p) => (
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
                      <span className="wp-strong">{formatMoney(p.price)}</span>
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
                  <td className="wp-hide-sm" style={{ whiteSpace: "nowrap" }}>
                    <span className={stockClass(p)}>{stockLabel(p)}</span>
                  </td>
                  <td className="wp-hide-sm wp-num" style={{ whiteSpace: "nowrap" }}>
                    <span className="wp-price"><ins>{formatMoney(p.price)}</ins></span>
                  </td>
                  <td className="wp-hide-sm">
                    {(() => {
                      // Only categories that still exist (a deleted category id is skipped)
                      const known = (p.categories || []).map(catId => categories.find(c => c._id === catId)).filter(Boolean);
                      if (known.length === 0) return <span className="wp-muted">—</span>;
                      return known.map((cat, idx) => (
                        <React.Fragment key={cat._id}>
                          <span className="wp-link">{cat.name}</span>
                          {idx < known.length - 1 && ", "}
                        </React.Fragment>
                      ));
                    })()}
                  </td>
                  <td>
                    {view === "trash" ? (
                      <span className="wp-pill wp-st-draft">Trash</span>
                    ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(p)}
                      title={p.status === 'Published' ? "Click to switch to Draft" : "Click to publish"}
                      aria-label={`Status: ${p.status}. Toggle status`}
                      className={`wp-pill ${p.status === 'Published' ? 'wp-st-published' : 'wp-st-draft'}`}
                      style={{ border: 0, cursor: "pointer" }}
                    >
                      {p.status}
                    </button>
                    )}
                  </td>
                  <td className="wp-hide-sm wp-muted" style={{ whiteSpace: "nowrap" }}>
                    {formatDate(view === "trash" ? (p.deletedAt || p.updatedAt || p.createdAt) : p.createdAt)}
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
                    <input id="qe-price" type="number" min="0" step="0.01" inputMode="decimal" required className="wp-input wp-full" value={quickEditData.price} onChange={e => setQuickEditData({...quickEditData, price: e.target.value})} />
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
                onClick={handleQuickEditSave}
                disabled={quickEditSaving}
                className="wp-btn wp-btn-primary"
              >
                {quickEditSaving ? "Updating…" : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
    </RequirePermission>
  );
}
