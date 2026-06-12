"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Trash2, 
  RefreshCw, 
  X, 
  Package, 
  Layers, 
  FileText,
  AlertTriangle,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";

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
        payload = { id, isDeleted: false, status: 'Draft', tenantId: "DEFAULT_STORE" };
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
        fetchTrash();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to restore");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to restore item");
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
        setConfirmModal({ open: false, type: "", id: null, name: "" });
        fetchTrash();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete permanently");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting item permanently");
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

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Link href="/admin" className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <h1 className="text-3xl font-bold uppercase tracking-tighter text-red-500">Trash Bin</h1>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/30">Restore or permanently purge soft-deleted resources.</p>
        </div>
        <button onClick={fetchTrash} className="bg-gray-100 hover:bg-gray-200 text-black px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/5 gap-8">
        <button 
          onClick={() => setActiveTab("products")}
          className={`pb-4 text-[11px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'products' ? 'text-black font-black' : 'text-black/30 hover:text-black/60'}`}
        >
          Products ({products.length})
          {activeTab === 'products' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-red-500" />}
        </button>
        <button 
          onClick={() => setActiveTab("categories")}
          className={`pb-4 text-[11px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'categories' ? 'text-black font-black' : 'text-black/30 hover:text-black/60'}`}
        >
          Categories ({categories.length})
          {activeTab === 'categories' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-red-500" />}
        </button>
        <button 
          onClick={() => setActiveTab("blogs")}
          className={`pb-4 text-[11px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'blogs' ? 'text-black font-black' : 'text-black/30 hover:text-black/60'}`}
        >
          Blogs ({blogs.length})
          {activeTab === 'blogs' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-red-500" />}
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-[40px] border border-black/5 shadow-sm p-20 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-black/20 mx-auto" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-black/30 mt-4">Retrieving deleted items...</p>
        </div>
      ) : activeItemsCount === 0 ? (
        <div className="bg-white rounded-[40px] border border-black/5 shadow-sm p-20 text-center space-y-6">
          <div className="w-16 h-16 bg-gray-50 border border-black/5 text-black/30 rounded-full flex items-center justify-center mx-auto">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.2em]">Trash is empty</h2>
            <p className="text-[10px] text-black/30 font-bold uppercase tracking-wide leading-relaxed">No soft-deleted {activeTab} exist in the database.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-black/5 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-black/5 text-[9px] font-black uppercase tracking-widest text-black/40">
                <th className="px-6 py-4">Resource Info</th>
                {activeTab === "products" && <th className="px-6 py-4">SKU / Code</th>}
                {activeTab === "products" && <th className="px-6 py-4">Price</th>}
                {activeTab === "categories" && <th className="px-6 py-4">Type</th>}
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 text-xs">
              {activeTab === "products" && products.map(p => (
                <tr key={p._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-12 bg-gray-100 rounded-lg overflow-hidden border border-black/5 shrink-0">
                        {p.images?.[0] && <img src={p.images[0]} className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-black text-[13px]">{p.name}</h4>
                        <p className="text-[9px] text-black/30 uppercase tracking-widest font-mono mt-1">ID: {p._id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-mono text-[11px] text-black/50">{p.sku || "—"}</td>
                  <td className="px-6 py-5 font-bold">${p.price?.toFixed(2)}</td>
                  <td className="px-6 py-5 text-right space-x-2">
                    <button onClick={() => handleRestore("product", p._id)} className="bg-black text-white hover:bg-black/80 px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all">
                      Restore
                    </button>
                    <button onClick={() => openConfirmModal("product", p._id, p.name)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all">
                      Delete Permanently
                    </button>
                  </td>
                </tr>
              ))}
              
              {activeTab === "categories" && categories.map(c => (
                <tr key={c._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div>
                      <h4 className="font-bold text-black text-[13px]">{c.name}</h4>
                      <p className="text-[10px] text-black/40 mt-0.5">slug: {c.slug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-bold uppercase tracking-widest text-[9px] text-black/40">{c.type || "product"}</td>
                  <td className="px-6 py-5 text-right space-x-2">
                    <button onClick={() => handleRestore("category", c._id)} className="bg-black text-white hover:bg-black/80 px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all">
                      Restore
                    </button>
                    <button onClick={() => openConfirmModal("category", c._id, c.name)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all">
                      Delete Permanently
                    </button>
                  </td>
                </tr>
              ))}

              {activeTab === "blogs" && blogs.map(b => (
                <tr key={b._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      {b.image && (
                        <div className="w-12 h-10 bg-gray-100 rounded-lg overflow-hidden border border-black/5 shrink-0">
                          <img src={b.image} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-black text-[13px]">{b.title}</h4>
                        <p className="text-[10px] text-black/40 mt-0.5">Author: {b.author || "Pairo Studio"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right space-x-2">
                    <button onClick={() => handleRestore("blog", b._id)} className="bg-black text-white hover:bg-black/80 px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all">
                      Restore
                    </button>
                    <button onClick={() => openConfirmModal("blog", b._id, b.title)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all">
                      Delete Permanently
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Safety Alert */}
      <div className="bg-red-50 border border-red-100 p-6 rounded-[24px] flex items-start gap-4">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-red-900">Safety Notice</h4>
          <p className="text-[10px] text-red-700/60 uppercase leading-relaxed font-bold tracking-tight">
            Permanent purging removes documents from collections and cleans references across products, categories, blogs, and media usage indexes. This action is final and cannot be undone.
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
          <div className="bg-white rounded-[32px] max-w-md w-full border border-black/5 shadow-2xl p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-black/5 pb-4">
              <div className="flex items-center gap-2.5 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-[12px] font-black uppercase tracking-widest">Confirm Purge</h3>
              </div>
              <button onClick={() => setConfirmModal({ open: false, type: "", id: null, name: "" })} className="p-1 text-black/30 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              <p className="text-[11px] text-black/50 font-bold uppercase tracking-wider">Are you sure you want to permanently delete this {confirmModal.type}?</p>
              <p className="text-sm font-black text-black bg-gray-50 border border-black/[0.03] p-4 rounded-xl font-mono truncate">{confirmModal.name}</p>
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-wide leading-relaxed">
                * All references, media links, and relations will be severed. This operation is IRREVERSIBLE.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setConfirmModal({ open: false, type: "", id: null, name: "" })}
                disabled={processing}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-black py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handlePermanentDelete}
                disabled={processing}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {processing ? "Purging..." : "Purge Document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
