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
   Eye,
   Edit
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
   const [activeFormTab, setActiveFormTab] = useState("content");
   const [editSlug, setEditSlug] = useState(false);
   const [editorMode, setEditorMode] = useState("visual");
   const [formData, setFormData] = useState({
      title: "",
      slug: "",
      content: "",
      excerpt: "",
      image: "",
      category: "",
      status: "Draft",
      publishedAt: new Date().toISOString().split('T')[0],
      heritage: "",
      process: "",
      style: "",
      featuredProductId: "",
      featuredProductData: {
         name: "",
         image: ""
      },
      showFeaturedProduct: true,
      showSidebarIndex: true,
      seo: {
         title: "",
         description: "",
         keywords: [],
         focusKeyword: "",
         canonicalUrl: "",
         noIndex: false,
         noFollow: false,
         ogTitle: "",
         ogDescription: "",
         ogImage: "",
         twitterTitle: "",
         twitterDescription: "",
         twitterImage: "",
         structuredData: ""
      },
      faqs: []
   });

   const [categories, setCategories] = useState([]);
   const [products, setProducts] = useState([]);

   useEffect(() => {
      const fetchData = async () => {
         try {
            const [catsRes, prodsRes] = await Promise.all([
               fetch("/api/admin/categories?type=blog"),
               fetch("/api/admin/products")
            ]);

            if (!catsRes.ok || !prodsRes.ok) {
               throw new Error("Authentication failed or server returned an error.");
            }

            const cats = await catsRes.json();
            const prods = await prodsRes.json();

            setCategories(Array.isArray(cats) ? cats : []);
            setProducts(Array.isArray(prods) ? prods : (prods.products || []));

            if (blogId) {
               const blogRes = await fetch(`/api/admin/blogs?id=${blogId}`);
               if (!blogRes.ok) {
                  throw new Error("Failed to fetch blog post details.");
               }
               const data = await blogRes.json();
               setFormData(prev => ({
                   ...prev,
                   showFeaturedProduct: data.showFeaturedProduct !== false,
                   showSidebarIndex: data.showSidebarIndex !== false,
                   ...data,
                   category: data.category === "Uncategorized" ? "" : (data.category || ""),
                   publishedAt: data.publishedAt ? new Date(data.publishedAt).toISOString().split('T')[0] : (data.createdAt ? new Date(data.createdAt).toISOString().split('T')[0] : prev.publishedAt),
                   seo: {
                     title: "", description: "", keywords: [], focusKeyword: "",
                     canonicalUrl: "", noIndex: false, noFollow: false,
                     ogTitle: "", ogDescription: "", ogImage: "",
                     twitterTitle: "", twitterDescription: "", twitterImage: "",
                     structuredData: "",
                     ...(data.seo || {})
                   },
                   faqs: data.faqs || []
                }));
            }
            setLoading(false);
         } catch (err) {
            console.error("Fetch failed", err);
            setLoading(false);
         }
      };

      fetchData();
   }, [blogId]);

   const handleTrash = async () => {
      if (!blogId) return;
      if (!confirm("Are you sure you want to move this post to trash?")) return;
      try {
         const res = await fetch(`/api/admin/blogs?id=${blogId}`, {
            method: "DELETE"
         });
         if (res.ok) {
            alert("Blog post moved to trash successfully.");
            router.push("/admin/blogs");
         } else {
            const errData = await res.json().catch(() => ({}));
            alert(`Failed to move to trash: ${errData.error || res.statusText || "Unknown error"}`);
         }
      } catch (err) {
         console.error(err);
         alert(`Network Error: ${err.message}`);
      }
   };

   useEffect(() => {
      if (typeof window !== 'undefined') {
         const params = new URLSearchParams(window.location.search);
         const tab = params.get("tab");
         if (tab && (tab === "content" || tab === "seo")) {
            setActiveFormTab(tab);
         }
      }
   }, []);

   const handleSubmit = async (e) => {
      e.preventDefault();
      setSaving(true);
      try {
         const method = blogId ? "PUT" : "POST";
         // Strip immutable Mongoose fields that cause _id update errors
         const { _id, __v, createdAt, updatedAt, ...cleanData } = formData;
         const payload = blogId ? { ...cleanData, id: blogId } : cleanData;
         console.log("[BlogForm] Submitting seo:", payload.seo);
         const res = await fetch("/api/admin/blogs", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
         });
         if (res.ok) {
            const savedBlog = await res.json();
            alert(blogId ? "Blog post updated successfully!" : "Blog post created successfully!");
            if (!blogId && savedBlog._id) {
               router.push(`/admin/blogs/${savedBlog._id}`);
            }
         } else {
            const errData = await res.json().catch(() => ({}));
            alert(`Save failed: ${errData.error || res.statusText || "Unknown error"}`);
            console.error("[BlogForm] Save failed:", errData);
         }
      } catch (err) {
         console.error(err);
         alert(`Network Error: ${err.message}`);
      } finally {
         setSaving(false);
      }
   };

    if (loading) return <div className="p-10 text-[13px] text-gray-400 bg-[#f0f2f1] min-h-screen">Loading editor...</div>;
 
    if (blogId && !formData.title) {
       return (
          <div className="p-10 text-center bg-[#f0f2f1] min-h-screen flex flex-col items-center justify-center gap-4">
             <div className="bg-white p-8 border border-[#c3c4c7] max-w-md w-full text-left shadow-sm rounded-sm">
                <h2 className="text-[#d63638] font-bold text-[16px] mb-2">
                   Failed to load blog data
                </h2>
                <p className="text-gray-600 text-[13px] mb-6 leading-relaxed">
                   Your administrator session may have expired, or the blog post you are trying to edit does not exist. Please try logging back in.
                </p>
                <div className="flex flex-col gap-2.5">
                   <button 
                      type="button" 
                      onClick={() => window.location.reload()} 
                      className="w-full bg-[#2271b1] text-white px-4 py-2 text-[12px] font-bold hover:bg-[#135e96] transition-all text-center rounded-sm"
                   >
                      Retry Connection / Reload
                   </button>
                   <a 
                      href="/admin-login" 
                      className="w-full border border-[#c3c4c7] text-gray-700 px-4 py-2 text-[12px] font-bold bg-[#f6f7f7] hover:bg-[#f0f0f1] transition-all text-center block rounded-sm"
                   >
                      Log In to Admin Panel
                   </a>
                   <a 
                      href="/admin/blogs" 
                      className="w-full text-[#2271b1] text-[12px] hover:underline text-center mt-2 block"
                   >
                      ← Back to Blogs List
                   </a>
                </div>
             </div>
          </div>
       );
    }
 
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
                     className="w-full border border-[#c3c4c7] focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] rounded-lg outline-none px-4 py-2.5 text-[20px] bg-white shadow-sm font-semibold transition-all"
                     value={formData.title}
                     onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                  <div className="text-[12px] text-gray-500 px-1 mt-1 flex items-center gap-1.5 flex-wrap">
                     <span>Permalink:</span>
                     <span className="text-gray-400 font-mono">pairo.store/blog/</span>
                     <input
                        readOnly={!editSlug}
                        className={`outline-none text-[#2271b1] font-mono px-1.5 py-0.5 rounded transition-all text-xs ${
                           editSlug ? "border border-[#c3c4c7] bg-white ring-1 ring-[#2271b1]/20" : "border-none bg-transparent pointer-events-none"
                        }`}
                        style={{ width: `${Math.max(60, (formData.slug || "").length * 8.5)}px` }}
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                     />
                     {!editSlug ? (
                        <button
                           type="button"
                           onClick={() => setEditSlug(true)}
                           className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                        >
                           <Edit className="w-3.5 h-3.5" />
                        </button>
                     ) : (
                        <button
                           type="button"
                           onClick={() => setEditSlug(false)}
                           className="text-[10px] text-green-600 hover:underline font-bold"
                        >
                           Done
                        </button>
                     )}
                  </div>
               </div>

               {/* Content / SEO Tabs */}
               <div className="flex border-b border-[#ccd0d4] gap-6 select-none pb-0">
                  <button
                     type="button"
                     onClick={() => setActiveFormTab("content")}
                     className={`pb-2.5 text-[14px] font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
                        activeFormTab === "content"
                           ? "border-[#2271b1] text-[#2271b1]"
                           : "border-transparent text-gray-500 hover:text-black"
                     }`}
                  >
                     Content Editor
                  </button>
                  <button
                     type="button"
                     onClick={() => setActiveFormTab("seo")}
                     className={`pb-2.5 text-[14px] font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
                        activeFormTab === "seo"
                           ? "border-[#2271b1] text-[#2271b1]"
                           : "border-transparent text-gray-500 hover:text-black"
                     }`}
                  >
                     SEO Settings
                  </button>
                  <button
                     type="button"
                     onClick={() => setActiveFormTab("faq")}
                     className={`pb-2.5 text-[14px] font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
                        activeFormTab === "faq"
                           ? "border-[#2271b1] text-[#2271b1]"
                           : "border-transparent text-gray-500 hover:text-black"
                     }`}
                  >
                     FAQ Settings
                  </button>
               </div>

               {activeFormTab === "content" && (
                  <>
                     {/* Content Meta Box (General) */}
                     <div className="bg-white border border-[#c3c4c7] shadow-sm">
                        <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700 flex justify-between items-center">
                           <span>General Content</span>
                           <div className="flex gap-2 text-xs">
                              <button
                                 type="button"
                                 onClick={() => setEditorMode("visual")}
                                 className={`px-3 py-1 font-semibold rounded ${editorMode === "visual" ? "bg-white border border-[#c3c4c7] text-[#2271b1]" : "text-gray-600 hover:text-black"}`}
                              >
                                 Visual
                              </button>
                              <button
                                 type="button"
                                 onClick={() => setEditorMode("html")}
                                 className={`px-3 py-1 font-semibold rounded ${editorMode === "html" ? "bg-white border border-[#c3c4c7] text-[#2271b1]" : "text-gray-600 hover:text-black"}`}
                              >
                                 HTML
                              </button>
                           </div>
                        </div>
                        {editorMode === "visual" ? (
                           <TiptapEditor
                              content={formData.content}
                              onChange={(html) => setFormData({ ...formData, content: html })}
                           />
                        ) : (
                           <textarea
                              className="w-full p-4 font-mono text-[13px] outline-none border-none min-h-[350px] bg-[#fcfcfc] focus:bg-white transition-colors"
                              placeholder="Type HTML content here..."
                              value={formData.content}
                              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                           />
                        )}
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
                  </>
               )}

               {activeFormTab === "seo" && (
                  <SEOConfigPanel
                     seo={formData.seo || {}}
                     onChange={newSeo => setFormData(prev => ({ ...prev, seo: newSeo }))}
                     parentTitle={formData.title}
                     parentDescription={formData.excerpt || formData.content}
                     parentSlug={formData.slug}
                     parentImage={formData.image}
                     parentType="blog"
                  />
               )}

               {activeFormTab === "faq" && (
                  <div className="bg-white border border-[#c3c4c7] shadow-sm p-6 space-y-6">
                     <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                        <h2 className="text-[14px] font-bold text-gray-700">Frequently Asked Questions</h2>
                        <button
                           type="button"
                           onClick={() => {
                              const faqs = [...(formData.faqs || [])];
                              faqs.push({ question: "", answer: "" });
                              setFormData({ ...formData, faqs });
                           }}
                           className="bg-[#2271b1] hover:bg-[#135e96] text-white px-3 py-1.5 rounded-[3px] text-[11px] font-bold transition-colors"
                        >
                           Add FAQ Item
                        </button>
                     </div>
                     
                     {(!formData.faqs || formData.faqs.length === 0) ? (
                        <div className="text-center py-10 text-gray-400 text-xs">
                           No FAQ items have been added to this blog post yet. Click &quot;Add FAQ Item&quot; to begin.
                        </div>
                     ) : (
                        <div className="space-y-4">
                           {formData.faqs.map((faq, idx) => (
                              <div key={idx} className="border border-[#ccd0d4] rounded-[3px] p-4 bg-[#fcfcfc] space-y-3 relative group">
                                 <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-600">FAQ Item #{idx + 1}</span>
                                    <button
                                       type="button"
                                       onClick={() => {
                                          const faqs = formData.faqs.filter((_, i) => i !== idx);
                                          setFormData({ ...formData, faqs });
                                       }}
                                       className="text-red-600 hover:text-red-800 text-[11px] font-bold"
                                    >
                                       Delete
                                    </button>
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-600 block">Question</label>
                                    <input
                                       type="text"
                                       className="w-full border border-[#ccd0d4] rounded-[3px] px-3 py-1.5 text-[12px] outline-none focus:border-[#2271b1]"
                                       placeholder="e.g. What leather is used for this product?"
                                       value={faq.question}
                                       onChange={(e) => {
                                          const faqs = [...formData.faqs];
                                          faqs[idx].question = e.target.value;
                                          setFormData({ ...formData, faqs });
                                       }}
                                    />
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-600 block">Answer</label>
                                    <textarea
                                       rows={3}
                                       className="w-full border border-[#ccd0d4] rounded-[3px] px-3 py-1.5 text-[12px] outline-none focus:border-[#2271b1] resize-none"
                                       placeholder="Enter the detailed answer..."
                                       value={faq.answer}
                                       onChange={(e) => {
                                          const faqs = [...formData.faqs];
                                          faqs[idx].answer = e.target.value;
                                          setFormData({ ...formData, faqs });
                                       }}
                                    />
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               )}
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
                        <button type="button" onClick={() => formData.slug && window.open(`/blog/${formData.slug}`, '_blank')} className="text-[#2271b1] underline text-[12px]" title={formData.slug ? `Preview /blog/${formData.slug}` : 'Save first to preview'}>Preview</button>
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
                        <div className="flex items-center justify-between pt-2">
                            <p><span className="text-gray-400">Published Date:</span></p>
                            <input 
                                type="date"
                                className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-[#2271b1] bg-white text-black"
                                value={formData.publishedAt}
                                onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
                            />
                        </div>
                     </div>
                     <div className="flex items-center justify-between bg-[#f6f7f7] -mx-3 -mb-3 p-3 border-t border-[#ccd0d4]">
                        {blogId ? (
                           <button type="button" onClick={handleTrash} className="text-[#d63638] underline text-[12px]">Move to Trash</button>
                        ) : (
                           <div />
                        )}
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
                                 onChange={() => setFormData({...formData, category: formData.category === cat.name ? "" : cat.name})}
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

                {/* Sidebar Settings Box */}
                <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[2px]">
                   <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Sidebar Controls</div>
                   <div className="p-4 space-y-3">
                      <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer">
                         <input 
                            type="checkbox"
                            checked={formData.showFeaturedProduct}
                            onChange={(e) => setFormData({...formData, showFeaturedProduct: e.target.checked})}
                            className="rounded border-[#c3c4c7] text-[#2271b1] focus:ring-[#2271b1] w-4 h-4"
                         />
                         Enable Featured Product
                      </label>
                      <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer">
                         <input 
                            type="checkbox"
                            checked={formData.showSidebarIndex}
                            onChange={(e) => setFormData({...formData, showSidebarIndex: e.target.checked})}
                            className="rounded border-[#c3c4c7] text-[#2271b1] focus:ring-[#2271b1] w-4 h-4"
                         />
                         Enable Sidebar Index (TOC)
                      </label>
                   </div>
                </div>
             </div>
         </form>
    </AdminPageLayout>
   );
}
