"use client";

import React, { useState } from "react";
import { Eye, CheckCircle, AlertTriangle, RefreshCw, Smartphone, Monitor } from "lucide-react";
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
    if (parentType === "product") pathPrefix = "/product/";
    else if (parentType === "blog") pathPrefix = "/blog/";
    else if (parentType === "category") pathPrefix = "/shop/";

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

  return (
    <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[2px] p-6 space-y-6">
      {/* Header and Auto Generator */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-[14px] font-bold text-gray-700">Search Engine Optimization (SEO)</h3>
          <p className="text-[12px] text-gray-400">Configure search indexing, metadata fallbacks, and social sharing templates.</p>
        </div>
        <button
          type="button"
          onClick={handleAutoGenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f6f7f7] border border-[#c3c4c7] hover:border-[#2271b1] hover:text-[#2271b1] text-gray-700 text-[12px] rounded-[3px] font-medium transition-all shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Auto-Generate Fields
        </button>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex border-b border-gray-200 gap-4 pb-2 overflow-x-auto scrollbar-hide">
        {[
          { id: "general", label: "General SEO" },
          { id: "robots", label: "Robots Directives" },
          { id: "social", label: "Social Media" },
          { id: "schema", label: "JSON-LD Schema" }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveSubTab(t.id)}
            className={`pb-2 text-[12px] font-bold transition-all border-b-2 -mb-[9px] whitespace-nowrap ${
              activeSubTab === t.id
                ? "border-[#2271b1] text-[#2271b1]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {/* GENERAL SEO TAB */}
        {activeSubTab === "general" && (
          <div className="space-y-6">
            {/* Google Search Snippet Preview Box */}
            <div className="border border-gray-200 rounded-[3px] bg-[#fdfdfd] overflow-hidden max-w-2xl">
              <div className="bg-[#f6f7f7] border-b border-gray-200 px-3.5 py-2.5 flex justify-between items-center">
                <span className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-gray-500" />
                  Google Search Snippet Preview
                </span>
                <div className="flex bg-white border border-gray-200 rounded p-0.5">
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab("google-mobile")}
                    className={`p-1 rounded ${activePreviewTab === "google-mobile" ? "bg-gray-100 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}
                    title="Google Mobile Preview"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab("google-desktop")}
                    className={`p-1 rounded ${activePreviewTab === "google-desktop" ? "bg-gray-100 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}
                    title="Google Desktop Preview"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-4 bg-white min-h-[100px] flex flex-col justify-center">
                {activePreviewTab === "google-mobile" ? (
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-1 text-[12px] text-gray-600">
                      <span className="font-semibold text-gray-800">pairo.store</span>
                      <span>› {parentSlug || "slug"}</span>
                    </div>
                    <h4 className="text-[#1a0dab] text-[16px] leading-[20px] font-medium hover:underline cursor-pointer font-sans">
                      {displayTitle}
                    </h4>
                    <p className="text-[#4d5156] text-[12px] leading-[18px] font-sans break-words">
                      {displayDesc.substring(0, 155)}
                      {displayDesc.length > 155 && "..."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 text-left">
                    <div className="text-[12px] text-gray-600">
                      https://pairo.store › {parentSlug || "slug"}
                    </div>
                    <h4 className="text-[#1a0dab] text-[19px] leading-[24px] font-medium hover:underline cursor-pointer font-sans">
                      {displayTitle}
                    </h4>
                    <p className="text-[#4d5156] text-[13px] leading-[22px] font-sans break-words">
                      {displayDesc.substring(0, 155)}
                      {displayDesc.length > 155 && "..."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Inputs Container */}
            <div className="space-y-5 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase block">Focus Keyword</label>
                  <input
                    type="text"
                    placeholder="e.g. shearling jacket"
                    className="w-full border border-gray-200 p-2.5 text-[13px] rounded-[3px] focus:border-[#2271b1] focus:ring-0 outline-none"
                    value={focusKeyword}
                    onChange={e => updateField("focusKeyword", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase block">Keywords (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="jacket, leather, shearling"
                    className="w-full border border-gray-200 p-2.5 text-[13px] rounded-[3px] focus:border-[#2271b1] focus:ring-0 outline-none"
                    value={keywords}
                    onChange={e => updateField("keywords", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-gray-500 uppercase">Meta Title</label>
                  <span className={`text-[11px] ${titleOk ? "text-green-600" : "text-amber-600"}`}>{titleLen}/60 chars</span>
                </div>
                <input
                  type="text"
                  placeholder="Primary Brand Title | Category Description"
                  className="w-full border border-gray-200 p-2.5 text-[13px] rounded-[3px] focus:border-[#2271b1] focus:ring-0 outline-none font-medium"
                  value={title}
                  onChange={e => updateField("title", e.target.value)}
                />
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${titleOk ? "bg-green-500" : titleLen > 60 ? "bg-red-500" : "bg-amber-400"}`}
                    style={{ width: `${Math.min((titleLen / 60) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-gray-500 uppercase">Meta Description</label>
                  <span className={`text-[11px] ${descOk ? "text-green-600" : "text-amber-600"}`}>{descLen}/160 chars</span>
                </div>
                <textarea
                  placeholder="Summarize page content for search result listings..."
                  rows={3}
                  className="w-full border border-gray-200 p-2.5 text-[13px] rounded-[3px] focus:border-[#2271b1] focus:ring-0 outline-none"
                  value={description}
                  onChange={e => updateField("description", e.target.value)}
                />
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${descOk ? "bg-green-500" : descLen > 160 ? "bg-red-500" : "bg-amber-400"}`}
                    style={{ width: `${Math.min((descLen / 160) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase block">Canonical URL override</label>
                <input
                  type="url"
                  placeholder="Leave empty for auto-generated canonical tag"
                  className="w-full border border-gray-200 p-2.5 text-[13px] rounded-[3px] focus:border-[#2271b1] focus:ring-0 outline-none"
                  value={canonicalUrl}
                  onChange={e => updateField("canonicalUrl", e.target.value)}
                />
              </div>
            </div>

            {/* SEO Checklist & Scores */}
            <div className="border border-gray-200 rounded-[3px] bg-[#fdfdfd] p-4 space-y-4 max-w-2xl">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-[12px] font-bold text-gray-700">Optimization Checklist</span>
                <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${score >= 75 ? "bg-green-100 text-green-700" : score >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  Score: {score}%
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {checks.map((c, i) => (
                  <div key={i} className="flex gap-2 text-[12px] border-b border-gray-50 pb-2 last:border-0 md:last:border-b last:pb-2">
                    {c.status === "success" && <span className="text-green-500 font-bold">✓</span>}
                    {c.status === "warning" && <span className="text-amber-500 font-bold">⚠</span>}
                    {c.status === "error" && <span className="text-red-500 font-bold">✗</span>}
                    <div>
                      <div className="font-semibold text-gray-700">{c.label}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{c.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ROBOTS DIRECTIVES TAB */}
        {activeSubTab === "robots" && (
          <div className="space-y-4 max-w-2xl">
            <div className="border border-gray-150 p-4 rounded-[3px] bg-[#fdfdfd] space-y-3">
              <label className="text-[11px] font-bold text-gray-500 uppercase block">Robots Directives</label>
              <div className="flex flex-col gap-3 text-[13px] text-gray-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-[#2271b1] focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                    checked={noIndex}
                    onChange={e => updateField("noIndex", e.target.checked)}
                  />
                  <span>noindex (Hide from search results)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-[#2271b1] focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                    checked={noFollow}
                    onChange={e => updateField("noFollow", e.target.checked)}
                  />
                  <span>nofollow (Do not follow links on page)</span>
                </label>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              By default, all pages are indexable and links will be crawled. Checking "noindex" instructs search engines not to display this page in their search results. Checking "nofollow" prevents search engines from following the links on this page.
            </p>
          </div>
        )}

        {/* SOCIAL MEDIA TAB */}
        {activeSubTab === "social" && (
          <div className="space-y-6 max-w-4xl">
            {/* Live Card Previews */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Facebook Card Preview */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase block">Facebook Share Preview</label>
                <div className="border border-[#dadde1] rounded-md overflow-hidden bg-[#f2f3f5] font-sans text-left shadow-sm">
                  <div className="w-full h-44 overflow-hidden bg-gray-200 relative">
                    <img src={displayOgImage} alt="OG Card" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3 border-t border-[#dadde1] bg-white">
                    <div className="text-gray-500 uppercase text-[10px] tracking-wide">pairo.store</div>
                    <div className="font-bold text-[14px] text-[#1c1e21] truncate mt-0.5">{displayOgTitle}</div>
                    <div className="text-gray-500 text-[12px] mt-1 line-clamp-2 leading-relaxed">{displayOgDesc}</div>
                  </div>
                </div>
              </div>

              {/* Twitter Card Preview */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase block">Twitter Card Preview</label>
                <div className="border border-[#e1e8ed] rounded-xl overflow-hidden bg-white font-sans text-left shadow-sm">
                  <div className="w-full h-44 overflow-hidden bg-gray-200 relative">
                    <img src={displayTwImage} alt="Twitter Card" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3 border-t border-[#e1e8ed]">
                    <div className="text-[#8899a6] text-[11px]">pairo.store</div>
                    <div className="font-bold text-[14px] text-black truncate mt-0.5">{displayTwTitle}</div>
                    <div className="text-[#4a4a4a] text-[12px] mt-0.5 line-clamp-2 leading-relaxed">{displayTwDesc}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Inputs grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3 bg-gray-50/50 p-4 border border-gray-100 rounded">
                <label className="text-[11px] font-bold text-gray-500 uppercase block">Facebook (Open Graph)</label>
                <div className="space-y-2.5 bg-white p-3 border border-gray-100 rounded shadow-inner">
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">OG Share Title</label>
                    <input
                      type="text"
                      placeholder="OG Share Title"
                      className="w-full border border-gray-200 p-2.5 text-[13px] rounded-[3px] outline-none focus:border-[#2271b1]"
                      value={ogTitle}
                      onChange={e => updateField("ogTitle", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">OG Share Description</label>
                    <textarea
                      placeholder="OG Share Description"
                      rows={2}
                      className="w-full border border-gray-200 p-2.5 text-[13px] rounded-[3px] outline-none focus:border-[#2271b1]"
                      value={ogDescription}
                      onChange={e => updateField("ogDescription", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">OG Social Image</label>
                    <MediaPicker
                      value={ogImage}
                      onChange={url => updateField("ogImage", url)}
                      label="OG Social Image"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-gray-50/50 p-4 border border-gray-100 rounded">
                <label className="text-[11px] font-bold text-gray-500 uppercase block">Twitter (Cards)</label>
                <div className="space-y-2.5 bg-white p-3 border border-gray-100 rounded shadow-inner">
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Twitter Card Title</label>
                    <input
                      type="text"
                      placeholder="Twitter Card Title"
                      className="w-full border border-gray-200 p-2.5 text-[13px] rounded-[3px] outline-none focus:border-[#2271b1]"
                      value={twitterTitle}
                      onChange={e => updateField("twitterTitle", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Twitter Card Description</label>
                    <textarea
                      placeholder="Twitter Card Description"
                      rows={2}
                      className="w-full border border-gray-200 p-2.5 text-[13px] rounded-[3px] outline-none focus:border-[#2271b1]"
                      value={twitterDescription}
                      onChange={e => updateField("twitterDescription", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Twitter Social Image</label>
                    <MediaPicker
                      value={twitterImage}
                      onChange={url => updateField("twitterImage", url)}
                      label="Twitter Social Image"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* JSON-LD SCHEMA TAB */}
        {activeSubTab === "schema" && (
          <div className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Custom JSON-LD Structured Data</label>
                {jsonLdError ? (
                  <span className="flex items-center gap-1.5 text-red-500 text-[11px] font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    JSON Syntax Error
                  </span>
                ) : structuredData.trim() ? (
                  <span className="flex items-center gap-1.5 text-green-600 text-[11px] font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Valid Schema
                  </span>
                ) : (
                  <span className="text-gray-400 text-[11px]">Using fallback schemas</span>
                )}
              </div>
              <textarea
                placeholder={`{\n  "@context": "https://schema.org",\n  "@type": "Product",\n  "name": "Custom Shearling Jacket"\n}`}
                rows={8}
                className={`w-full font-mono text-[12px] p-2.5 border rounded-[3px] outline-none ${jsonLdError ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-[#2271b1]"}`}
                value={structuredData}
                onChange={e => updateField("structuredData", e.target.value)}
              />
              {jsonLdError && (
                <p className="text-[11px] text-red-500 mt-1 bg-red-50 p-2 rounded">{jsonLdError}</p>
              )}
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Add custom JSON-LD schema blocks to explicitly describe this entity to Google. Ensure the markup contains valid JSON syntax.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
