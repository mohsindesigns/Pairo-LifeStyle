"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  Save, Globe, Layout, AlignLeft, Share2,
  Plus, GripVertical, X, Eye, EyeOff,
  Camera, MessageSquare, Link2, Users, ChevronDown, ChevronUp
} from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import MediaPickerModal from "@/components/admin/MediaPickerModal";

const generateId = () => Math.random().toString(36).substring(2, 11);

const inputClass = "w-full border border-[#8c8f94] rounded-[3px] px-3 py-[6px] text-[13px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] bg-white";
const labelClass = "block text-[13px] font-semibold text-[#1d2327] mb-[4px]";
const descClass = "text-[12px] text-[#646970] mt-[2px]";
const sectionTitle = "text-[14px] font-bold text-[#1d2327] pb-2 mb-4 border-b border-[#c3c4c7]";

/* ── Media Picker ───────────────────────────────────────────── */
function ImagePicker({ value, onChange, label, description }) {
  const [open, setOpen] = useState(false);
  return (
    <tr className="border-b border-[#f0f0f1]">
      <th className="text-left px-3 py-4 align-top w-52"><label className={labelClass}>{label}</label>{description && <p className={descClass}>{description}</p>}</th>
      <td className="px-3 py-4">
        <div className="flex items-center gap-3">
          {value && <img src={value} alt="" className="h-12 w-auto border border-[#c3c4c7] rounded-[3px] bg-[#f0f0f1]" />}
          <button type="button" onClick={() => setOpen(true)} className="border border-[#2271b1] text-[#2271b1] rounded-[3px] px-3 py-[5px] text-[13px] font-medium hover:bg-[#f6f7f7]">{value ? 'Replace Image' : 'Select Image'}</button>
          {value && <button type="button" onClick={() => onChange('')} className="text-[#d63638] text-[12px] hover:underline">Remove</button>}
        </div>
        {open && <MediaPickerModal open onClose={() => setOpen(false)} onSelect={(sel) => { onChange(sel.url); setOpen(false); }} title={`Select ${label}`} />}
      </td>
    </tr>
  );
}

/* Inline image picker for mega menu banner (not a table row) */
function MegaBannerImagePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-[#2271b1] text-[#2271b1] rounded-[3px] px-3 py-[5px] text-[12px] font-medium hover:bg-[#f0f6fb] transition-colors"
      >
        {value ? 'Replace Image' : 'Select Image'}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-[#d63638] text-[12px] hover:underline"
        >
          Remove
        </button>
      )}
      {open && (
        <MediaPickerModal
          open
          onClose={() => setOpen(false)}
          onSelect={(sel) => { onChange(sel.url); setOpen(false); }}
          title="Select Banner Image"
        />
      )}
    </>
  );
}

/* ── Table row helpers ───────────────────────────────────────── */
function TextRow({ label, description, value, onChange, placeholder, textarea }) {
  return (
    <tr className="border-b border-[#f0f0f1]">
      <th className="text-left px-3 py-4 align-top w-52"><label className={labelClass}>{label}</label>{description && <p className={descClass}>{description}</p>}</th>
      <td className="px-3 py-4">
        {textarea ? <textarea className={`${inputClass} resize-none`} rows={3} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input className={inputClass} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />}
      </td>
    </tr>
  );
}

/* ── SOCIAL PLATFORMS ─────────────────────────────────────────── */
const SOCIALS = [
  { key: 'facebook', label: 'Facebook', Icon: Users },
  { key: 'instagram', label: 'Instagram', Icon: Camera },
  { key: 'twitter', label: 'X / Twitter', Icon: MessageSquare },
  { key: 'linkedin', label: 'LinkedIn', Icon: Link2 },
  { key: 'youtube', label: 'YouTube', Icon: Share2 },
  { key: 'tiktok', label: 'TikTok', Icon: Globe },
];

/* ═══════════════════════════════════════════════════════════════
   TAB: General
   ═══════════════════════════════════════════════════════════════ */
