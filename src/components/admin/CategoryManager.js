"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Search, Plus, Trash2, Edit, ExternalLink, ImageIcon, Check, FileText } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CategoryManager({ type = "product", title = "Categories" }) {
  const router = useRouter();
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
    if (!confirm("Are you sure?")) return;
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
     if (confirm(`Apply "${bulkAction}" to ${selectedIds.length} categories?`)) {
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

  const breadcrumbs = type === "product" 
    ? [{ label: "WooCommerce", href: "/admin/orders" }, { label: "Categories" }]
    : [{ label: "Blog", href: "/admin/blogs" }, { label: "Categories" }];

  const newLink = type === 'product' ? '/admin/products/categories/new' : '/admin/blogs/categories/new';
  const getEditLink = (id) => type === 'product' ? `/admin/products/categories/${id}` : `/admin/blogs/categories/${id}`;

  return (
    <AdminPageLayout 
      title={title} 
      breadcrumbs={breadcrumbs}
      addNewLink={newLink}
      addNewLabel="Add New"
    >
      <div className="space-y-4">
        {/* View Tabs */}
        <ul className="flex items-center gap-2 text-[13px] text-[#2271b1]">
           <li className="text-[#1d2327] font-semibold cursor-pointer">
              All <span className="text-[#646970] font-normal">({categories.length})</span>
           </li>
        </ul>

        {/* Filter Bar */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
           <div className="flex items-center gap-2">
              <select className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1 rounded-[3px] outline-none" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
                 <option>Bulk actions</option>
                 <option>Duplicate</option>
                 <option>Move to Trash</option>
                 <option>Delete Permanently</option>
              </select>
              <button onClick={handleBulkAction} className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Apply</button>
           </div>
           <div className="flex items-center gap-2 w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Search categories..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-[#8c8f94] outline-none px-3 py-1 text-[13px] flex-1 md:w-64 bg-white focus:border-[#2271b1] rounded-[3px]"
              />
              <button className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Search Categories</button>
           </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse table-fixed text-[13px] min-w-[800px]">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                <th className="px-3 py-2 w-8 text-center"><input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === filteredCategories.length} onChange={toggleSelectAll} /></th>
                <th className="px-3 py-2 w-16 text-center"><ImageIcon className="w-4 h-4 mx-auto text-[#8c8f94]" /></th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Name</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-48">Slug</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-24">Status</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-20 text-right">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center italic text-gray-400">Loading...</td></tr>
              ) : filteredCategories.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center italic text-gray-400">No categories found.</td></tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr key={cat._id} className={`hover:bg-[#f6f7f7] group transition-colors ${selectedIds.includes(cat._id) ? "bg-[#f0f6fa]" : ""}`}>
                    <td className="px-3 py-4 text-center align-top"><input type="checkbox" checked={selectedIds.includes(cat._id)} onChange={() => toggleSelect(cat._id)} /></td>
                    <td className="px-3 py-4 text-center align-top">
                       <div className="w-10 h-10 bg-white border border-[#dcdcde] rounded-[2px] mx-auto overflow-hidden">
                          {cat.image ? <img src={cat.image} className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-[#dcdcde] mt-2.5 mx-auto" />}
                       </div>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <div className="flex flex-col">
                         <Link href={getEditLink(cat._id)} className="text-[#2271b1] font-bold hover:underline block mb-1">{cat.name}</Link>
                         <div className="flex flex-wrap items-center gap-x-2 gap-y-1 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#2271b1] font-medium">
                            <Link href={getEditLink(cat._id)} className="hover:text-[#135e96]">Edit</Link>
                            <span className="text-[#c3c4c7]">|</span>
                            <button onClick={() => handleDuplicate(cat)} className="hover:text-[#135e96]">Duplicate</button>
                            <span className="text-[#c3c4c7]">|</span>
                            <button onClick={() => handleDelete(cat._id)} className="text-[#d63638] hover:text-[#bc0b0d]">Trash</button>
                            <span className="text-[#c3c4c7]">|</span>
                            <Link href={`/shop?category=${cat.slug}`} target="_blank" className="hover:text-[#135e96]">View</Link>
                         </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 align-top font-mono text-gray-500">{cat.slug}</td>
                    <td className="px-3 py-4 align-top">
                       <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase ${cat.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {cat.status || "Published"}
                       </span>
                    </td>
                    <td className="px-3 py-4 align-top font-bold text-[#2271b1] text-right">{cat.productCount || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageLayout>
  );
}

