"use client";

import React, { useEffect, useState, useCallback } from "react";
import { 
  Search, 
  Plus, 
  Image as ImageIcon,
  ExternalLink,
  AlertCircle,
  Circle,
  TrendingUp,
  Infinity,
  Copy,
  Trash2,
  Edit,
  Eye,
  Check,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { getProductUrl } from "@/lib/routes";
import { usePopup } from "@/context/PopupContext";

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
        body: JSON.stringify({ id, isDeleted: false, status: 'Draft', tenantId: "DEFAULT_STORE" })
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

  return (
    <AdminPageLayout 
      title="Products" 
      addNewLink="/admin/products/new"
      addNewLabel="Add New"
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Products" }]}
    >
      <div className="space-y-4">
        {/* View Tabs */}
        <ul className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#2271b1] select-none font-sans">
          <li className={`${view === "all" ? "text-[#1d2327] font-semibold" : "cursor-pointer hover:text-[#135e96]"}`} onClick={() => setView("all")}>
            All <span className="text-[#646970] font-normal">({counts.all})</span>
          </li>
          <span className="text-[#c3c4c7] font-normal">|</span>
          <li className={`${view === "published" ? "text-[#1d2327] font-semibold" : "cursor-pointer hover:text-[#135e96]"}`} onClick={() => setView("published")}>
            Published <span className="text-[#646970] font-normal">({counts.published})</span>
          </li>
          <span className="text-[#c3c4c7] font-normal">|</span>
          <li className={`${view === "trash" ? "text-[#1d2327] font-semibold" : "cursor-pointer hover:text-[#135e96]"}`} onClick={() => setView("trash")}>
            Trash <span className="text-[#646970] font-normal">({view === "trash" ? products.length : "-"})</span>
          </li>
        </ul>

        {/* Filter Bar */}
        <div className="bg-white border border-[#ccd0d4] p-2.5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm font-sans">
          <div className="flex flex-wrap items-center gap-2">
            <select 
              className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1 rounded-[3px] outline-none cursor-pointer focus:border-[#2271b1]" 
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
            <button 
              type="button"
              onClick={handleBulkAction} 
              className="border border-[#8c8f94] text-[#3c434a] px-3 py-1.5 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1] cursor-pointer hover:text-[#000] active:bg-[#eee]"
            >
              Apply
            </button>
            
            <select 
              className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1.5 rounded-[3px] outline-none cursor-pointer focus:border-[#2271b1] ml-2" 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option>All categories</option>
              {categories.map(cat => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
            </select>

            <select 
              className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1.5 rounded-[3px] outline-none cursor-pointer focus:border-[#2271b1] ml-1" 
              value={selectedStock} 
              onChange={(e) => setSelectedStock(e.target.value)}
            >
              <option>All stock</option>
              <option>In stock</option>
              <option>Low stock</option>
              <option>Out of stock</option>
            </select>

            <select 
              className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1.5 rounded-[3px] outline-none cursor-pointer focus:border-[#2271b1] ml-1" 
              value={selectedType} 
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option>All types</option>
              <option>Simple product</option>
              <option>Variable product</option>
            </select>

            <button 
              type="button"
              className="border border-[#8c8f94] text-[#3c434a] px-3 py-1.5 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1] cursor-pointer hover:text-[#000] active:bg-[#eee]"
            >
              Filter
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-[#8c8f94] outline-none px-3 py-1.5 text-[13px] flex-1 md:w-48 bg-white focus:border-[#2271b1] rounded-[3px]"
            />
            <button 
              type="button"
              className="border border-[#8c8f94] text-[#3c434a] px-3 py-1.5 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1] cursor-pointer"
            >
              Search Products
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse table-fixed min-w-[950px] text-[13px] font-sans">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4] text-[#2c3539]">
                <th className="px-3 py-2.5 w-9 text-center align-middle"><input type="checkbox" checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length} onChange={toggleSelectAll} className="rounded-[2px] border-gray-300" /></th>
                <th className="px-3 py-2.5 w-16 text-center align-middle"><ImageIcon className="w-4 h-4 text-[#8c8f94] mx-auto" /></th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-auto">Name</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-36">Categories</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-28">SKU</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-32 text-center">Stock</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-24">Price</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-24">Status</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-32">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1] text-[#2c3539]">
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400 italic">Loading catalog...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-500 italic">No products found.</td></tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p._id} className={`hover:bg-[#f6f7f7] group transition-colors ${selectedIds.includes(p._id) ? "bg-[#f0f6fa]" : ""}`}>
                    <td className="px-3 py-3 text-center align-top pt-3.5"><input type="checkbox" checked={selectedIds.includes(p._id)} onChange={() => toggleSelect(p._id)} className="rounded-[2px] border-gray-300" /></td>
                    <td className="px-3 py-3 text-center align-top pt-3.5">
                      <div className="w-10 h-10 bg-white border border-[#dcdcde] rounded-[2px] mx-auto overflow-hidden">
                        {p.images?.length > 0 ? <img src={p.images[0]} className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-[#dcdcde] mt-2.5 mx-auto" />}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top pt-3.5">
                      <Link href={`/admin/products/${p._id}`} className="text-[#2271b1] font-bold hover:text-[#135e96] text-[14px] block mb-0.5 leading-tight">{p.name}</Link>
                      <div className="flex flex-wrap items-center gap-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#2271b1] font-medium mt-1">
                        {view === "trash" ? (
                          <>
                            <button onClick={() => handleRestoreProduct(p._id)} className="hover:text-[#135e96] cursor-pointer">Restore</button>
                            <span className="text-[#c3c4c7] font-normal">|</span>
                            <button onClick={() => handlePermanentDeleteProduct(p._id, p.name)} className="hover:text-[#bc0b0d] cursor-pointer">Delete Permanently</button>
                          </>
                        ) : (
                          <>
                            <Link href={`/admin/products/${p._id}`} className="hover:text-[#135e96]">Edit</Link>
                            <span className="text-[#c3c4c7] font-normal">|</span>
                            <button onClick={() => openQuickEdit(p)} className="hover:text-[#135e96] cursor-pointer">Quick Edit</button>
                            <span className="text-[#c3c4c7] font-normal">|</span>
                            <button onClick={() => handleDuplicate(p)} className="hover:text-[#135e96] cursor-pointer">Duplicate</button>
                            <span className="text-[#c3c4c7] font-normal">|</span>
                            <button onClick={() => handleTrash(p._id)} className="hover:text-[#bc0b0d] cursor-pointer">Trash</button>
                            <span className="text-[#c3c4c7] font-normal">|</span>
                            <Link href={getProductUrl({
                              ...p,
                              categories: p.categories?.map(id => categories.find(c => c._id === id)).filter(Boolean),
                              primaryCategory: p.primaryCategory ? categories.find(c => c._id === p.primaryCategory) : null
                            })} target="_blank" className="hover:text-[#135e96]">View</Link>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top pt-3.5">
                      <div className="flex flex-wrap gap-1 leading-normal">
                        {p.categories?.length > 0 ? (
                          p.categories.map((catId, idx) => {
                            const cat = categories.find(c => c._id === catId);
                            return (
                              <React.Fragment key={catId}>
                                <span className="text-[#2271b1] hover:underline cursor-pointer">{cat?.name || "—"}</span>
                                {idx < p.categories.length - 1 && <span className="text-gray-400">, </span>}
                              </React.Fragment>
                            );
                          })
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top pt-3.5 text-[#646970] font-mono leading-normal">{p.sku || "—"}</td>
                    <td className="px-3 py-3 align-top pt-3 text-center">
                      <span className={`inline-block font-semibold text-[11.5px] ${
                        !p.manageStock 
                          ? "text-[#7ad03a]" 
                          : p.stock <= 0 
                            ? "text-[#a00] font-bold" 
                            : p.stock <= (p.lowStockThreshold || 5)
                              ? "text-[#ffb900] font-bold"
                              : "text-[#7ad03a]"
                      }`}>
                        {!p.manageStock 
                          ? "In stock" 
                          : p.stock <= 0 
                            ? "Out of stock" 
                            : p.stock <= (p.lowStockThreshold || 5)
                              ? `Low stock (${p.stock})`
                              : `In stock (${p.stock})`}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top pt-3.5 font-bold text-neutral-800">${p.price?.toFixed(2)}</td>
                    <td className="px-3 py-3 align-top pt-3">
                      <button 
                        type="button"
                        onClick={async () => {
                          const newStatus = p.status === 'Published' ? 'Draft' : 'Published';
                          const res = await fetch("/api/admin/products", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: p._id, status: newStatus, tenantId: "DEFAULT_STORE" })
                          });
                          if (res.ok) fetchProducts();
                        }}
                        className={`px-2 py-0.5 rounded-[3px] border text-[10px] font-bold uppercase transition-colors cursor-pointer ${p.status === 'Published' ? 'bg-[#e5f5fa] text-[#0073aa] border-[#0073aa]/20 hover:bg-[#d1ecf1]' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'}`}
                      >
                        {p.status}
                      </button>
                    </td>
                    <td className="px-3 py-3 align-top pt-3.5 text-[#646970] leading-normal">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Quick Edit Overlay */}
        {quickEditId && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#ccd0d4] shadow-2xl w-full max-w-2xl rounded-[3px] overflow-hidden animate-in fade-in zoom-in duration-150">
              <div className="bg-[#f6f7f7] border-b border-[#ccd0d4] px-4 py-3 flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-[#1d2327]">Quick Edit — {quickEditData.name}</h3>
                <button onClick={() => setQuickEditId(null)} className="text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 font-sans">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-bold mb-1 text-gray-700">Title</label>
                    <input className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1]" value={quickEditData.name} onChange={e => setQuickEditData({...quickEditData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold mb-1 text-gray-700">Slug</label>
                    <input className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] font-mono text-gray-500 outline-none focus:border-[#2271b1]" value={quickEditData.slug} onChange={e => setQuickEditData({...quickEditData, slug: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-bold mb-1 text-gray-700">Price ($)</label>
                      <input type="number" className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1]" value={quickEditData.price} onChange={e => setQuickEditData({...quickEditData, price: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold mb-1 text-gray-700">SKU</label>
                      <input className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] uppercase outline-none focus:border-[#2271b1]" value={quickEditData.sku} onChange={e => setQuickEditData({...quickEditData, sku: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold mb-1 text-gray-700">Status</label>
                    <select className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] cursor-pointer" value={quickEditData.status} onChange={e => setQuickEditData({...quickEditData, status: e.target.value})}>
                      <option value="Draft">Draft</option>
                      <option value="Published">Published</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="bg-[#f6f7f7] border-t border-[#ccd0d4] px-4 py-3 flex items-center justify-between">
                <button onClick={() => setQuickEditId(null)} className="text-[13px] text-[#2271b1] hover:text-[#135e96] underline font-medium">Cancel</button>
                <button 
                  onClick={async () => {
                    const res = await fetch("/api/admin/products", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ...quickEditData, id: quickEditId, tenantId: "DEFAULT_STORE" })
                    });
                    if (res.ok) {
                      setQuickEditId(null);
                      fetchProducts();
                    }
                  }}
                  className="bg-[#2271b1] text-white px-4 py-1.5 rounded-[3px] font-bold text-[13px] hover:bg-[#135e96] cursor-pointer"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between text-[13px] text-[#646970] font-sans">
          <div>{filteredProducts.length} items</div>
          <div className="flex items-center gap-1">
            <button className="p-1 border border-[#ccd0d4] bg-[#f6f7f7] hover:bg-[#f0f0f1] rounded disabled:opacity-50 cursor-pointer"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
            <span className="px-2">1 of 1</span>
            <button className="p-1 border border-[#ccd0d4] bg-[#f6f7f7] hover:bg-[#f0f0f1] rounded disabled:opacity-50 cursor-pointer"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