function GeneralTab({ config, onChange }) {
  const b = config.brand || {};
  const set = (k, v) => onChange({ ...config, brand: { ...b, [k]: v } });
  return (
    <table className="form-table w-full"><tbody>
      <TextRow label="Site Title" value={b.name} onChange={v => set('name', v)} placeholder="Pairo" />
      <ImagePicker label="Favicon" description="Upload a square icon (e.g. 512x512) for the browser tab." value={b.faviconUrl} onChange={v => set('faviconUrl', v)} />
      <TextRow label="Tagline" value={b.tagline} onChange={v => set('tagline', v)} placeholder="Premium Shearling" description="In a few words, explain what this site is about." />
      <TextRow label="Footer Brand Name" value={b.footerBrandName} onChange={v => set('footerBrandName', v)} placeholder="PAIRO" description="Large animated text shown at the bottom of the footer." />
      <TextRow label="Copyright Text" value={b.copyrightText} onChange={v => set('copyrightText', v)} placeholder="PAIRO — ALL RIGHTS RESERVED © 2026" />
      <TextRow label="Privacy Policy URL" value={b.privacyUrl} onChange={v => set('privacyUrl', v)} placeholder="/privacy" />
      <TextRow label="Terms of Service URL" value={b.termsUrl} onChange={v => set('termsUrl', v)} placeholder="/terms" />
      <TextRow label="WhatsApp Number" value={b.whatsappNumber} onChange={v => set('whatsappNumber', v)} placeholder="+1234567890" description="Atelier WhatsApp contact number with country code." />
      <TextRow label="WhatsApp Chat URL" value={b.whatsappUrl} onChange={v => set('whatsappUrl', v)} placeholder="https://wa.me/..." description="Direct WhatsApp chat link." />
      <tr className="border-b border-[#f0f0f1]">
        <th className="text-left px-3 py-4 align-top w-52">
          <label className={labelClass}>Disable Search Indexing</label>
          <p className={descClass}>Discourage search engines from indexing this site (applies noindex, nofollow globally).</p>
        </th>
        <td className="px-3 py-4">
          <input
            type="checkbox"
            checked={!!config.disableSearchEngineIndexing}
            onChange={e => onChange({ ...config, disableSearchEngineIndexing: e.target.checked })}
            className="w-4 h-4 accent-[#2271b1] cursor-pointer"
          />
        </td>
      </tr>
    </tbody></table>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB: Header
   ═══════════════════════════════════════════════════════════════ */
function HeaderTab({ config, onChange, dbPages, dbCategories, dbProducts }) {
  const hc = config.headerConfig || {};
  const setHc = (u) => onChange({ ...config, headerConfig: { ...hc, ...u } });
  const navItems = (hc.navItems || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  const topOffers = hc.topOffers || [];

  // --- Nav item CRUD ---
  const addNavItem = () => setHc({ navItems: [...navItems, { id: generateId(), label: '', type: 'custom_url', value: '', openInNewTab: false, enabled: true, subItems: [], order: navItems.length }] });
  const updateNav = (idx, u) => setHc({ navItems: navItems.map((it, i) => i === idx ? { ...it, ...u } : it) });
  const removeNav = (idx) => setHc({ navItems: navItems.filter((_, i) => i !== idx).map((it, i) => ({ ...it, order: i })) });
  const moveNav = (idx, dir) => {
    const arr = [...navItems]; const ni = idx + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    setHc({ navItems: arr.map((it, i) => ({ ...it, order: i })) });
  };

  // --- Sub item CRUD ---
  const addSubItem = (parentIdx) => {
    const parent = navItems[parentIdx];
    const subItems = parent.subItems || [];
    const newSub = { id: generateId(), label: '', type: 'custom_url', value: '', openInNewTab: false, order: subItems.length };
    updateNav(parentIdx, { subItems: [...subItems, newSub] });
  };
  const updateSubItem = (parentIdx, subIdx, u) => {
    const parent = navItems[parentIdx];
    const subItems = parent.subItems || [];
    const updated = subItems.map((sub, i) => i === subIdx ? { ...sub, ...u } : sub);
    updateNav(parentIdx, { subItems: updated });
  };
  const removeSubItem = (parentIdx, subIdx) => {
    const parent = navItems[parentIdx];
    const subItems = parent.subItems || [];
    const updated = subItems.filter((_, i) => i !== subIdx).map((sub, i) => ({ ...sub, order: i }));
    updateNav(parentIdx, { subItems: updated });
  };
  const moveSubItem = (parentIdx, subIdx, dir) => {
    const parent = navItems[parentIdx];
    const subItems = [...(parent.subItems || [])];
    const ni = subIdx + dir;
    if (ni < 0 || ni >= subItems.length) return;
    [subItems[subIdx], subItems[ni]] = [subItems[ni], subItems[subIdx]];
    updateNav(parentIdx, { subItems: subItems.map((sub, i) => ({ ...sub, order: i })) });
  };

  // --- Top offers CRUD ---
  const addOffer = () => setHc({ topOffers: [...topOffers, ''] });
  const updateOffer = (idx, v) => setHc({ topOffers: topOffers.map((o, i) => i === idx ? v : o) });
  const removeOffer = (idx) => setHc({ topOffers: topOffers.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-8">
      {/* Logo */}
      <div className="bg-white border border-[#c3c4c7] rounded-[3px]">
        <h3 className="px-4 py-3 bg-[#f6f7f7] border-b border-[#c3c4c7] text-[13px] font-bold text-[#1d2327]">Header Logo</h3>
        <table className="w-full"><tbody>
          <ImagePicker label="Logo" description="Upload or select from Media Library." value={hc.logoUrl} onChange={v => setHc({ logoUrl: v })} />
        </tbody></table>
      </div>

      {/* Top Announcement Bar */}
      <div className="bg-white border border-[#c3c4c7] rounded-[3px]">
        <div className="px-4 py-3 bg-[#f6f7f7] border-b border-[#c3c4c7] flex items-center justify-between">
          <h3 className="text-[13px] font-bold text-[#1d2327]">Announcement Bar</h3>
          <button type="button" onClick={addOffer} className="text-[#2271b1] text-[12px] font-medium hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Message</button>
        </div>
        <div className="p-4 space-y-2">
          {topOffers.length === 0 && <p className="text-[12px] text-[#646970] italic">No announcement messages. Click "Add Message" to create one.</p>}
          {topOffers.map((msg, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${inputClass} flex-1`} value={msg} onChange={e => updateOffer(i, e.target.value)} placeholder="e.g. FREE EXPRESS SHIPPING ON ALL ORDERS" />
              <button type="button" onClick={() => removeOffer(i)} className="text-[#d63638] p-1 hover:bg-red-50 rounded-[3px]"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="bg-white border border-[#c3c4c7] rounded-[3px]">
        <div className="px-4 py-3 bg-[#f6f7f7] border-b border-[#c3c4c7] flex items-center justify-between">
          <h3 className="text-[13px] font-bold text-[#1d2327]">Navigation Menu</h3>
          <button type="button" onClick={addNavItem} className="bg-[#2271b1] text-white text-[12px] font-medium px-3 py-[4px] rounded-[3px] hover:bg-[#135e96] flex items-center gap-1"><Plus className="w-3 h-3" /> Add Menu Item</button>
        </div>
        <div className="p-4 space-y-3">
          {navItems.length === 0 && <p className="text-[12px] text-[#646970] italic">No menu items yet. Click "Add Menu Item" to get started.</p>}
          {navItems.map((item, idx) => (
            <div key={item.id || idx} className="border border-[#c3c4c7] rounded-[3px] bg-white">
              {/* Item header bar */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[#f6f7f7] border-b border-[#c3c4c7]">
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveNav(idx, -1)} disabled={idx === 0} className="p-0.5 text-[#646970] hover:text-[#1d2327] disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => moveNav(idx, 1)} disabled={idx === navItems.length - 1} className="p-0.5 text-[#646970] hover:text-[#1d2327] disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
                <span className="text-[12px] font-bold text-[#1d2327] flex-1 truncate">{item.label || '(untitled)'}</span>
                <span className="text-[10px] text-[#646970] uppercase tracking-wider bg-white border border-[#c3c4c7] px-2 py-0.5 rounded-[3px]">{item.type?.replace('_', ' ')}</span>
                <button type="button" onClick={() => updateNav(idx, { enabled: !item.enabled })} className={`p-1 rounded-[3px] ${item.enabled ? 'text-green-600' : 'text-[#646970]'}`} title={item.enabled ? 'Visible' : 'Hidden'}>
                  {item.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={() => removeNav(idx)} className="p-1 text-[#d63638] hover:bg-red-50 rounded-[3px]"><X className="w-3.5 h-3.5" /></button>
              </div>
              {/* Item body */}
              <div className="p-3 grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Label */}
                <div className="md:col-span-3">
                  <label className="text-[11px] font-semibold text-[#646970] uppercase tracking-wider block mb-1">Label</label>
                  <input className={inputClass} value={item.label} onChange={e => updateNav(idx, { label: e.target.value })} placeholder="Menu label" />
                </div>
                {/* Type */}
                <div className="md:col-span-3">
                  <label className="text-[11px] font-semibold text-[#646970] uppercase tracking-wider block mb-1">Type</label>
                  <select className={inputClass} value={item.type} onChange={e => updateNav(idx, { type: e.target.value, value: e.target.value === 'blog_list' ? '/blog' : '' })}>
                    <option value="custom_url">Custom Link</option>
                    <option value="page">Page</option>
                    <option value="blog_list">Blog List Page</option>
                    <option value="product">Only 1 Product</option>
                    <option value="product_category">Any 1 Product Category</option>
                    <option value="mega_menu">Mega Menu</option>
                    <option value="dropdown_product">Dropdown List of Product</option>
                    <option value="dropdown_category">Dropdown List of Category</option>
                  </select>
                </div>
                {/* Value */}
                <div className="md:col-span-4">
                  <label className="text-[11px] font-semibold text-[#646970] uppercase tracking-wider block mb-1">
                    {item.type === 'page' ? 'Page' : item.type === 'product' ? 'Product' : item.type === 'product_category' ? 'Category' : ['mega_menu', 'dropdown_product', 'dropdown_category', 'blog_list'].includes(item.type) ? 'Configuration' : 'URL'}
                  </label>
                  {item.type === 'blog_list' ? (
                    <div className="text-[12px] text-[#2271b1] font-mono py-[6px] font-bold">
                      Auto-routes to /blog
                    </div>
                  ) : item.type === 'page' ? (
                    <select className={inputClass} value={item.value} onChange={e => updateNav(idx, { value: e.target.value })}>
                      <option value="">— Select Page —</option>
                      <option value="/blog">Blog List (System Page)</option>
                      {dbPages.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                    </select>
                  ) : item.type === 'product' ? (
                    <select className={inputClass} value={item.value} onChange={e => updateNav(idx, { value: e.target.value })}>
                      <option value="">— Select Product —</option>
                      {dbProducts.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                    </select>
                  ) : item.type === 'product_category' ? (
                    <select className={inputClass} value={item.value} onChange={e => updateNav(idx, { value: e.target.value })}>
                      <option value="">— Select Category —</option>
                      {dbCategories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                    </select>
                  ) : ['mega_menu', 'dropdown_product', 'dropdown_category'].includes(item.type) ? (
                    <div className="text-[12px] text-[#646970] py-[6px]">See options below</div>
                  ) : (
                    <input className={inputClass} value={item.value} onChange={e => updateNav(idx, { value: e.target.value })} placeholder={item.type === 'external_url' ? 'https://...' : '/page-slug'} />
                  )}
                </div>
                {/* Options */}
                <div className="md:col-span-2 flex flex-col justify-end gap-1.5">
                  {(item.type === 'custom_url' || item.type === 'external_url') && (
                    <label className="flex items-center gap-1.5 text-[11px] text-[#1d2327] cursor-pointer mt-1">
                      <input type="checkbox" checked={item.openInNewTab || false} onChange={e => updateNav(idx, { openInNewTab: e.target.checked })} /> New tab
                    </label>
                  )}
                </div>
              </div>

              {/* Mega Menu Sub-Items Builder */}
              {item.type === 'mega_menu' && (
                <div className="border-t border-[#c3c4c7] bg-[#fbfbfc] p-4 pl-8 space-y-5">
                  {/* Category Selection */}
                  <div>
                    <h4 className="text-[11px] font-bold text-[#1d2327] uppercase tracking-wider mb-3">Mega Menu — Featured Categories</h4>
                    <p className="text-[11px] text-[#646970] mb-3">Select which categories appear inside the mega menu dropdown for this item.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-2">
                      {dbCategories.map(cat => {
                        const megaIds = item.megaCategoryIds || [];
                        const selected = megaIds.includes(cat.slug);
                        return (
                          <label key={cat.slug} className={`flex items-center gap-2.5 p-2.5 border rounded-[3px] cursor-pointer transition-colors text-[12px] ${selected ? 'border-[#2271b1] bg-[#f0f6fb]' : 'border-[#c3c4c7] hover:bg-[#f6f7f7]'}`}>
                            <input type="checkbox" checked={selected} onChange={() => {
                              const updated = selected ? megaIds.filter(s => s !== cat.slug) : [...megaIds, cat.slug];
                              updateNav(idx, { megaCategoryIds: updated });
                            }} />
                            {cat.image && <img src={cat.image} alt="" className="w-6 h-6 rounded object-cover" />}
                            <span className="font-medium text-[#1d2327]">{cat.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {dbCategories.length === 0 && <p className="text-[11px] text-[#646970] italic">No categories found.</p>}
                  </div>

                  {/* Promotional Banner */}
                  <div className="border-t border-[#e0e0e0] pt-5">
                    <h4 className="text-[11px] font-bold text-[#1d2327] uppercase tracking-wider mb-1">Promotional Banner</h4>
                    <p className="text-[11px] text-[#646970] mb-4">This banner fills the right side of the mega menu. On hover over a category, it crossfades to that category's image.</p>

                    {/* Banner Image */}
                    <div className="mb-4">
                      <label className="block text-[12px] font-semibold text-[#1d2327] mb-2">Banner Image</label>
                      <div className="flex items-center gap-3 flex-wrap">
                        {item.megaBannerImage && (
                          <img src={item.megaBannerImage} alt="Banner preview" className="h-20 w-auto rounded-[4px] border border-[#c3c4c7] object-cover bg-[#f0f0f1]" />
                        )}
                        <MegaBannerImagePicker
                          value={item.megaBannerImage}
                          onChange={url => updateNav(idx, { megaBannerImage: url })}
                        />
                      </div>
                      <p className="text-[11px] text-[#646970] mt-1">Recommended: portrait ratio (3:4). Should be high quality.</p>
                    </div>

                    {/* Banner Heading */}
                    <div className="mb-3">
                      <label className="block text-[12px] font-semibold text-[#1d2327] mb-1">Banner Heading</label>
                      <input
                        type="text"
                        value={item.megaBannerHeading || ''}
                        onChange={e => updateNav(idx, { megaBannerHeading: e.target.value })}
                        placeholder="e.g. New Arrivals"
                        className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-[6px] text-[13px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] bg-white"
                      />
                    </div>

                    {/* Banner Description */}
                    <div>
                      <label className="block text-[12px] font-semibold text-[#1d2327] mb-1">Banner Description</label>
                      <textarea
                        rows={2}
                        value={item.megaBannerDesc || ''}
                        onChange={e => updateNav(idx, { megaBannerDesc: e.target.value })}
                        placeholder="e.g. Explore our latest collection of premium shearling jackets."
                        className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-[6px] text-[13px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] bg-white resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dropdown Category List Builder */}
              {item.type === 'dropdown_category' && (
                <div className="border-t border-[#c3c4c7] bg-[#fbfbfc] p-4 pl-8">
                  <h4 className="text-[11px] font-bold text-[#1d2327] uppercase tracking-wider mb-3">Dropdown Categories</h4>
                  <p className="text-[11px] text-[#646970] mb-3">Select which categories appear inside the dropdown list for this item.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-2">
                    {dbCategories.map(cat => {
                      const selectedIds = item.dropdownCategoryIds || [];
                      const selected = selectedIds.includes(cat.slug);
                      return (
                        <label key={cat.slug} className={`flex items-center gap-2.5 p-2.5 border rounded-[3px] cursor-pointer transition-colors text-[12px] ${selected ? 'border-[#2271b1] bg-[#f0f6fb]' : 'border-[#c3c4c7] hover:bg-[#f6f7f7]'}`}>
                          <input type="checkbox" checked={selected} onChange={() => {
                            const updated = selected ? selectedIds.filter(s => s !== cat.slug) : [...selectedIds, cat.slug];
                            updateNav(idx, { dropdownCategoryIds: updated });
                          }} />
                          <span className="font-medium text-[#1d2327] truncate">{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dropdown Product List Builder */}
              {item.type === 'dropdown_product' && (
                <div className="border-t border-[#c3c4c7] bg-[#fbfbfc] p-4 pl-8">
                  <h4 className="text-[11px] font-bold text-[#1d2327] uppercase tracking-wider mb-3">Dropdown Products</h4>
                  <p className="text-[11px] text-[#646970] mb-3">Select which products appear inside the dropdown list for this item.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                    {dbProducts.map(prod => {
                      const selectedIds = item.dropdownProductIds || [];
                      const selected = selectedIds.includes(prod._id);
                      return (
                        <label key={prod._id} className={`flex items-center gap-2.5 p-2.5 border rounded-[3px] cursor-pointer transition-colors text-[12px] ${selected ? 'border-[#2271b1] bg-[#f0f6fb]' : 'border-[#c3c4c7] hover:bg-[#f6f7f7]'}`}>
                          <input type="checkbox" checked={selected} onChange={() => {
                            const updated = selected ? selectedIds.filter(s => s !== prod._id) : [...selectedIds, prod._id];
                            updateNav(idx, { dropdownProductIds: updated });
                          }} />
                          <span className="font-medium text-[#1d2327] truncate">{prod.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB: Footer — Dynamic Column Builder
   ════════════════════════════════════════════════════════════ */

const COLUMN_TYPES = [
  { value: 'newsletter',   label: 'Newsletter' },
  { value: 'collections',  label: 'Collections' },
  { value: 'blog_posts',   label: 'Blog Posts' },
  { value: 'pages',        label: 'Pages' },
  { value: 'custom_links', label: 'Custom Links' },
];

function ColumnEditor({ col, idx, total, dbCategories, dbBlogs, dbPages, onChange, onDelete, onMove }) {
  const [expanded, setExpanded] = useState(true);

  const addCustomLink = () => onChange({ customLinks: [...(col.customLinks || []), { id: generateId(), label: '', url: '', order: (col.customLinks||[]).length }] });
  const updateCustomLink = (li, u) => onChange({ customLinks: (col.customLinks||[]).map((l,i) => i===li ? {...l,...u} : l) });
  const removeCustomLink = (li) => onChange({ customLinks: (col.customLinks||[]).filter((_,i) => i!==li).map((l,i) => ({...l,order:i})) });

  const toggleCat   = (slug) => { const ids = col.categoryIds||[]; onChange({ categoryIds: ids.includes(slug) ? ids.filter(s=>s!==slug) : [...ids,slug] }); };
  const toggleBlog  = (id)   => { const ids = col.blogIds||[];     onChange({ blogIds:     ids.includes(id)   ? ids.filter(s=>s!==id)   : [...ids,id]   }); };
  const togglePage  = (id)   => { const ids = col.pageIds||[];     onChange({ pageIds:     ids.includes(id)   ? ids.filter(s=>s!==id)   : [...ids,id]   }); };

  return (
    <div className="bg-white border border-[#c3c4c7] rounded-[3px] overflow-hidden">
      {/* Column Card Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#f6f7f7] border-b border-[#c3c4c7]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-[#646970] uppercase tracking-wider">Col {idx+1}</span>
          <input
            className={`${inputClass} w-48 text-[13px] font-semibold`}
            value={col.heading}
            onChange={e => onChange({ heading: e.target.value })}
            placeholder="Column Heading"
          />
          <select
            className={`${inputClass} w-40 text-[12px]`}
            value={col.type}
            onChange={e => onChange({ type: e.target.value })}
          >
            {COLUMN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={idx===0} onClick={() => onMove(idx, -1)}
            className="p-1.5 rounded-[3px] text-[#646970] hover:bg-[#e5e5e5] disabled:opacity-30 transition-colors" title="Move Up">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" disabled={idx===total-1} onClick={() => onMove(idx, 1)}
            className="p-1.5 rounded-[3px] text-[#646970] hover:bg-[#e5e5e5] disabled:opacity-30 transition-colors" title="Move Down">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-[3px] text-[#646970] hover:bg-[#e5e5e5] transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button type="button" onClick={onDelete}
            className="p-1.5 rounded-[3px] text-[#d63638] hover:bg-red-50 transition-colors" title="Remove Column">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Column Body */}
      {expanded && (
        <div className="p-4">

          {/* Newsletter */}
          {col.type === 'newsletter' && (
            <p className="text-[12px] text-[#646970] italic">Newsletter signup form will render in this column. Customize the heading above — email input and submit are automatic.</p>
          )}

          {/* Collections */}
          {col.type === 'collections' && (
            <div>
              <p className="text-[12px] text-[#646970] mb-3">Select which categories appear in this column.</p>
              {dbCategories.length === 0
                ? <p className="text-[12px] text-[#646970] italic">No published categories found.</p>
                : <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {dbCategories.map(cat => {
                      const selected = (col.categoryIds||[]).includes(cat.slug);
                      return (
                        <label key={cat.slug} className={`flex items-center gap-2 p-2.5 border rounded-[3px] cursor-pointer text-[12px] ${selected ? 'border-[#2271b1] bg-[#f0f6fb]' : 'border-[#c3c4c7] hover:bg-[#f6f7f7]'}`}>
                          <input type="checkbox" checked={selected} onChange={() => toggleCat(cat.slug)} />
                          <span className="font-medium text-[#1d2327]">{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
              }
            </div>
          )}

          {/* Blog Posts */}
          {col.type === 'blog_posts' && (
            <div>
              <p className="text-[12px] text-[#646970] mb-3">Select which blog posts appear in this column.</p>
              {dbBlogs.length === 0
                ? <p className="text-[12px] text-[#646970] italic">No published blog posts found.</p>
                : <div className="max-h-48 overflow-y-auto border border-[#c3c4c7] rounded-[3px] divide-y divide-[#f0f0f1]">
                    {dbBlogs.map(blog => {
                      const id = blog._id?.toString();
                      const selected = (col.blogIds||[]).includes(id);
                      return (
                        <label key={id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-[12px] transition-colors ${selected ? 'bg-[#f0f6fb]' : 'hover:bg-[#f6f7f7]'}`}>
                          <input type="checkbox" checked={selected} onChange={() => toggleBlog(id)} />
                          <span className="text-[#1d2327] truncate">{blog.title}</span>
                        </label>
                      );
                    })}
                  </div>
              }
            </div>
          )}

          {/* Pages */}
          {col.type === 'pages' && (
            <div>
              <p className="text-[12px] text-[#646970] mb-3">Select which pages appear in this column.</p>
              {dbPages.length === 0
                ? <p className="text-[12px] text-[#646970] italic">No published pages found.</p>
                : <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {dbPages.map(page => {
                      const id = page._id?.toString();
                      const selected = (col.pageIds||[]).includes(id);
                      return (
                        <label key={id} className={`flex items-center gap-2 p-2.5 border rounded-[3px] cursor-pointer text-[12px] ${selected ? 'border-[#2271b1] bg-[#f0f6fb]' : 'border-[#c3c4c7] hover:bg-[#f6f7f7]'}`}>
                          <input type="checkbox" checked={selected} onChange={() => togglePage(id)} />
                          <span className="font-medium text-[#1d2327]">{page.title || page.slug}</span>
                        </label>
                      );
                    })}
                  </div>
              }
            </div>
          )}

          {/* Custom Links */}
          {col.type === 'custom_links' && (
            <div className="space-y-2">
              {(col.customLinks||[]).length === 0 && <p className="text-[12px] text-[#646970] italic">No links yet. Add one below.</p>}
              {(col.customLinks||[]).map((link, li) => (
                <div key={link.id||li} className="flex gap-2 items-center">
                  <input className={`${inputClass} flex-1`} value={link.label} onChange={e => updateCustomLink(li, { label: e.target.value })} placeholder="Label" />
                  <input className={`${inputClass} flex-1`} value={link.url}   onChange={e => updateCustomLink(li, { url:   e.target.value })} placeholder="/url or https://..." />
                  <button type="button" onClick={() => removeCustomLink(li)} className="p-1 text-[#d63638] hover:bg-red-50 rounded-[3px]"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button type="button" onClick={addCustomLink} className="text-[#2271b1] text-[12px] font-medium hover:underline flex items-center gap-1 mt-1">
                <Plus className="w-3 h-3" /> Add Link
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function FooterTab({ config, onChange, dbCategories, dbBlogs, dbPages }) {
  const fc = config.footerConfig || {};
  const setFc = (u) => onChange({ ...config, footerConfig: { ...fc, ...u } });

  const columns = (fc.footerColumns || []).slice().sort((a,b) => (a.order||0)-(b.order||0));

  const addColumn = () => {
    const newCol = { id: generateId(), type: 'custom_links', heading: 'New Column', order: columns.length, categoryIds: [], blogIds: [], pageIds: [], customLinks: [] };
    setFc({ footerColumns: [...columns, newCol] });
  };

  const updateColumn = (idx, u) => {
    const updated = columns.map((c,i) => i===idx ? {...c,...u} : c);
    setFc({ footerColumns: updated });
  };

  const deleteColumn = (idx) => {
    const updated = columns.filter((_,i) => i!==idx).map((c,i) => ({...c, order:i}));
    setFc({ footerColumns: updated });
  };

  const moveColumn = (idx, dir) => {
    const arr = [...columns];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setFc({ footerColumns: arr.map((c,i) => ({...c, order:i})) });
  };

  return (
    <div className="space-y-6">

      {/* Footer Logo */}
      <div className="bg-white border border-[#c3c4c7] rounded-[3px]">
        <h3 className="px-4 py-3 bg-[#f6f7f7] border-b border-[#c3c4c7] text-[13px] font-bold text-[#1d2327]">Footer Logo</h3>
        <table className="w-full"><tbody>
          <ImagePicker label="Logo" description="Displayed at the top of the footer." value={fc.logoUrl} onChange={v => setFc({ logoUrl: v })} />
        </tbody></table>
      </div>

      {/* Dynamic Columns */}
      <div className="bg-white border border-[#c3c4c7] rounded-[3px]">
        <div className="flex items-center justify-between px-4 py-3 bg-[#f6f7f7] border-b border-[#c3c4c7]">
          <div>
            <h3 className="text-[13px] font-bold text-[#1d2327]">Footer Columns</h3>
            <p className="text-[11px] text-[#646970] mt-0.5">Add, remove and reorder columns. Each can show a newsletter, collections, blog posts, pages or custom links.</p>
          </div>
          <button type="button" onClick={addColumn}
            className="flex items-center gap-1.5 bg-[#2271b1] text-white px-3 py-[6px] text-[12px] font-semibold rounded-[3px] hover:bg-[#135e96] transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Column
          </button>
        </div>
        <div className="p-4 space-y-4">
          {columns.length === 0 && (
            <div className="text-center py-8 border border-dashed border-[#c3c4c7] rounded-[3px]">
              <p className="text-[13px] text-[#646970] mb-3">No columns yet. Click <strong>Add Column</strong> to start building your footer.</p>
              <p className="text-[11px] text-[#646970]">Tip: The footer will fall back to the default 4-column layout until you add at least one column here.</p>
            </div>
          )}
          {columns.map((col, idx) => (
            <ColumnEditor
              key={col.id||idx}
              col={col}
              idx={idx}
              total={columns.length}
              dbCategories={dbCategories}
              dbBlogs={dbBlogs}
              dbPages={dbPages}
              onChange={u => updateColumn(idx, u)}
              onDelete={() => deleteColumn(idx)}
              onMove={(i, dir) => moveColumn(i, dir)}
            />
          ))}
        </div>
      </div>

      {/* Privacy & Terms Page Links */}
      <div className="bg-white border border-[#c3c4c7] rounded-[3px]">
        <h3 className="px-4 py-3 bg-[#f6f7f7] border-b border-[#c3c4c7] text-[13px] font-bold text-[#1d2327]">Privacy & Terms Links</h3>
        <p className="px-4 pt-3 text-[12px] text-[#646970]">
          Select which published page should open when a visitor clicks the Privacy or Terms link in the footer.
          Create your pages first under <strong>Pages → Add New</strong>.
        </p>
        <table className="w-full mt-2">
          <tbody>
            <tr className="border-b border-[#f0f0f1]">
              <th className="text-left px-4 py-3 align-top w-52">
                <label className="block text-[13px] font-semibold text-[#1d2327] mb-[2px]">Privacy Policy Page</label>
                <p className="text-[12px] text-[#646970]">Footer &ldquo;Privacy&rdquo; link target</p>
              </th>
              <td className="px-4 py-3">
                <select
                  value={fc.privacyPageSlug || ""}
                  onChange={e => setFc({ privacyPageSlug: e.target.value })}
                  className="w-full max-w-sm border border-[#8c8f94] rounded-[3px] px-3 py-[6px] text-[13px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] bg-white"
                >
                  <option value="">— None selected —</option>
                  {(dbPages || []).map(p => (
                    <option key={p._id || p.slug} value={p.slug}>{p.title} ({p.slug})</option>
                  ))}
                </select>
                {fc.privacyPageSlug && (
                  <p className="text-[11px] text-[#2271b1] mt-1">
                    Link will go to: <strong>/{fc.privacyPageSlug}</strong>
                  </p>
                )}
              </td>
            </tr>
            <tr>
              <th className="text-left px-4 py-3 align-top w-52">
                <label className="block text-[13px] font-semibold text-[#1d2327] mb-[2px]">Terms of Service Page</label>
                <p className="text-[12px] text-[#646970]">Footer &ldquo;Terms&rdquo; link target</p>
              </th>
              <td className="px-4 py-3">
                <select
                  value={fc.termsPageSlug || ""}
                  onChange={e => setFc({ termsPageSlug: e.target.value })}
                  className="w-full max-w-sm border border-[#8c8f94] rounded-[3px] px-3 py-[6px] text-[13px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] bg-white"
                >
                  <option value="">— None selected —</option>
                  {(dbPages || []).map(p => (
                    <option key={p._id || p.slug} value={p.slug}>{p.title} ({p.slug})</option>
                  ))}
                </select>
                {fc.termsPageSlug && (
                  <p className="text-[11px] text-[#2271b1] mt-1">
                    Link will go to: <strong>/{fc.termsPageSlug}</strong>
                  </p>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   TAB: Social Links
   ═══════════════════════════════════════════════════════════════ */
function SocialLinksTab({ config, onChange }) {
  const socialLinks = config.socialLinks || SOCIALS.map(p => ({ platform: p.key, url: '', enabled: false }));
  const get = (platform) => socialLinks.find(s => s.platform === platform) || { platform, url: '', enabled: false };
  const set = (platform, u) => {
    const existing = socialLinks.find(s => s.platform === platform);
    const updated = existing
      ? socialLinks.map(s => s.platform === platform ? { ...s, ...u } : s)
      : [...socialLinks, { platform, url: '', enabled: false, ...u }];
    onChange({ ...config, socialLinks: updated });
  };

  return (
    <div className="bg-white border border-[#c3c4c7] rounded-[3px]">
      <h3 className="px-4 py-3 bg-[#f6f7f7] border-b border-[#c3c4c7] text-[13px] font-bold text-[#1d2327]">Social Media Profiles</h3>
      <p className="px-4 pt-3 text-[12px] text-[#646970]">Enter your social media URLs. Enable them to show in the footer.</p>
      <table className="w-full mt-2"><tbody>
        {SOCIALS.map(({ key, label, Icon }) => {
          const link = get(key);
          return (
            <tr key={key} className="border-b border-[#f0f0f1]">
              <th className="text-left px-4 py-3 w-44">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1d2327]">
                  <Icon className="w-4 h-4 text-[#646970]" /> {label}
                </div>
              </th>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <input className={`${inputClass} flex-1`} value={link.url} onChange={e => set(key, { url: e.target.value })} placeholder={`https://${key}.com/yourprofile`} />
                  <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-[12px]">
                    <input type="checkbox" checked={link.enabled || false} onChange={() => set(key, { enabled: !link.enabled })} />
                    <span className={link.enabled ? 'text-green-700 font-bold' : 'text-[#646970]'}>{link.enabled ? 'Active' : 'Inactive'}</span>
                  </label>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody></table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
const TABS = [
  { key: 'general', label: 'General', Icon: Globe },
  { key: 'header', label: 'Header', Icon: Layout },
  { key: 'footer', label: 'Footer', Icon: AlignLeft },
  { key: 'social', label: 'Social Links', Icon: Share2 },
];

export default function SiteSettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState('general');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbPages, setDbPages] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [dbProducts, setDbProducts] = useState([]);
  const [dbBlogs, setDbBlogs] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, pRes, cRes, bRes, prRes] = await Promise.all([
          fetch('/api/admin/site-settings'),
          fetch('/api/admin/pages'),
          fetch('/api/admin/categories'),
          fetch('/api/admin/blogs'),
          fetch('/api/admin/products'),
        ]);
        if (sRes.ok) setConfig(await sRes.json());
        if (pRes.ok) { const d = await pRes.json(); setDbPages(Array.isArray(d) ? d.filter(p => p.status === 'Published') : []); }
        if (cRes.ok) { const d = await cRes.json(); setDbCategories(Array.isArray(d) ? d.filter(c => c.type === 'product') : []); }
        if (bRes.ok) { const d = await bRes.json(); setDbBlogs(Array.isArray(d) ? d.filter(b => b.status === 'Published') : []); }
        if (prRes.ok) { const d = await prRes.json(); setDbProducts(Array.isArray(d) ? d.filter(p => p.status === 'Published') : (d?.products || [])); }
      } catch { toast.error("Failed to load settings."); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
      });
      if (res.ok) {
        setConfig(await res.json());
        toast.success("Settings saved successfully.");
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(`Save failed: ${err.error || 'Unknown error'}`);
      }
    } catch { toast.error("Failed to save."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-10 text-center text-[13px] text-[#646970] bg-[#f0f0f1] min-h-screen flex items-center justify-center"><p>Loading Settings...</p></div>;
  if (!config) return <div className="p-10 text-center text-[13px] text-[#d63638] bg-[#f0f0f1] min-h-screen">Failed to load settings.</div>;

  return (
    <AdminPageLayout title="Site Settings" breadcrumbs={[{ label: "Settings" }, { label: "Site Settings" }]}>
      {/* WP-style sub-navigation tabs */}
      <nav className="flex gap-0 border-b border-[#c3c4c7] mb-6 -mt-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-[13px] font-semibold border-b-[3px] transition-colors ${
              tab === key
                ? 'border-[#2271b1] text-[#1d2327]'
                : 'border-transparent text-[#646970] hover:text-[#135e96]'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="pb-20">
        {tab === 'general' && <GeneralTab config={config} onChange={setConfig} />}
        {tab === 'header' && <HeaderTab config={config} onChange={setConfig} dbPages={dbPages} dbCategories={dbCategories} dbProducts={dbProducts} />}
        {tab === 'footer' && <FooterTab config={config} onChange={setConfig} dbCategories={dbCategories} dbBlogs={dbBlogs} dbPages={dbPages} />}
        {tab === 'social' && <SocialLinksTab config={config} onChange={setConfig} />}
      </div>

      {/* WordPress-style sticky publish bar */}
      <div className="fixed bottom-0 left-[160px] right-0 z-40 bg-white border-t border-[#c3c4c7] px-6 py-3 flex items-center justify-between">
        <p className="text-[12px] text-[#646970]">Changes apply immediately after saving.</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-[#2271b1] text-white px-5 py-[6px] text-[13px] font-semibold rounded-[3px] hover:bg-[#135e96] disabled:opacity-60 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </AdminPageLayout>
  );
}
