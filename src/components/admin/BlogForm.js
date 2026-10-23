"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePopup } from "@/context/PopupContext";
import Link from "next/link";
import { Globe, Calendar, Edit } from "lucide-react";
import dynamic from 'next/dynamic';
const TiptapEditor = dynamic(() => import('./TiptapEditor'), { ssr: false });
import MediaPicker from "@/components/admin/MediaPicker";
import { Page, PageHeader, Postbox } from "@/components/admin/ui";
import SEOConfigPanel from "@/components/admin/SEOConfigPanel";
import { toast } from "react-hot-toast";

export default function BlogForm({ blogId }) {
   const router = useRouter();
   const { showConfirm } = usePopup();
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
               fetch("/api/admin/categories?type=blog").catch(() => null),
               fetch("/api/admin/products").catch(() => null)
            ]);

            if (catsRes?.ok) {
               const cats = await catsRes.json().catch(() => []);
               setCategories(Array.isArray(cats) ? cats : []);
            } else {
               setCategories([]);
            }

            if (prodsRes?.ok) {
               const prods = await prodsRes.json().catch(() => []);
               setProducts(Array.isArray(prods) ? prods : (prods?.products || []));
            } else {
               setProducts([]);
            }

            if (blogId) {
               const blogRes = await fetch(`/api/admin/blogs?id=${blogId}`).catch(() => null);
               if (blogRes?.ok) {
                  const data = await blogRes.json().catch(() => null);
                  if (data && typeof data === "object" && data._id) {
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
                         faqs: Array.isArray(data.faqs) ? data.faqs : []
                      }));
                  }
               }
            }
         } catch (err) {
            console.error("Fetch failed", err);
         } finally {
            setLoading(false);
         }
      };

      fetchData();
   }, [blogId]);

   const handleTrash = async () => {
      if (!blogId) return;
      if (!(await showConfirm("Are you sure you want to move this post to trash?", "Move to trash", { confirmText: "Move to trash", danger: true }))) return;
      try {
         const res = await fetch(`/api/admin/blogs?id=${blogId}`, {
            method: "DELETE"
         });
         if (res.ok) {
            toast.success("Blog post moved to trash successfully.");
            router.push("/admin/blogs");
         } else {
            const errData = await res.json().catch(() => ({}));
            toast.error(`Failed to move to trash: ${errData.error || res.statusText || "Unknown error"}`);
         }
      } catch (err) {
         console.error(err);
         toast.error(`Network Error: ${err.message}`);
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

   // overrides: fields forced for this save only (e.g. "Save Draft" forces status Draft)
   const handleSubmit = async (e, overrides = null) => {
      e?.preventDefault?.();
      setSaving(true);
      try {
         const method = blogId ? "PUT" : "POST";
         // Strip immutable Mongoose fields that cause _id update errors
         const { _id, __v, createdAt, updatedAt, ...cleanData } = overrides ? { ...formData, ...overrides } : formData;
         const payload = blogId ? { ...cleanData, id: blogId } : cleanData;
         console.log("[BlogForm] Submitting seo:", payload.seo);
         const res = await fetch("/api/admin/blogs", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
         });
         if (res.ok) {
            const savedBlog = await res.json();
            if (overrides) setFormData(prev => ({ ...prev, ...overrides }));
            toast.success(overrides?.status === "Draft"
               ? "Draft saved."
               : (blogId ? "Blog post updated successfully!" : "Blog post created successfully!"));
            if (!blogId && savedBlog._id) {
               router.push(`/admin/blogs/${savedBlog._id}`);
            }
         } else {
            const errData = await res.json().catch(() => ({}));
            toast.error(`Save failed: ${errData.error || res.statusText || "Unknown error"}`);
            console.error("[BlogForm] Save failed:", errData);
         }
      } catch (err) {
         console.error(err);
         toast.error(`Network Error: ${err.message}`);
      } finally {
         setSaving(false);
      }
   };

    if (loading) return <Page><p className="wp-muted" style={{ padding: "20px 0" }}>Loading editor…</p></Page>;

    if (blogId && !formData.title) {
       return (
          <Page>
             <PageHeader title="Edit Post" />
             <div className="wp-notice wp-notice-error" role="alert" style={{ maxWidth: 640 }}>
                <div style={{ padding: "6px 0" }}>
                   <h2 className="wp-strong" style={{ fontSize: 14, margin: "0 0 4px" }}>
                      Failed to load blog data
                   </h2>
                   <p style={{ margin: 0 }}>
                      Your administrator session may have expired, or the blog post you are trying to edit does not exist. Please try logging back in.
                   </p>
                   <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 12 }}>
                      <button
                         type="button"
                         onClick={() => window.location.reload()}
                         className="wp-btn wp-btn-primary"
                      >
                         Retry Connection / Reload
                      </button>
                      <a
                         href="/admin-login"
                         className="wp-btn"
                      >
                         Log In to Admin Panel
                      </a>
                      <a
                         href="/admin/blogs"
                         className="wp-link"
                      >
                         ← Back to Blogs List
                      </a>
                   </div>
                </div>
             </div>
          </Page>
       );
    }

    // Presentational helper: plain-text buttons styled as WordPress links
    const linkBtnStyle = { background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", color: "#2271b1" };
    const dangerLinkStyle = { ...linkBtnStyle, color: "#b32d2e", textDecoration: "underline" };

    return (
    <Page>
      <PageHeader
         title={blogId ? "Edit Post" : "Add New Post"}
         actions={<Link href="/admin/blogs/new" className="wp-btn">Add New Post</Link>}
      />
         <form onSubmit={handleSubmit} className="wp-cols">
            {/* Main Column */}
            <div className="wp-col-main">
               <div style={{ marginBottom: 20 }}>
                  <label htmlFor="blog-title-input" className="sr-only">Add title</label>
                  <input
                     id="blog-title-input"
                     required
                     placeholder="Enter title here"
                     className="wp-title-input"
                     value={formData.title}
                     onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                  <div className="wp-small flex flex-wrap items-center gap-1.5 min-w-0" style={{ marginTop: 8, color: "#3c434a", wordBreak: "break-all" }}>
                     <span className="wp-strong">Permalink:</span>
                     <span className="wp-muted">pairo.store/blog/</span>
                     <label htmlFor="blog-slug-input" className="sr-only">Permalink slug</label>
                     <input
                        id="blog-slug-input"
                        readOnly={!editSlug}
                        className={editSlug ? "wp-input" : undefined}
                        style={editSlug
                           ? { minHeight: 28, minWidth: 140, maxWidth: "100%" }
                           : { border: 0, background: "transparent", pointerEvents: "none", padding: 0, color: "#1d2327", fontWeight: 600, minWidth: 0, maxWidth: "100%", width: `${Math.min(220, Math.max(60, (formData.slug || "").length * 8.5))}px` }}
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                     />
                     {!editSlug ? (
                        <button
                           type="button"
                           onClick={() => setEditSlug(true)}
                           className="wp-btn"
                           aria-label="Edit permalink"
                           style={{ minHeight: 26, padding: "0 8px" }}
                        >
                           <Edit className="w-3 h-3" aria-hidden="true" /> Edit
                        </button>
                     ) : (
                        <button
                           type="button"
                           onClick={() => setEditSlug(false)}
                           className="wp-btn"
                           style={{ minHeight: 26, padding: "0 8px" }}
                        >
                           OK
                        </button>
                     )}
                  </div>
               </div>

               {/* Content / SEO / FAQ Tabs */}
               <div className="wp-tabs" role="tablist" aria-label="Editor sections">
                  <button
                     type="button"
                     role="tab"
                     id="bf-tab-content"
                     aria-selected={activeFormTab === "content"}
                     aria-controls="bf-form-panel"
                     onClick={() => setActiveFormTab("content")}
                     className="wp-tab"
                  >
                     Content Editor
                  </button>
                  <button
                     type="button"
                     role="tab"
                     id="bf-tab-seo"
                     aria-selected={activeFormTab === "seo"}
                     aria-controls="bf-form-panel"
                     onClick={() => setActiveFormTab("seo")}
                     className="wp-tab"
                  >
                     SEO Settings
                  </button>
                  <button
                     type="button"
                     role="tab"
                     id="bf-tab-faq"
                     aria-selected={activeFormTab === "faq"}
                     aria-controls="bf-form-panel"
                     onClick={() => setActiveFormTab("faq")}
                     className="wp-tab"
                  >
                     FAQ Settings
                  </button>
               </div>

               <div id="bf-form-panel" role="tabpanel" aria-labelledby={`bf-tab-${activeFormTab}`}>
               {activeFormTab === "content" && (
                  <>
                     {/* Editor box */}
                     <div className="wp-postbox" role="group" aria-label="Post content" style={{ overflow: "hidden" }}>
                        <div className="flex flex-wrap items-center gap-2" style={{ justifyContent: "flex-end", padding: "6px 8px 0", background: "#f6f7f7", borderBottom: "1px solid #dcdcde" }}>
                           <span className="sr-only" id="bf-editor-mode-label">Editor mode</span>
                           <div className="wp-tabs" role="group" aria-labelledby="bf-editor-mode-label" style={{ margin: 0, borderBottom: 0 }}>
                              <button
                                 type="button"
                                 aria-pressed={editorMode === "visual"}
                                 onClick={() => setEditorMode("visual")}
                                 className={`wp-tab${editorMode === "visual" ? " is-current" : ""}`}
                                 style={editorMode === "visual" ? { background: "#fff" } : undefined}
                              >
                                 Visual
                              </button>
                              <button
                                 type="button"
                                 aria-pressed={editorMode === "html"}
                                 onClick={() => setEditorMode("html")}
                                 className={`wp-tab${editorMode === "html" ? " is-current" : ""}`}
                                 style={editorMode === "html" ? { background: "#fff" } : undefined}
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
                           <>
                              <label htmlFor="bf-html-content" className="sr-only">Post content (HTML)</label>
                              <textarea
                                 id="bf-html-content"
                                 className="wp-textarea wp-full"
                                 style={{ border: 0, borderRadius: 0, minHeight: 350, fontFamily: "Consolas, Monaco, monospace", fontSize: 13, padding: 12 }}
                                 placeholder="Type HTML content here..."
                                 value={formData.content}
                                 onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                              />
                           </>
                        )}
                     </div>

                     {/* Excerpt */}
                     <Postbox title="Excerpt" id="bf-excerpt">
                        <label htmlFor="bf-excerpt-input" className="sr-only">Excerpt</label>
                        <textarea
                           id="bf-excerpt-input"
                           rows={4}
                           className="wp-textarea wp-full"
                           placeholder="Add a brief summary of the post..."
                           value={formData.excerpt}
                           onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                        />
                        <p className="wp-desc">Excerpts are optional hand-crafted summaries of your content that can be used in your theme.</p>
                     </Postbox>
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
                  <Postbox
                     title="Frequently Asked Questions"
                     id="bf-faq"
                     aside={
                        <button
                           type="button"
                           onClick={() => {
                              const faqs = [...(formData.faqs || [])];
                              faqs.push({ question: "", answer: "" });
                              setFormData({ ...formData, faqs });
                           }}
                           className="wp-btn"
                        >
                           Add FAQ Item
                        </button>
                     }
                  >
                     {(!formData.faqs || formData.faqs.length === 0) ? (
                        <p className="wp-muted" style={{ padding: "16px 0", textAlign: "center" }}>
                           No FAQ items have been added to this blog post yet. Click &quot;Add FAQ Item&quot; to begin.
                        </p>
                     ) : (
                        <div className="flex flex-col gap-3">
                           {formData.faqs.map((faq, idx) => (
                              <div key={idx} style={{ border: "1px solid #dcdcde", background: "#fff" }}>
                                 <div className="flex flex-wrap items-center gap-2" style={{ padding: "8px 12px", borderBottom: "1px solid #dcdcde", background: "#f6f7f7" }}>
                                    <span className="wp-strong">FAQ Item #{idx + 1}</span>
                                    <span style={{ flex: 1 }} />
                                    <button
                                       type="button"
                                       onClick={() => {
                                          const faqs = formData.faqs.filter((_, i) => i !== idx);
                                          setFormData({ ...formData, faqs });
                                       }}
                                       style={dangerLinkStyle}
                                       aria-label={`Delete FAQ item ${idx + 1}`}
                                    >
                                       Delete
                                    </button>
                                 </div>
                                 <div style={{ padding: 12 }}>
                                    <div className="wp-field">
                                       <label htmlFor={`bf-faq-q-${idx}`} className="wp-label">Question</label>
                                       <input
                                          id={`bf-faq-q-${idx}`}
                                          type="text"
                                          className="wp-input wp-full"
                                          placeholder="e.g. What leather is used for this product?"
                                          value={faq.question}
                                          onChange={(e) => {
                                             const faqs = [...formData.faqs];
                                             faqs[idx].question = e.target.value;
                                             setFormData({ ...formData, faqs });
                                          }}
                                       />
                                    </div>
                                    <div className="wp-field" style={{ marginBottom: 0 }}>
                                       <label htmlFor={`bf-faq-a-${idx}`} className="wp-label">Answer</label>
                                       <textarea
                                          id={`bf-faq-a-${idx}`}
                                          rows={3}
                                          className="wp-textarea wp-full"
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
                              </div>
                           ))}
                        </div>
                     )}
                  </Postbox>
               )}
               </div>
            </div>

            {/* Sidebar */}
            <div className="wp-col-side">
               {/* Publish Box */}
               <section className="wp-postbox" aria-labelledby="bf-publish-title">
                  <div className="wp-postbox-head"><h2 id="bf-publish-title">Publish</h2></div>
                  <div className="flex flex-wrap justify-between items-center gap-2" style={{ padding: "10px 12px 2px" }}>
                     <button
                         type="button"
                         onClick={(e) => handleSubmit(e, { status: "Draft" })}
                         disabled={saving}
                         className="wp-btn"
                     >
                         Save Draft
                     </button>
                     <button type="button" onClick={() => formData.slug && window.open(`/blog/${formData.slug}`, '_blank')} className="wp-btn" title={formData.slug ? `Preview /blog/${formData.slug}` : 'Save first to preview'}>Preview</button>
                  </div>
                  <div className="wp-misc">
                     <div className="wp-misc-row">
                        <Globe className="w-4 h-4" aria-hidden="true" style={{ color: "#8c8f94" }} />
                        <label htmlFor="bf-status-select" className="wp-muted">Status:</label>
                        <strong className="wp-strong">{formData.status}</strong>
                        <select
                           id="bf-status-select"
                           className="wp-select"
                           style={{ marginLeft: "auto" }}
                           value={formData.status}
                           onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                           <option value="Draft">Draft</option>
                           <option value="Published">Published</option>
                        </select>
                     </div>
                     <div className="wp-misc-row">
                        <Calendar className="w-4 h-4" aria-hidden="true" style={{ color: "#8c8f94" }} />
                        <label htmlFor="bf-published-at" className="wp-muted">Published on:</label>
                        <input
                           id="bf-published-at"
                           type="date"
                           className="wp-input"
                           style={{ marginLeft: "auto", minWidth: 0, maxWidth: "100%" }}
                           value={formData.publishedAt}
                           onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
                        />
                     </div>
                  </div>
                  <div className="wp-box-foot">
                     {blogId ? (
                        <button type="button" onClick={handleTrash} style={dangerLinkStyle}>Move to Trash</button>
                     ) : null}
                     <span className="wp-spacer" />
                     <button
                        type="submit"
                        disabled={saving}
                        className="wp-btn wp-btn-primary"
                        style={{ minHeight: 36 }}
                     >
                        {saving ? "Publishing..." : (blogId ? "Update" : "Publish")}
                     </button>
                  </div>
               </section>

               {/* Categories Box */}
               <Postbox
                  title="Categories"
                  id="bf-categories"
                  aside={<button type="button" onClick={() => router.push("/admin/blogs/categories")} className="wp-link" style={linkBtnStyle}>Manage</button>}
               >
                  {categories.length === 0 ? (
                     <p className="wp-muted">No categories found.</p>
                  ) : (
                     <div className="wp-checklist" role="group" aria-labelledby="bf-categories-title">
                        {categories.map(cat => (
                           <label key={cat._id} className="wp-check" style={{ wordBreak: "break-word" }}>
                              <input
                                 type="checkbox"
                                 checked={formData.category === cat.name}
                                 onChange={() => setFormData({...formData, category: formData.category === cat.name ? "" : cat.name})}
                              />
                              <span>{cat.name}</span>
                           </label>
                        ))}
                     </div>
                  )}
               </Postbox>

               {/* Featured Image Box */}
               <Postbox title="Featured image" id="bf-featured-image">
                  <MediaPicker
                     value={formData.image}
                     onChange={(url) => setFormData({...formData, image: url})}
                     label="Set featured image"
                  />
               </Postbox>

               {/* Featured Product Box */}
               <Postbox title="Featured product" id="bf-featured-product">
                  <label htmlFor="bf-featured-product-select" className="wp-label">Select product</label>
                  <select
                     id="bf-featured-product-select"
                     className="wp-select wp-full"
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
                  <p className="wp-desc">Choose a product to feature in the sidebar.</p>
               </Postbox>

               {/* Sidebar Settings Box */}
               <Postbox title="Sidebar controls" id="bf-sidebar-controls">
                  <label className="wp-check">
                     <input
                        type="checkbox"
                        checked={formData.showFeaturedProduct}
                        onChange={(e) => setFormData({...formData, showFeaturedProduct: e.target.checked})}
                     />
                     <span>Enable Featured Product</span>
                  </label>
                  <label className="wp-check">
                     <input
                        type="checkbox"
                        checked={formData.showSidebarIndex}
                        onChange={(e) => setFormData({...formData, showSidebarIndex: e.target.checked})}
                     />
                     <span>Enable Sidebar Index (TOC)</span>
                  </label>
               </Postbox>
            </div>
         </form>
    </Page>
   );
}
