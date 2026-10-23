"use client";

import React, { useState, useId } from "react";
import {
  CheckCircle,
  RefreshCw,
  Smartphone,
  Monitor,
  AlertCircle
} from "lucide-react";
import MediaPicker from "./MediaPicker";

export default function SEOConfigPanel({
  seo = {},
  onChange,
  parentTitle = "",
  parentDescription = "",
  parentSlug = "",
  parentImage = "",
  parentType = "product"
}) {
  const [activePreviewTab, setActivePreviewTab] = useState("google-mobile");
  const [activeSubTab, setActiveSubTab] = useState("general");
  const uid = useId();

  // Initialize fields safely
  const title = seo.title || "";
  const description = seo.description || "";
  const keywords = Array.isArray(seo.keywords) ? seo.keywords.join(", ") : (seo.keywords || "");
  const focusKeyword = seo.focusKeyword || "";
  const canonicalUrl = seo.canonicalUrl || "";
  const noIndex = !!seo.noIndex;
  const noFollow = !!seo.noFollow;
  const ogTitle = seo.ogTitle || "";
  const ogDescription = seo.ogDescription || "";
  const ogImage = seo.ogImage || "";
  const twitterTitle = seo.twitterTitle || "";
  const twitterDescription = seo.twitterDescription || "";
  const twitterImage = seo.twitterImage || "";
  const structuredData = seo.structuredData || "";

  // Perform JSON-LD validation on render
  let jsonLdError = null;
  if (structuredData.trim()) {
    try {
      JSON.parse(structuredData);
    } catch (err) {
      jsonLdError = err.message;
    }
  }

  // Update a single SEO field and propagate changes
  const updateField = (field, val) => {
    let updatedVal = val;
    if (field === "keywords") {
      updatedVal = val.split(",").map(k => k.trim()).filter(Boolean);
    }
    onChange({
      ...seo,
      [field]: updatedVal
    });
  };

  // Strip HTML utility for auto-generation
  const stripHtml = (html) => {
    if (!html) return "";
    return html.replace(/<\/?[^>]+(>|$)/g, "").trim();
  };

  // Auto-generate fields from parent values
  const handleAutoGenerate = () => {
    const cleanDesc = stripHtml(parentDescription).substring(0, 155);
    const resolvedSlug = parentSlug ? parentSlug.toLowerCase() : "";
    const siteUrl = "https://pairo.store";
    
    let pathPrefix = "/";
    if (parentType === "product") pathPrefix = "/shop/";
    else if (parentType === "blog") pathPrefix = "/blog/";
    else if (parentType === "category") pathPrefix = "/";

    const generated = {
      ...seo,
      title: parentTitle.substring(0, 60),
      description: cleanDesc,
      focusKeyword: parentTitle.split(" ")[0]?.toLowerCase() || "",
      canonicalUrl: resolvedSlug ? `${siteUrl}${pathPrefix}${resolvedSlug}` : "",
      ogTitle: parentTitle.substring(0, 60),
      ogDescription: cleanDesc,
      ogImage: parentImage || seo.ogImage || "",
      twitterTitle: parentTitle.substring(0, 60),
      twitterDescription: cleanDesc,
      twitterImage: parentImage || seo.twitterImage || seo.ogImage || "",
    };
    onChange(generated);
  };

  // Live fallback titles & descriptions for preview calculations
  const displayTitle = title || parentTitle || "Pairo Store | Premium Shearling Jackets";
  const displayDesc = description || stripHtml(parentDescription) || "Experience the ultimate warmth and luxury with Pairo's handcrafted shearling jackets.";
  const displayOgTitle = ogTitle || displayTitle;
  const displayOgDesc = ogDescription || displayDesc;
  const displayOgImage = ogImage || parentImage || "/placeholder.jpg";
  const displayTwTitle = twitterTitle || displayOgTitle;
  const displayTwDesc = twitterDescription || displayOgDesc;
  const displayTwImage = twitterImage || displayOgImage;

  // Keyword validation metrics
  const checks = [];
  let score = 0;

  // 1. Meta Title length check
  const titleLen = displayTitle.length;
  const titleOk = titleLen >= 50 && titleLen <= 60;
  checks.push({
    label: `Meta Title Length: ${titleLen} chars (Recommended: 50-60)`,
    status: titleOk ? "success" : "warning",
    message: titleOk ? "Perfect length." : titleLen < 50 ? "Too short." : "Too long."
  });
  if (titleOk) score += 25;

  // 2. Meta Description length check
  const descLen = displayDesc.length;
  const descOk = descLen >= 120 && descLen <= 160;
  checks.push({
    label: `Meta Description Length: ${descLen} chars (Recommended: 120-160)`,
    status: descOk ? "success" : "warning",
    message: descOk ? "Perfect length." : descLen < 120 ? "Too short." : "Too long."
  });
  if (descOk) score += 25;

  // 3. Focus keyword in Meta Title check
  if (focusKeyword) {
    const hasFocusInTitle = displayTitle.toLowerCase().includes(focusKeyword.toLowerCase());
    checks.push({
      label: `Focus Keyword in Meta Title`,
      status: hasFocusInTitle ? "success" : "error",
      message: hasFocusInTitle ? "Found in title." : "Not found in title."
    });
    if (hasFocusInTitle) score += 25;
  } else {
    checks.push({
      label: "Focus Keyword Defined",
      status: "warning",
      message: "Define a focus keyword to evaluate search optimization."
    });
  }

  // 4. Focus keyword in Meta Description check
  if (focusKeyword) {
    const hasFocusInDesc = displayDesc.toLowerCase().includes(focusKeyword.toLowerCase());
    checks.push({
      label: `Focus Keyword in Meta Description`,
      status: hasFocusInDesc ? "success" : "error",
      message: hasFocusInDesc ? "Found in description." : "Not found in description."
    });
    if (hasFocusInDesc) score += 25;
  }

  // Presentational helpers
  const fid = (name) => `${uid}-${name}`;
  const counterColor = (ok, over) => (ok ? "#00a32a" : over ? "#d63638" : "#996800");
  const subBox = { border: "1px solid #dcdcde", background: "#fff", marginBottom: 16 };
  const subHead = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #dcdcde", background: "#f6f7f7", fontWeight: 600, color: "#1d2327", fontSize: 14 };
  const fieldFlex = { flex: "1 1 280px", minWidth: 0 };
  const statusDot = (status) => ({
    display: "inline-block", width: 10, height: 10, borderRadius: "50%", marginTop: 4, flexShrink: 0,
    background: status === "success" ? "#00a32a" : status === "warning" ? "#dba617" : "#d63638",
  });

  return (
    <section className="wp-postbox" aria-labelledby={fid("title")} style={{ maxWidth: "100%", overflow: "hidden" }}>
      {/* Header and Auto Generator */}
      <div className="wp-postbox-head">
        <h2 id={fid("title")}>Search Engine Optimization (SEO)</h2>
        <span className="wp-postbox-aside">
          <button
            type="button"
            onClick={handleAutoGenerate}
            className="wp-btn"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Auto-generate fields
          </button>
        </span>
      </div>

      <div className="wp-inside">
        <p className="wp-desc" style={{ margin: "0 0 12px" }}>Configure search engine indexing, fallback metadata, and social previews.</p>

        {/* Sub-tab navigation */}
        <div className="wp-tabs" role="tablist" aria-label="SEO sections">
          {[
            { id: "general", label: "General" },
            { id: "social", label: "Social Share" },
            { id: "schema", label: "Schema Markup" },
            { id: "robots", label: "Robots Settings" }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeSubTab === t.id}
              onClick={() => setActiveSubTab(t.id)}
              className="wp-tab"
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div role="tabpanel" aria-label={activeSubTab}>
          {/* GENERAL SEO TAB */}
          {activeSubTab === "general" && (
            <div>
              <div style={subBox}>
                <div style={subHead}>Meta tags</div>
                <div style={{ padding: "4px 12px" }}>
                  <div className="wp-frow">
                    <label htmlFor={fid("focus")} className="wp-flabel">Focus keyword</label>
                    <input
                      id={fid("focus")}
                      type="text"
                      placeholder="e.g. shearling jacket"
                      className="wp-input"
                      style={fieldFlex}
                      value={focusKeyword}
                      onChange={e => updateField("focusKeyword", e.target.value)}
                    />
                  </div>
                  <div className="wp-frow">
                    <label htmlFor={fid("keywords")} className="wp-flabel">Keywords</label>
                    <input
                      id={fid("keywords")}
                      type="text"
                      placeholder="jacket, leather, shearling"
                      className="wp-input"
                      style={fieldFlex}
                      value={keywords}
                      onChange={e => updateField("keywords", e.target.value)}
                    />
                    <span className="wp-hint">Separate keywords with commas.</span>
                  </div>
                  <div className="wp-frow">
                    <label htmlFor={fid("seo-title")} className="wp-flabel">SEO title</label>
                    <div style={fieldFlex}>
                      <input
                        id={fid("seo-title")}
                        type="text"
                        placeholder="Primary Brand Title | Category Description"
                        className="wp-input wp-full"
                        aria-describedby={fid("seo-title-count")}
                        value={title}
                        onChange={e => updateField("title", e.target.value)}
                      />
                      <div aria-hidden="true" style={{ height: 4, background: "#f0f0f1", marginTop: 6 }}>
                        <div style={{ height: "100%", width: `${Math.min((titleLen / 60) * 100, 100)}%`, background: counterColor(titleOk, titleLen > 60) }} />
                      </div>
                      <p id={fid("seo-title-count")} className="wp-desc">
                        <span style={{ color: counterColor(titleOk, titleLen > 60), fontWeight: 600 }}>{titleLen}</span> / 60 characters (recommended 50–60)
                      </p>
                    </div>
                  </div>
                  <div className="wp-frow">
                    <label htmlFor={fid("meta-desc")} className="wp-flabel">Meta description</label>
                    <div style={fieldFlex}>
                      <textarea
                        id={fid("meta-desc")}
                        placeholder="Summarize page content for search result listings..."
                        rows={4}
                        className="wp-textarea wp-full"
                        aria-describedby={fid("meta-desc-count")}
                        value={description}
                        onChange={e => updateField("description", e.target.value)}
                      />
                      <div aria-hidden="true" style={{ height: 4, background: "#f0f0f1", marginTop: 6 }}>
                        <div style={{ height: "100%", width: `${Math.min((descLen / 160) * 100, 100)}%`, background: counterColor(descOk, descLen > 160) }} />
                      </div>
                      <p id={fid("meta-desc-count")} className="wp-desc">
                        <span style={{ color: counterColor(descOk, descLen > 160), fontWeight: 600 }}>{descLen}</span> / 160 characters (recommended 120–160)
                      </p>
                    </div>
                  </div>
                  <div className="wp-frow">
                    <label htmlFor={fid("canonical")} className="wp-flabel">Canonical URL</label>
                    <input
                      id={fid("canonical")}
                      type="url"
                      placeholder="Leave empty for auto-generated canonical tag"
                      className="wp-input"
                      style={fieldFlex}
                      value={canonicalUrl}
                      onChange={e => updateField("canonicalUrl", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2 items-start">
                {/* Google Search Snippet Preview Box */}
                <div style={{ ...subBox, marginBottom: 0 }}>
                  <div style={subHead}>
                    <span>Search preview</span>
                    <span style={{ flex: 1 }} />
                    <div className="wp-seg" role="group" aria-label="Preview device">
                      <button
                        type="button"
                        aria-pressed={activePreviewTab === "google-mobile"}
                        onClick={() => setActivePreviewTab("google-mobile")}
                        title="Google Mobile Preview"
                        aria-label="Mobile preview"
                      >
                        <Smartphone className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-pressed={activePreviewTab === "google-desktop"}
                        onClick={() => setActivePreviewTab("google-desktop")}
                        title="Google Desktop Preview"
                        aria-label="Desktop preview"
                      >
                        <Monitor className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: 16, fontFamily: "arial, sans-serif", minHeight: 120 }}>
                    <div style={{ maxWidth: activePreviewTab === "google-mobile" ? 380 : 600, wordBreak: "break-word" }}>
                      <div style={{ color: "#006621", fontSize: 14, lineHeight: "20px" }}>
                        {activePreviewTab === "google-mobile"
                          ? <>pairo.store › {parentSlug || "slug"}</>
                          : <>https://pairo.store › {parentSlug || "slug"}</>}
                      </div>
                      <div style={{ color: "#1a0dab", fontSize: 18, lineHeight: "24px", margin: "2px 0 3px" }}>
                        {displayTitle}
                      </div>
                      <p style={{ color: "#545454", fontSize: 13, lineHeight: "19px", margin: 0 }}>
                        {displayDesc.substring(0, 155)}
                        {displayDesc.length > 155 && "..."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* SEO Checklist & Scores */}
                <div style={{ ...subBox, marginBottom: 0 }}>
                  <div style={subHead}>
                    <span>SEO analysis</span>
                    <span style={{ flex: 1 }} />
                    <span className="wp-pill" style={{
                      background: score >= 80 ? "#c6e1c6" : score >= 50 ? "#f8dda7" : "#eba3a3",
                      color: score >= 80 ? "#1f3d08" : score >= 50 ? "#573b00" : "#761919",
                    }}>
                      {score}/100
                    </span>
                  </div>
                  <div style={{ padding: "8px 12px" }}>
                    <p className="wp-desc" style={{ margin: "0 0 6px" }}>
                      {score >= 80 ? "Excellent. Optimized for search index." :
                       score >= 50 ? "Moderate. Fix suggestions below." :
                       "Poor. Needs optimization."}
                    </p>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {checks.map((c, i) => (
                        <li key={i} className="flex gap-2" style={{ padding: "7px 0", borderTop: "1px solid #f0f0f1" }}>
                          <span style={statusDot(c.status)} aria-hidden="true" />
                          <span className="sr-only">{c.status === "success" ? "Good:" : c.status === "warning" ? "Warning:" : "Problem:"}</span>
                          <div className="min-w-0">
                            <div className="wp-strong">{c.label}</div>
                            <div className="wp-muted">{c.message}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ROBOTS DIRECTIVES TAB */}
          {activeSubTab === "robots" && (
            <div style={{ maxWidth: 760 }}>
              <div style={subBox}>
                <div style={subHead}>Indexation directives</div>
                <div style={{ padding: "8px 12px" }}>
                  <label className="wp-check">
                    <input
                      type="checkbox"
                      checked={noIndex}
                      onChange={e => updateField("noIndex", e.target.checked)}
                    />
                    <span><code>noindex</code> — Hide this page from search engine listings</span>
                  </label>
                  <label className="wp-check">
                    <input
                      type="checkbox"
                      checked={noFollow}
                      onChange={e => updateField("noFollow", e.target.checked)}
                    />
                    <span><code>nofollow</code> — Prevent search engines from crawling links on this page</span>
                  </label>
                </div>
              </div>
              <p className="wp-desc">
                By default, all pages are indexable and links will be crawled. Checking &quot;noindex&quot; instructs search engines not to display this page in their search results. Checking &quot;nofollow&quot; prevents search engines from following the links on this page.
              </p>
            </div>
          )}

          {/* SOCIAL MEDIA TAB */}
          {activeSubTab === "social" && (
            <div className="grid gap-4 xl:grid-cols-2 items-start">
              {/* Left: Social Config Inputs */}
              <div className="min-w-0">
                {/* Facebook Inputs */}
                <div style={subBox}>
                  <div style={subHead}>Facebook (Open Graph)</div>
                  <div style={{ padding: "8px 12px" }}>
                    <div className="wp-field">
                      <label htmlFor={fid("og-title")} className="wp-label">Share title</label>
                      <input
                        id={fid("og-title")}
                        type="text"
                        placeholder="OG Share Title"
                        className="wp-input wp-full"
                        value={ogTitle}
                        onChange={e => updateField("ogTitle", e.target.value)}
                      />
                    </div>
                    <div className="wp-field">
                      <label htmlFor={fid("og-desc")} className="wp-label">Share description</label>
                      <textarea
                        id={fid("og-desc")}
                        placeholder="OG Share Description"
                        rows={3}
                        className="wp-textarea wp-full"
                        value={ogDescription}
                        onChange={e => updateField("ogDescription", e.target.value)}
                      />
                    </div>
                    <MediaPicker
                      value={ogImage}
                      onChange={url => updateField("ogImage", url)}
                      label="OG Social Image"
                    />
                  </div>
                </div>

                {/* Twitter Inputs */}
                <div style={subBox}>
                  <div style={subHead}>Twitter (Cards)</div>
                  <div style={{ padding: "8px 12px" }}>
                    <div className="wp-field">
                      <label htmlFor={fid("tw-title")} className="wp-label">Card title</label>
                      <input
                        id={fid("tw-title")}
                        type="text"
                        placeholder="Twitter Card Title"
                        className="wp-input wp-full"
                        value={twitterTitle}
                        onChange={e => updateField("twitterTitle", e.target.value)}
                      />
                    </div>
                    <div className="wp-field">
                      <label htmlFor={fid("tw-desc")} className="wp-label">Card description</label>
                      <textarea
                        id={fid("tw-desc")}
                        placeholder="Twitter Card Description"
                        rows={3}
                        className="wp-textarea wp-full"
                        value={twitterDescription}
                        onChange={e => updateField("twitterDescription", e.target.value)}
                      />
                    </div>
                    <MediaPicker
                      value={twitterImage}
                      onChange={url => updateField("twitterImage", url)}
                      label="Twitter Social Image"
                    />
                  </div>
                </div>
              </div>

              {/* Right: Previews */}
              <div className="min-w-0">
                {/* Facebook Card Preview */}
                <div style={subBox}>
                  <div style={subHead}>Facebook share preview</div>
                  <div style={{ padding: 12 }}>
                    <div style={{ border: "1px solid #dcdcde", overflow: "hidden", fontFamily: "Helvetica, Arial, sans-serif" }}>
                      <div style={{ height: 176, overflow: "hidden", background: "#f0f0f1" }}>
                        <img src={displayOgImage} alt="OG Card" className="w-full h-full object-cover" />
                      </div>
                      <div style={{ padding: "10px 12px", borderTop: "1px solid #dcdcde", background: "#f2f3f5" }}>
                        <div style={{ color: "#606770", fontSize: 12, textTransform: "uppercase" }}>pairo.store</div>
                        <div className="truncate" style={{ fontWeight: 600, fontSize: 16, color: "#1d2129", marginTop: 2 }}>{displayOgTitle}</div>
                        <div className="line-clamp-2" style={{ color: "#606770", fontSize: 14, marginTop: 2 }}>{displayOgDesc}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Twitter Card Preview */}
                <div style={subBox}>
                  <div style={subHead}>Twitter card preview</div>
                  <div style={{ padding: 12 }}>
                    <div style={{ border: "1px solid #dcdcde", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ height: 176, overflow: "hidden", background: "#f0f0f1" }}>
                        <img src={displayTwImage} alt="Twitter Card" className="w-full h-full object-cover" />
                      </div>
                      <div style={{ padding: "10px 12px", borderTop: "1px solid #dcdcde" }}>
                        <div style={{ color: "#536471", fontSize: 13 }}>pairo.store</div>
                        <div className="truncate" style={{ fontSize: 15, color: "#0f1419", marginTop: 2 }}>{displayTwTitle}</div>
                        <div className="line-clamp-2" style={{ color: "#536471", fontSize: 14, marginTop: 2 }}>{displayTwDesc}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* JSON-LD SCHEMA TAB */}
          {activeSubTab === "schema" && (
            <div style={{ maxWidth: 760 }}>
              <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 6 }}>
                <label htmlFor={fid("schema")} className="wp-label" style={{ margin: 0 }}>Custom JSON-LD structured data</label>
                <span style={{ flex: 1 }} />
                {jsonLdError ? (
                  <span className="wp-pill" style={{ background: "#eba3a3", color: "#761919" }}>
                    <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    JSON Syntax Error
                  </span>
                ) : structuredData.trim() ? (
                  <span className="wp-pill" style={{ background: "#c6e1c6", color: "#1f3d08" }}>
                    <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    Valid Schema
                  </span>
                ) : (
                  <span className="wp-pill" style={{ background: "#e5e5e5", color: "#454545" }}>Using fallback schemas</span>
                )}
              </div>
              <textarea
                id={fid("schema")}
                placeholder={`{\n  "@context": "https://schema.org",\n  "@type": "Product",\n  "name": "Custom Shearling Jacket"\n}`}
                rows={10}
                className="wp-textarea wp-full"
                style={{ fontFamily: "Consolas, Monaco, monospace", fontSize: 13, borderColor: jsonLdError ? "#d63638" : undefined }}
                aria-invalid={jsonLdError ? true : undefined}
                value={structuredData}
                onChange={e => updateField("structuredData", e.target.value)}
              />
              {jsonLdError && (
                <div className="wp-notice wp-notice-error" role="alert" style={{ marginTop: 8 }}><p>{jsonLdError}</p></div>
              )}
              <p className="wp-desc">
                Add custom JSON-LD schema blocks to explicitly describe this entity to Google. Ensure the markup contains valid JSON syntax.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
