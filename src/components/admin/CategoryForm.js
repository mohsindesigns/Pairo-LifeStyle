"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Page, PageHeader, Postbox, Notice } from "@/components/admin/ui";
import MediaPicker from "@/components/admin/MediaPicker";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
const TiptapEditor = dynamic(() => import('@/components/admin/TiptapEditor'), { ssr: false });
import SEOConfigPanel from "@/components/admin/SEOConfigPanel";
import { Pencil, ExternalLink } from "lucide-react";
import { toast } from "react-hot-toast";
import { getCategoryUrl } from "@/lib/routes";
import { usePopup } from "@/context/PopupContext";
import { confirmSlugChange } from "@/components/admin/slugChange";

export default function CategoryForm({ categoryId = null, type = "product" }) {
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [trashing, setTrashing] = useState(false);
  const [loading, setLoading] = useState(categoryId ? true : false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemSearchTerm, setItemSearchTerm] = useState("");

  const [activeTab, setActiveTab] = useState("content");
  const [slugLocked, setSlugLocked] = useState(true);
  // Slug the category was loaded / last saved with: changing it asks "Change URL?" first
  const savedSlugRef = useRef(null);
  const [editorMode, setEditorMode] = useState("visual");

  const [formData, setFormData] = useState({
    _id: null,
    name: "",
    slug: "",
    description: "",
    content: "",
    image: "",
    banner: "",
    showBannerOverlay: false,
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
      // 1. Try direct lookup by categoryId
      const directRes = await fetch(`/api/admin/categories?id=${categoryId}`).catch(() => null);
      if (directRes?.ok) {
        const directCat = await directRes.json().catch(() => null);
        if (directCat && directCat._id) {
          savedSlugRef.current = directCat.slug || null;
          setFormData(prev => ({
            ...prev,
            ...directCat,
            sizeChart: directCat.sizeChart || "",
            showBannerOverlay: Boolean(directCat.showBannerOverlay),
            faqs: directCat.faqs || [],
            faqSchemaCustom: directCat.faqSchemaCustom || "",
            seo: { ...prev.seo, ...(directCat.seo || {}) }
          }));
          return directCat;
        }
      }

      // 2. Fallback to collection list lookup
      const res = await fetch(`/api/admin/categories?type=${type}`).catch(() => null);
      if (res?.ok) {
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) {
          const cat = data.find(c => String(c?._id) === String(categoryId));
          if (cat) {
            savedSlugRef.current = cat.slug || null;
            setFormData(prev => ({
              ...prev,
              ...cat,
              sizeChart: cat.sizeChart || "",
              showBannerOverlay: Boolean(cat.showBannerOverlay),
              faqs: cat.faqs || [],
              faqSchemaCustom: cat.faqSchemaCustom || "",
              seo: { ...prev.seo, ...(cat.seo || {}) }
            }));
            return cat;
          }
        }
      }
    } catch (err) {
      console.error("fetchCategory error:", err);
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
        if (categoryId) {
          cat = await fetchCategory();
          if (!cat) setNotFound(true);
        }
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

  // "Save Draft" passes forceStatus="Draft"; the main button keeps the chosen status.
  const handleSubmit = async (e, forceStatus) => {
    e?.preventDefault?.();
    if (!formData.name?.trim()) {
      setSaveError("Enter a category name before saving.");
      return;
    }
    if (categoryId && !formData._id) {
      setSaveError("This category could not be loaded, so it cannot be saved.");
      return;
    }
    // Existing category whose URL changed: confirm first; cancel saves nothing
    if (formData._id && !(await confirmSlugChange(showConfirm, {
      savedSlug: savedSlugRef.current,
      nextSlug: formData.slug,
      toPath: (slug) => `/${type === 'product' ? 'collections' : 'blog'}/${slug}`,
    }))) return;
    setSaving(true);
    setSaveError("");
    try {
      const method = formData._id ? "PUT" : "POST";
      const nextStatus = forceStatus || formData.status;
      if (forceStatus) setFormData(prev => ({ ...prev, status: forceStatus }));
      const body = { ...formData, status: nextStatus, id: formData._id };
      
      const res = await fetch("/api/admin/categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const savedCat = await res.json();
        if (formData._id) savedSlugRef.current = savedCat?.slug || formData.slug || savedSlugRef.current;
        toast.success(forceStatus === "Draft" ? "Draft saved." : (categoryId ? "Category updated." : "Category created."));
        if (!categoryId && savedCat._id) {
          router.push(type === 'product' ? `/admin/products/categories/${savedCat._id}` : `/admin/blogs/categories/${savedCat._id}`);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || `Save failed (${res.status})`;
        setSaveError(msg);
        toast.error("Error saving category: " + msg);
      }
    } catch (err) {
      console.error(err);
      setSaveError("Could not reach the server. Your changes were not saved.");
      toast.error("Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  // Soft delete via the same API the list uses (mode=trash never hard-deletes).
  const handleTrash = async () => {
    if (!formData._id) return;
    const ok = await showConfirm(
      `Move "${formData.name || "this category"}" to the trash? You can restore it from the Trash view.`,
      "Move to Trash",
      { confirmText: "Move to Trash", danger: true }
    );
    if (!ok) return;
    setTrashing(true);
    try {
      const res = await fetch(`/api/admin/categories?id=${formData._id}&mode=trash`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Category moved to trash.");
        router.push(type === 'product' ? '/admin/categories' : '/admin/blogs/categories');
        return;
      }
      const data = await res.json().catch(() => ({}));
      toast.error("Error moving category to trash: " + (data.error || "Unknown error"));
    } catch (err) {
      console.error(err);
      toast.error("Failed to move category to trash.");
    } finally {
      setTrashing(false);
    }
  };

  const handleRestore = async () => {
    if (!formData._id) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: formData._id, isDeleted: false }),
      });
      if (res.ok) {
        setFormData(prev => ({ ...prev, isDeleted: false, deletedAt: null }));
        toast.success("Category restored.");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error("Could not restore: " + (data.error || res.status));
      }
    } catch {
      toast.error("Could not restore the category.");
    } finally {
      setRestoring(false);
    }
  };

  const filteredItems = availableItems.filter(i => 
    i.title?.toLowerCase().includes(itemSearchTerm.toLowerCase()) || 
    i.name?.toLowerCase().includes(itemSearchTerm.toLowerCase())
  );

  const pageTitle = categoryId ? "Edit Category" : "Add New Category";
  const addNewHref = type === 'product' ? "/admin/products/categories/new" : "/admin/blogs/categories/new";
  const backHref = type === 'product' ? '/admin/categories' : '/admin/blogs/categories';

  if (loading) {
    return (
      <Page>
        <PageHeader title={pageTitle} />
        <p className="wp-muted" role="status">Loading editor...</p>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={pageTitle}
        actions={<Link href={addNewHref} className="wp-btn">Add New</Link>}
        aside={<Link href={backHref} className="wp-link">&larr; Back to categories</Link>}
      />

      {notFound && (
        <Notice type="error">
          This category could not be found. It may have been deleted permanently. <Link href={backHref} className="wp-link">Back to categories</Link>
        </Notice>
      )}
      {formData.isDeleted && (
        <Notice type="warning">
          This category is in the Trash and is hidden from the store.{" "}
          <button type="button" className="wp-link" onClick={handleRestore} disabled={restoring} style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>
            {restoring ? "Restoring…" : "Restore it"}
          </button>
        </Notice>
      )}
      {saveError && (
        <Notice type="error" onDismiss={() => setSaveError("")}>{saveError}</Notice>
      )}

      <form onSubmit={handleSubmit}>
        <div className="wp-cols">
          {/* Main Column */}
          <div className="wp-col-main">
            <div className="wp-field">
              <label htmlFor="category-name" className="sr-only">Category name</label>
              <input
                id="category-name"
                required
                placeholder="Enter title here"
                className="wp-title-input"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
                  setFormData({...formData, name, slug: formData._id ? formData.slug : slug});
                }}
              />
              <div className="wp-small wp-muted" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 }}>
                <span className="wp-strong" style={{ fontWeight: 600 }}>Permalink:</span>
                <span style={{ wordBreak: "break-all" }}>
                  pairolifestyle.com/{type === 'product' ? 'collections' : 'blog'}/
                </span>
                {slugLocked ? (
                  <>
                    <span style={{ wordBreak: "break-all", color: "#2271b1", fontWeight: 600 }}>
                      {formData.slug || <em className="wp-muted" style={{ fontWeight: 400 }}>auto-generated</em>}
                    </span>
                    <button
                      type="button"
                      title="Edit permalink"
                      aria-label="Edit permalink"
                      onClick={() => setSlugLocked(false)}
                      className="wp-btn"
                      style={{ minHeight: 24, padding: "0 8px", fontSize: 12 }}
                    >
                      <Pencil className="w-3 h-3" aria-hidden="true" /> Edit
                    </button>
                  </>
                ) : (
                  <>
                    <label htmlFor="category-slug" className="sr-only">Slug</label>
                    <input
                      id="category-slug"
                      className="wp-input"
                      style={{ minWidth: 140, minHeight: 26, fontSize: 13 }}
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setSlugLocked(true)}
                      className="wp-btn"
                      style={{ minHeight: 24, padding: "0 8px", fontSize: 12 }}
                    >OK</button>
                  </>
                )}
              </div>
              <p className="wp-desc">The slug is the URL-friendly version of the name. It is usually all lowercase and contains only letters, numbers and hyphens.</p>
            </div>

            {/* Tabs Selector */}
            <div className="wp-tabs" role="tablist" aria-label="Category sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "content"}
                onClick={() => setActiveTab("content")}
                className="wp-tab"
              >
                Content
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "faq"}
                onClick={() => setActiveTab("faq")}
                className="wp-tab"
              >
                FAQ ({formData.faqs?.length || 0})
              </button>
            </div>

            {activeTab === "content" ? (
              <>
                {/* Short Description — shown in banner overlay */}
                <Postbox id="category-short-desc" title="Short Description" aside="Shown in banner overlay">
                  <label htmlFor="category-description" className="sr-only">Short description</label>
                  <textarea
                    id="category-description"
                    rows={3}
                    placeholder="A brief tagline shown inside the category banner image..."
                    className="wp-textarea"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                  <p className="wp-desc">A short line of text shown over the category banner on the storefront.</p>
                </Postbox>

                {/* Content Editor */}
                <section className="wp-postbox" aria-labelledby="category-content-title">
                  <div className="wp-postbox-head">
                    <h2 id="category-content-title">Full Description</h2>
                    <div className="wp-seg" role="group" aria-label="Editor mode">
                      <button
                        type="button"
                        aria-pressed={editorMode === "visual"}
                        onClick={() => setEditorMode("visual")}
                      >
                        Visual
                      </button>
                      <button
                        type="button"
                        aria-pressed={editorMode === "html"}
                        onClick={() => setEditorMode("html")}
                      >
                        HTML
                      </button>
                    </div>
                  </div>
                  <div>
                    {editorMode === "visual" ? (
                      <TiptapEditor content={formData.content} onChange={(html) => setFormData({...formData, content: html})} />
                    ) : (
                      <textarea
                        aria-label="Full description HTML"
                        className="w-full p-4 font-mono text-[13px] outline-none border-none min-h-[350px] bg-[#fcfcfc] focus:bg-white"
                        placeholder="Type HTML content here..."
                        value={formData.content}
                        onChange={(e) => setFormData({...formData, content: e.target.value})}
                      />
                    )}
                  </div>
                </section>

                {/* Link Items */}
                <Postbox
                  id="category-linked-items"
                  title={`Link ${type === 'product' ? 'Products' : 'Blogs'}`}
                  aside={`${formData.linkedItems.length} selected`}
                >
                  <label htmlFor="category-item-search" className="sr-only">{`Search ${type}s`}</label>
                  <input
                    id="category-item-search"
                    type="text"
                    placeholder={`Search ${type}s...`}
                    value={itemSearchTerm}
                    onChange={(e) => setItemSearchTerm(e.target.value)}
                    className="wp-input wp-full"
                  />
                  <div className="wp-checklist" style={{ marginTop: 8 }}>
                    {filteredItems.length === 0 ? (
                      <div className="wp-empty">No items available.</div>
                    ) : (
                      filteredItems.map(item => (
                        <label key={item._id} className="wp-check" style={{ minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={formData.linkedItems.includes(item._id)}
                            onChange={(e) => {
                              if(e.target.checked) setFormData({...formData, linkedItems: [...formData.linkedItems, item._id]});
                              else setFormData({...formData, linkedItems: formData.linkedItems.filter(id => id !== item._id)});
                            }}
                          />
                          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{item.title || item.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="wp-desc">Ticked {type === 'product' ? 'products' : 'posts'} are assigned to this category when you save.</p>
                </Postbox>
              </>
            ) : (
              <>
                {/* FAQ Manager */}
                <section className="wp-postbox" aria-labelledby="category-faq-title">
                  <div className="wp-postbox-head">
                    <h2 id="category-faq-title">Frequently Asked Questions</h2>
                    <button
                      type="button"
                      onClick={() => {
                        const faqs = [...(formData.faqs || []), { question: "", answer: "" }];
                        setFormData({ ...formData, faqs });
                      }}
                      className="wp-btn"
                    >
                      Add New FAQ
                    </button>
                  </div>
                  <div className="wp-inside">
                    {(!formData.faqs || formData.faqs.length === 0) ? (
                      <div className="wp-empty">No FAQs configured yet. Click &ldquo;Add New FAQ&rdquo; to create one.</div>
                    ) : (
                      formData.faqs.map((faq, idx) => (
                        <div key={idx} style={{ border: "1px solid #dcdcde", background: "#f6f7f7", padding: 12, marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span className="wp-strong">FAQ #{idx + 1}</span>
                            <div className="wp-row-actions" style={{ visibility: "visible", padding: 0 }}>
                              <button
                                type="button"
                                className="is-danger"
                                aria-label={`Delete FAQ ${idx + 1}`}
                                onClick={() => {
                                  const faqs = formData.faqs.filter((_, i) => i !== idx);
                                  setFormData({ ...formData, faqs });
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <div className="wp-field">
                            <label htmlFor={`faq-q-${idx}`} className="wp-label">Question</label>
                            <input
                              id={`faq-q-${idx}`}
                              type="text"
                              className="wp-input wp-full"
                              placeholder="e.g. Do you ship worldwide?"
                              value={faq.question}
                              onChange={(e) => {
                                const faqs = [...formData.faqs];
                                faqs[idx].question = e.target.value;
                                setFormData({ ...formData, faqs });
                              }}
                            />
                          </div>
                          <div className="wp-field" style={{ marginBottom: 0 }}>
                            <label htmlFor={`faq-a-${idx}`} className="wp-label">Answer</label>
                            <textarea
                              id={`faq-a-${idx}`}
                              rows={3}
                              className="wp-textarea"
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
                </section>

                {/* FAQ Schema Custom Block */}
                <Postbox id="category-faq-schema" title="Custom FAQ JSON-LD Schema">
                  <label htmlFor="category-faq-schema-input" className="sr-only">Custom FAQ JSON-LD schema</label>
                  <textarea
                    id="category-faq-schema-input"
                    rows={6}
                    placeholder={`{\n  "@type": "FAQPage",\n  "mainEntity": [\n     ...\n  ]\n}`}
                    className="wp-textarea font-mono"
                    value={formData.faqSchemaCustom || ""}
                    onChange={(e) => setFormData({...formData, faqSchemaCustom: e.target.value})}
                  />
                  <p className="wp-desc">Optional. When filled in, this replaces the schema generated from the FAQs above.</p>
                </Postbox>
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
          <div className="wp-col-side" style={{ flex: "1 1 280px" }}>
            <section className="wp-postbox" aria-labelledby="category-publish-title">
              <div className="wp-postbox-head">
                <h2 id="category-publish-title">Publish</h2>
              </div>
              <div className="wp-misc">
                <div className="wp-misc-row">
                  <label htmlFor="category-status">Status:</label>
                  <select id="category-status" className="wp-select" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option>Published</option>
                    <option>Draft</option>
                  </select>
                </div>
                <div className="wp-misc-row">
                  <button
                    type="button"
                    className="wp-btn"
                    disabled={saving || (categoryId && !formData._id)}
                    onClick={(e) => handleSubmit(e, "Draft")}
                  >
                    Save Draft
                  </button>
                </div>
                <label className="wp-check">
                  <input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData({...formData, isFeatured: e.target.checked})} />
                  Featured Category
                </label>
                {/* Only product categories have a public page; blog categories have none. */}
                {formData.slug && type === 'product' && (
                  <div className="wp-misc-row">
                    <a
                      href={getCategoryUrl(formData.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wp-link"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden="true" /> Preview live page
                    </a>
                  </div>
                )}
              </div>
              <div className="wp-box-foot">
                <button
                  type="button"
                  onClick={() => router.push(type === 'product' ? '/admin/categories' : '/admin/blogs/categories')}
                  className="wp-link"
                  style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "#b32d2e" }}
                >
                  Cancel
                </button>
                {formData._id && !formData.isDeleted && (
                  <button
                    type="button"
                    onClick={handleTrash}
                    disabled={trashing || saving}
                    className="wp-link"
                    style={{ background: "none", border: 0, padding: 0, marginLeft: 12, cursor: "pointer", color: "#b32d2e" }}
                  >
                    {trashing ? "Moving…" : "Move to Trash"}
                  </button>
                )}
                <span className="wp-spacer" />
                <button type="submit" disabled={saving || (categoryId && !formData._id)} className="wp-btn wp-btn-primary">
                  {saving ? "Saving..." : (categoryId ? "Update" : "Publish")}
                </button>
              </div>
            </section>

            {type === "product" && (
              <Postbox id="category-size-chart" title="Default Size Chart">
                <label htmlFor="category-size-chart-select" className="sr-only">Default size chart</label>
                <select
                  id="category-size-chart-select"
                  className="wp-select wp-full"
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
                <p className="wp-desc">
                  Products in this category will automatically inherit this size chart unless overridden.
                </p>
              </Postbox>
            )}

            <Postbox id="category-image" title="Category Image">
              <MediaPicker
                value={formData.image}
                onChange={(url) => setFormData({...formData, image: url})}
                label="Set image"
              />
              <p className="wp-desc">Shown on category cards and listings.</p>
            </Postbox>

            <Postbox id="category-banner" title="Category Banner Image">
              <MediaPicker
                value={formData.banner || ""}
                onChange={(url) => setFormData({...formData, banner: url})}
                label="Set banner image"
              />
              <div style={{ borderTop: "1px solid #f0f0f1", marginTop: 12, paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span className="wp-strong" id="banner-overlay-label">Banner overlay effect</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, showBannerOverlay: !formData.showBannerOverlay })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2271b1] focus-visible:ring-offset-1 ${
                      formData.showBannerOverlay ? 'bg-[#2271b1]' : 'bg-[#8c8f94]'
                    }`}
                    role="switch"
                    aria-checked={Boolean(formData.showBannerOverlay)}
                    aria-labelledby="banner-overlay-label"
                    title="Toggle banner overlay effect"
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formData.showBannerOverlay ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="wp-desc">
                  {formData.showBannerOverlay ? 'On: a dark gradient overlay will show over the banner.' : 'Off: no overlay is applied on the banner.'}
                </p>
              </div>
            </Postbox>
          </div>
        </div>
      </form>
    </Page>
  );
}
