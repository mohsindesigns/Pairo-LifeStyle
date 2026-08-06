"use client";

import React, { useEffect, useState } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import MediaPicker from "@/components/admin/MediaPicker";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
const TiptapEditor = dynamic(() => import('@/components/admin/TiptapEditor'), { ssr: false });
import SEOConfigPanel from "@/components/admin/SEOConfigPanel";
import { Pencil, ExternalLink } from "lucide-react";

export default function CategoryForm({ categoryId = null, type = "product" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(categoryId ? true : false);
  const [saving, setSaving] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemSearchTerm, setItemSearchTerm] = useState("");

  const [activeTab, setActiveTab] = useState("content");
  const [slugLocked, setSlugLocked] = useState(true);
  const [editorMode, setEditorMode] = useState("visual");

  const [formData, setFormData] = useState({
    _id: null,
    name: "",
    slug: "",
    description: "",
    content: "",
    image: "",
    banner: "",
    status: "Published",
    isFeatured: false,
    seo: { title: "", description: "", keywords: [], canonicalUrl: "", ogTitle: "", ogDescription: "", ogImage: "", noIndex: false, noFollow: false },
    linkedItems: [],
    type: type,
    faqs: [],
    faqSchemaCustom: "",
    sizeChart: ""
  });
  const [sizeCharts, setSizeCharts] = useState([]);

  const fetchCategory = async () => {
    try {
      const res = await fetch(`/api/admin/categories?type=${type}`);
      const data = await res.json();
      const cat = data.find(c => c._id === categoryId);
      if (cat) {
        setFormData(prev => ({
          ...prev,
          ...cat,
          sizeChart: cat.sizeChart || "",
          faqs: cat.faqs || [],
          faqSchemaCustom: cat.faqSchemaCustom || "",
          seo: { ...prev.seo, ...(cat.seo || {}) }
        }));
        return cat;
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  };

  const fetchAvailableItems = async (fetchedCat) => {
    try {
      const endpoint = type === 'product' ? '/api/admin/products' : '/api/admin/blogs';
      const res = await fetch(`${endpoint}?status=Published`);
      const data = await res.json();
      if (res.ok) {
         const items = Array.isArray(data) ? data : (data.products || []);
         setAvailableItems(items);
         
         if (categoryId) {
            let currentLinked = [];
            if (type === 'product') {
               currentLinked = items.filter(p => (p.categories || []).includes(categoryId)).map(p => p._id);
            } else if (fetchedCat && fetchedCat.name) {
               currentLinked = items.filter(b => b.category === fetchedCat.name).map(b => b._id);
            }
            setFormData(prev => ({...prev, linkedItems: currentLinked}));
         }
      }
    } catch (err) {
       console.error("Failed to fetch available items", err);
    }
  };

  useEffect(() => {
    const init = async () => {
        let cat = null;
        if (categoryId) cat = await fetchCategory();
        await fetchAvailableItems(cat);
        if (type === "product") {
          await fetchSizeCharts();
        }
        setLoading(false);
    };
    const fetchSizeCharts = async () => {
      try {
        const res = await fetch("/api/admin/size-charts");
        if (res.ok) {
          const data = await res.json();
          setSizeCharts(data.filter(sc => sc.status === "Published" && !sc.isDeleted));
        }
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, [categoryId, type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = formData._id ? "PUT" : "POST";
      const body = { ...formData, id: formData._id };
      
      const res = await fetch("/api/admin/categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const savedCat = await res.json();
        alert(categoryId ? "Category updated successfully!" : "Category created successfully!");
        if (!categoryId && savedCat._id) {
          router.push(type === 'product' ? `/admin/products/categories/${savedCat._id}` : `/admin/blogs/categories/${savedCat._id}`);
        }
      } else {
        const data = await res.json();
        alert("Error saving category: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save category. Check console.");
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = availableItems.filter(i => 
    i.title?.toLowerCase().includes(itemSearchTerm.toLowerCase()) || 
    i.name?.toLowerCase().includes(itemSearchTerm.toLowerCase())
  );

  const breadcrumbs = type === "product"
    ? [{ label: "WooCommerce", href: "/admin/orders" }, { label: "Categories", href: "/admin/categories" }, { label: categoryId ? "Edit" : "New" }]
    : [{ label: "Blog", href: "/admin/blogs" }, { label: "Categories", href: "/admin/blogs/categories" }, { label: categoryId ? "Edit" : "New" }];

  if (loading) return <div className="p-10 text-[13px] font-medium text-gray-500 bg-[#f0f2f1] min-h-screen">Loading editor...</div>;

  return (
    <AdminPageLayout 
      title={categoryId ? "Edit Category" : "Add New Category"} 
      breadcrumbs={breadcrumbs}
      addNewLink={type === 'product' ? "/admin/products/categories/new" : "/admin/blogs/categories/new"}
      addNewLabel="Add New"
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
         {/* Main Column */}
         <div className="lg:col-span-3 space-y-4">
            <div className="space-y-1">
                <input
                   required
                   placeholder="Enter title here"
                   className="w-full border border-[#c3c4c7] focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] rounded-lg outline-none px-4 py-2.5 text-[20px] bg-white shadow-sm font-semibold transition-all"
                   value={formData.name}
                  onChange={(e) => {
                     const name = e.target.value;
                     const slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
                     setFormData({...formData, name, slug: formData._id ? formData.slug : slug});
                  }}
               />
               <div className="text-[12px] text-gray-500 px-1 mt-1 flex flex-wrap items-center gap-1.5">
                  <span>Permalink:</span>
                  <span className="text-gray-400 font-mono">
                    pairolifestyle.com/{type === 'product' ? 'collections' : 'blog'}/
                  </span>
                  {slugLocked ? (
                    <>
                      <span className="font-mono text-[#2271b1] font-semibold">{formData.slug || <span className="text-gray-300 italic">auto-generated</span>}</span>
                      <button
                        type="button"
                        title="Edit permalink"
                        onClick={() => setSlugLocked(false)}
                        className="ml-1 p-0.5 rounded hover:bg-gray-100 transition text-gray-400 hover:text-[#2271b1]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        className="border border-[#2271b1] bg-white outline-none text-[#2271b1] font-mono rounded px-1 py-0.5 text-[12px] min-w-[120px]"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setSlugLocked(true)}
                        className="text-[11px] text-[#2271b1] underline"
                      >OK</button>
                    </>
                  )}
               </div>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-[#c3c4c7] mb-4 gap-1">
               <button
                  type="button"
                  onClick={() => setActiveTab("content")}
                  className={`px-4 py-2 text-[13px] font-bold border-t border-x rounded-t-[3px] -mb-[1px] transition-colors ${
                     activeTab === "content"
                        ? "bg-white border-[#c3c4c7] border-b-white text-gray-700"
                        : "bg-[#eaeaea] border-transparent text-[#2271b1] hover:text-[#135e96]"
                  }`}
               >
                  Content
               </button>
               <button
                  type="button"
                  onClick={() => setActiveTab("faq")}
                  className={`px-4 py-2 text-[13px] font-bold border-t border-x rounded-t-[3px] -mb-[1px] transition-colors ${
                     activeTab === "faq"
                        ? "bg-white border-[#c3c4c7] border-b-white text-gray-700"
                        : "bg-[#eaeaea] border-transparent text-[#2271b1] hover:text-[#135e96]"
                  }`}
               >
                  FAQ ({formData.faqs?.length || 0})
               </button>
            </div>

            {activeTab === "content" ? (
               <>
                  {/* Short Description — shown in banner overlay */}
                  <div className="bg-white border border-[#c3c4c7] shadow-sm">
                     <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 flex items-center justify-between font-bold text-[13px] text-gray-700">
                        Short Description
                        <span className="text-[11px] font-normal text-gray-400">Shown in banner overlay</span>
                     </div>
                     <div className="p-3">
                        <textarea
                           rows={3}
                           placeholder="A brief tagline shown inside the category banner image..."
                           className="w-full border border-[#c3c4c7] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] resize-none"
                           value={formData.description || ""}
                           onChange={(e) => setFormData({...formData, description: e.target.value})}
                        />
                     </div>
                  </div>

                  {/* Content Editor */}
                  <div className="bg-white border border-[#c3c4c7] shadow-sm">
                     <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 flex items-center justify-between font-bold text-[13px] text-gray-700">
                        <span>Full Description</span>
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
                     <div className="p-0">
                        {editorMode === "visual" ? (
                           <TiptapEditor content={formData.content} onChange={(html) => setFormData({...formData, content: html})} />
                        ) : (
                           <textarea
                              className="w-full p-4 font-mono text-[13px] outline-none border-none min-h-[350px] bg-[#fcfcfc] focus:bg-white transition-colors"
                              placeholder="Type HTML content here..."
                              value={formData.content}
                              onChange={(e) => setFormData({...formData, content: e.target.value})}
                           />
                        )}
                     </div>
                  </div>

                  {/* Link Items */}
                  <div className="bg-white border border-[#c3c4c7] shadow-sm">
                     <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 font-bold text-[13px] text-gray-700 flex justify-between">
                        <span>Link {type === 'product' ? 'Products' : 'Blogs'}</span>
                        <span className="text-[#2271b1]">{formData.linkedItems.length} selected</span>
                     </div>
                     <div className="p-3 space-y-3">
                        <input 
                           type="text" 
                           placeholder={`Search ${type}s...`}
                           value={itemSearchTerm}
                           onChange={(e) => setItemSearchTerm(e.target.value)}
                           className="w-full border border-[#c3c4c7] px-3 py-1.5 text-[12px] focus:border-[#2271b1] outline-none"
                        />
                        <div className="max-h-48 overflow-y-auto border border-gray-200 divide-y divide-gray-100">
                           {filteredItems.length === 0 ? (
                              <div className="p-3 text-center text-gray-400 text-[12px]">No items available.</div>
                           ) : (
                              filteredItems.map(item => (
                                 <label key={item._id} className="flex items-center gap-3 p-2 hover:bg-[#f6f7f7] cursor-pointer">
                                    <input 
                                       type="checkbox" 
                                       className="w-4 h-4 text-[#2271b1]"
                                       checked={formData.linkedItems.includes(item._id)}
                                       onChange={(e) => {
                                          if(e.target.checked) setFormData({...formData, linkedItems: [...formData.linkedItems, item._id]});
                                          else setFormData({...formData, linkedItems: formData.linkedItems.filter(id => id !== item._id)});
                                       }}
                                    />
                                    <span className="text-[13px]">{item.title || item.name}</span>
                                 </label>
                              ))
                           )}
                        </div>
                     </div>
                  </div>
               </>
            ) : (
               <>
                  {/* FAQ Manager */}
                  <div className="bg-white border border-[#c3c4c7] shadow-sm">
                     <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 flex items-center justify-between font-bold text-[13px] text-gray-700">
                        <span>Frequently Asked Questions</span>
                        <button
                           type="button"
                           onClick={() => {
                              const faqs = [...(formData.faqs || []), { question: "", answer: "" }];
                              setFormData({ ...formData, faqs });
                           }}
                           className="bg-[#2271b1] text-white px-2.5 py-1 rounded-[3px] text-[11px] font-bold hover:bg-[#135e96]"
                        >
                           Add New FAQ
                        </button>
                     </div>
                     <div className="p-4 space-y-4">
                        {(!formData.faqs || formData.faqs.length === 0) ? (
                           <div className="text-center py-6 text-[13px] text-gray-400 italic">No FAQs configured yet. Click "Add New FAQ" to create one.</div>
                        ) : (
                           formData.faqs.map((faq, idx) => (
                              <div key={idx} className="border border-[#ccd0d4] rounded p-3 bg-gray-50/50 space-y-2 relative">
                                 <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
                                    <span className="text-[11px] font-bold text-gray-400 uppercase">FAQ #{idx + 1}</span>
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
                                       placeholder="e.g. Do you ship worldwide?"
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
                                       placeholder="Enter the answer..."
                                       value={faq.answer}
                                       onChange={(e) => {
                                          const faqs = [...formData.faqs];
                                          faqs[idx].answer = e.target.value;
                                          setFormData({ ...formData, faqs });
                                       }}
                                    />
                                 </div>
                              </div>
                           ))
                        )}
                     </div>
                  </div>

                  {/* FAQ Schema Custom Block */}
                  <div className="bg-white border border-[#c3c4c7] shadow-sm">
                     <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 flex items-center justify-between font-bold text-[13px] text-gray-700">
                        <span>Custom FAQ JSON-LD Schema</span>
                        <span className="text-[11px] font-normal text-gray-400">Optional: Overrides auto-generated schema</span>
                     </div>
                     <div className="p-3">
                        <textarea
                           rows={6}
                           placeholder={`{\n  "@type": "FAQPage",\n  "mainEntity": [\n     ...\n  ]\n}`}
                           className="w-full border border-[#c3c4c7] rounded-[3px] p-3 text-[12px] font-mono outline-none focus:border-[#2271b1] bg-gray-50/20"
                           value={formData.faqSchemaCustom || ""}
                           onChange={(e) => setFormData({...formData, faqSchemaCustom: e.target.value})}
                        />
                     </div>
                  </div>
               </>
            )}

            {/* SEO Settings */}
            <SEOConfigPanel
               seo={formData.seo || {}}
               onChange={newSeo => setFormData({ ...formData, seo: newSeo })}
               parentTitle={formData.name}
               parentDescription={formData.description || formData.content}
               parentSlug={formData.slug}
               parentImage={formData.image}
               parentType="category"
            />
         </div>

         {/* Sidebar Column */}
         <div className="space-y-4">
            <div className="bg-white border border-[#c3c4c7] shadow-sm">
               <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Publish</div>
               <div className="p-3 space-y-4 text-[13px]">
                  <div className="space-y-3 py-2">
                     <p className="flex items-center gap-2"><span className="text-gray-500 w-16">Status:</span> 
                        <select className="border border-[#c3c4c7] px-1 py-0.5" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                           <option>Published</option>
                           <option>Draft</option>
                        </select>
                     </p>
                     <label className="flex items-center gap-2 cursor-pointer mt-2">
                        <input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData({...formData, isFeatured: e.target.checked})} />
                        Featured Category
                     </label>
                  </div>
                  {formData.slug && (
                     <a
                        href={`/${type === 'product' ? 'collections' : 'blog'}/${formData.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-[#2271b1] hover:underline"
                     >
                        <ExternalLink className="w-3 h-3" /> Preview live page
                     </a>
                  )}
                  <div className="bg-[#f6f7f7] border-t border-[#c3c4c7] -mx-3 -mb-3 p-3 flex justify-between items-center">
                     <button type="button" onClick={() => router.push(type === 'product' ? '/admin/categories' : '/admin/blogs/categories')} className="text-red-600 hover:underline">Cancel</button>
                     <button type="submit" disabled={saving} className="bg-[#2271b1] text-white px-4 py-1.5 rounded-[3px] font-bold hover:bg-[#135e96]">
                        {saving ? "Saving..." : (categoryId ? "Update" : "Publish")}
                     </button>
                  </div>
               </div>
            </div>

             {type === "product" && (
              <div className="bg-white border border-[#c3c4c7] shadow-sm">
                <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Default Size Chart</div>
                <div className="p-3">
                  <select
                    className="w-full border border-[#c3c4c7] px-2 py-1.5 text-[13px] outline-none bg-white focus:border-[#2271b1] cursor-pointer"
                    value={formData.sizeChart || ""}
                    onChange={(e) => setFormData({ ...formData, sizeChart: e.target.value })}
                  >
                    <option value="">None (No default size chart)</option>
                    {sizeCharts.map((sc) => (
                      <option key={sc._id} value={sc._id}>
                        {sc.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Products in this category will automatically inherit this size chart unless overridden.
                  </p>
                </div>
              </div>
             )}

            <div className="bg-white border border-[#c3c4c7] shadow-sm">
               <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Category Image</div>
               <div className="p-3">
                  <MediaPicker 
                     value={formData.image} 
                     onChange={(url) => setFormData({...formData, image: url})}
                     label="Set image"
                  />
               </div>
            </div>

            <div className="bg-white border border-[#c3c4c7] shadow-sm">
               <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Category Banner Image</div>
               <div className="p-3">
                  <MediaPicker 
                     value={formData.banner || ""} 
                     onChange={(url) => setFormData({...formData, banner: url})}
                     label="Set banner image"
                  />
               </div>
            </div>
         </div>
      </form>
    </AdminPageLayout>
  );
}
