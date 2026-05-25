"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
   ChevronLeft, 
   Save, 
   Globe, 
   Image as ImageIcon, 
   ChevronDown,
   Calendar,
   Eye
} from "lucide-react";
import dynamic from 'next/dynamic';
const TiptapEditor = dynamic(() => import('./TiptapEditor'), { ssr: false });
import MediaPicker from "@/components/admin/MediaPicker";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import SEOConfigPanel from "@/components/admin/SEOConfigPanel";

export default function BlogForm({ blogId }) {
   const router = useRouter();
   const [loading, setLoading] = useState(blogId ? true : false);
   const [saving, setSaving] = useState(false);
   const [formData, setFormData] = useState({
      title: "",
      slug: "",
      content: "",
      excerpt: "",
      image: "",
      category: "Uncategorized",
      status: "Draft",
      heritage: "",
      process: "",
      style: "",
      featuredProductId: "",
      featuredProductData: {
         name: "",
         image: ""
      },
      seo: {
         title: "",
         description: "",
         keywords: ""
      }
   });

   const [categories, setCategories] = useState([]);
   const [products, setProducts] = useState([]);

   useEffect(() => {
      fetch("/api/admin/categories?type=blog")
         .then(res => res.json())
         .then(data => setCategories(Array.isArray(data) ? data : []));

      // Fetch products for the dropdown
      fetch("/api/admin/products")
         .then(res => res.json())
         .then(data => {
            const productList = Array.isArray(data) ? data : (data.products || []);
            setProducts(productList);
         });

      if (blogId) {
         fetch(`/api/admin/blogs?id=${blogId}`)
            .then(res => res.json())
            .then(data => {
               setFormData({
                  ...data,
                  category: data.category || "Uncategorized",
                  seo: data.seo || { title: "", description: "", keywords: "" }
               });
               setLoading(false);
            });
      }
   }, [blogId]);

   const handleSubmit = async (e) => {
      e.preventDefault();
      setSaving(true);
      try {
         const method = blogId ? "PUT" : "POST";
         const res = await fetch("/api/admin/blogs", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(blogId ? { ...formData, id: blogId } : formData)
         });
         if (res.ok) {
            router.push("/admin/blogs");
         } else {
            const data = await res.json();
            alert(`Error: ${data.error || "Failed to save blog"}`);
         }
      } catch (err) {
         console.error(err);
         alert(`Network Error: ${err.message}`);
      } finally {
         setSaving(false);
      }
   };

   if (loading) return <div className="p-10 text-[13px] text-gray-400 bg-[#f0f2f1] min-h-screen">Loading editor...</div>;

   return (
    <AdminPageLayout 
      title={blogId ? "Edit Blog" : "Add New Blog"} 
      addNewLink="/admin/blogs/new"
      addNewLabel="Add New"
      breadcrumbs={[{ label: "Blog", href: "/admin/blogs" }, { label: blogId ? "Edit" : "New" }]}
    >
         <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
            {/* Main Column */}
            <div className="lg:col-span-3 space-y-4">
               <div className="space-y-1">
                  <input
                     required
                     placeholder="Enter title here"
                     className="w-full border border-[#c3c4c7] outline-none px-3 py-2 text-[20px] bg-white shadow-inner font-semibold"
                     value={formData.title}
                     onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                  <div className="text-[12px] text-gray-500 px-1 mt-1 flex items-center gap-1">
                     Permalink: <span className="text-gray-400">pairo.store/blog/</span>
                     <input className="border-none bg-transparent outline-none text-[#2271b1] font-mono w-fit min-w-[50px]" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} />
                  </div>
               </div>

               {/* Content Meta Box (General) */}
               <div className="bg-white border border-[#c3c4c7] shadow-sm">
                  <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">General Content</div>
                  <TiptapEditor
                     content={formData.content}
                     onChange={(html) => setFormData({ ...formData, content: html })}
                  />
               </div>

               {/* Heritage Section */}
               <div className="bg-white border border-[#c3c4c7] shadow-sm">
                  <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Section 01: Heritage</div>
                  <TiptapEditor
                     content={formData.heritage}
                     onChange={(html) => setFormData({ ...formData, heritage: html })}
                  />
               </div>

               {/* Process Section */}
               <div className="bg-white border border-[#c3c4c7] shadow-sm">
                  <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Section 02: Process</div>
                  <TiptapEditor
                     content={formData.process}
                     onChange={(html) => setFormData({ ...formData, process: html })}
                  />
               </div>

               {/* Style Section */}
               <div className="bg-white border border-[#c3c4c7] shadow-sm">
                  <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Section 03: Style</div>
                  <TiptapEditor
                     content={formData.style}
                     onChange={(html) => setFormData({ ...formData, style: html })}
                  />
               </div>

               {/* Excerpt Meta Box */}
               <div className="bg-white border border-[#c3c4c7] shadow-sm">
                  <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Excerpt</div>
                  <div className="p-0">
                     <textarea
                        rows={4}
                        className="w-full p-4 text-[13px] outline-none border-none resize-none leading-relaxed bg-[#fcfcfc] focus:bg-white transition-colors"
                        placeholder="Add a brief summary of the post..."
                        value={formData.excerpt}
                        onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                     />
                  </div>
               </div>

               {/* SEO Meta Box */}
               <SEOConfigPanel
                  seo={formData.seo || {}}
                  onChange={newSeo => setFormData({ ...formData, seo: newSeo })}
                  parentTitle={formData.title}
                  parentDescription={formData.excerpt || formData.content}
                  parentSlug={formData.slug}
                  parentImage={formData.image}
                  parentType="blog"
               />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
               {/* Publish Box */}
               <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[2px]">
                  <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Publish</div>
                  <div className="p-3 space-y-4">
                     <div className="flex justify-between items-center">
                        <button 
                            type="button" 
                            onClick={handleSubmit}
                            className="border border-[#c3c4c7] px-3 py-1.5 rounded-[3px] bg-[#f6f7f7] hover:bg-[#f0f0f1] text-[12px] font-medium"
                        >
                            Save Draft
                        </button>
                        <button type="button" className="text-[#2271b1] underline text-[12px]">Preview</button>
                     </div>
                     <div className="space-y-3 py-3 border-y border-gray-100 text-[13px]">
                        <div className="flex items-center justify-between">
                            <p><span className="text-gray-400">Status:</span> <strong>{formData.status}</strong></p>
                            <select 
                                className="text-[11px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-[#2271b1]"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="Draft">Draft</option>
                                <option value="Published">Published</option>
                            </select>
                        </div>
                        <p className="flex items-center gap-2"><span className="text-gray-400">Visibility:</span> <strong>Public</strong> <button type="button" className="text-[#2271b1] underline ml-auto text-[12px]">Edit</button></p>
                        <p className="flex items-center gap-2"><span className="text-gray-400"><Calendar className="w-3.5 h-3.5 inline mr-1" /> Publish immediately</span> <button type="button" className="text-[#2271b1] underline ml-auto text-[12px]">Edit</button></p>
                     </div>
                     <div className="flex items-center justify-between bg-[#f6f7f7] -mx-3 -mb-3 p-3 border-t border-[#ccd0d4]">
                        <button type="button" className="text-[#d63638] underline text-[12px]">Move to Trash</button>
                        <button 
                           type="submit" 
                           disabled={saving}
                           className="bg-[#2271b1] text-white px-4 py-2 rounded-[3px] text-[13px] font-bold hover:bg-[#135e96] disabled:opacity-50"
                        >
                           {saving ? "Publishing..." : (blogId ? "Update" : "Publish")}
                        </button>
                     </div>
                  </div>
               </div>

               {/* Categories Box */}
               <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[2px]">
                  <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700 flex items-center justify-between">
                     <span>Categories</span>
                     <button type="button" onClick={() => router.push("/admin/blogs/categories")} className="text-[10px] text-[#2271b1] hover:underline font-normal">Manage</button>
                  </div>
                  <div className="p-3 max-h-48 overflow-y-auto space-y-2">
                     {categories.length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic">No categories found.</p>
                     ) : (
                        categories.map(cat => (
                           <label key={cat._id} className="flex items-center gap-2 text-[13px] cursor-pointer">
                              <input 
                                 type="checkbox" 
                                 className="w-4 h-4 rounded border-gray-300 text-[#2271b1] focus:ring-[#2271b1]" 
                                 checked={formData.category === cat.name}
                                 onChange={() => setFormData({...formData, category: cat.name})}
                              />
                              {cat.name}
                           </label>
                        ))
                     )}
                  </div>
               </div>

                {/* Featured Image Box */}
                <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[2px]">
                   <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Featured Image</div>
                   <div className="p-4">
                      <MediaPicker 
                         value={formData.image}
                         onChange={(url) => setFormData({...formData, image: url})}
                         label="Set featured image"
                      />
                   </div>
                </div>

                {/* Featured Product Box */}
                <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[2px]">
                   <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Featured Product</div>
                   <div className="p-4 space-y-4">
                      <div className="space-y-1.5">
                         <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Select Product</label>
                         <select 
                            className="w-full border border-[#c3c4c7] p-2 text-[13px] outline-none focus:border-[#2271b1] bg-white"
                            value={formData.featuredProductId || ""} 
                            onChange={(e) => setFormData({...formData, featuredProductId: e.target.value})}
                         >
                            <option value="">— Select a Product —</option>
                            {products.map(product => (
                               <option key={product._id} value={product._id || product.slug}>
                                  {product.name}
                               </option>
                            ))}
                         </select>
                         <p className="text-[10px] text-gray-400">Choose a product to feature in the sidebar.</p>
                      </div>
                   </div>
                </div>
             </div>
         </form>
    </AdminPageLayout>
   );
}
