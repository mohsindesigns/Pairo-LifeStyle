"use client";

import { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  Globe, Share2, Plus, X, Eye, EyeOff,
  Camera, MessageSquare, Link2, Users, ChevronDown, ChevronUp,
} from "lucide-react";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import PopupTab from "@/components/admin/settings/PopupTab";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader, Postbox, Notice, Skeleton } from "@/components/admin/ui";

const generateId = () => Math.random().toString(36).substring(2, 11);

/* Presentational helpers (classes only) */
const ctrlWrap = { flex: "1 1 320px", minWidth: 0 };
const iconBtn = "inline-flex items-center justify-center w-[30px] h-[30px] max-[782px]:w-10 max-[782px]:h-10 rounded-[3px] text-[#646970] hover:text-[#1d2327] hover:bg-[#f0f0f1] disabled:opacity-30 disabled:cursor-default shrink-0";
const okIconBtn = "inline-flex items-center justify-center w-[30px] h-[30px] max-[782px]:w-10 max-[782px]:h-10 rounded-[3px] text-[#2f6f1a] hover:bg-[#f0f0f1] shrink-0";
const dangerIconBtn = "inline-flex items-center justify-center w-[30px] h-[30px] max-[782px]:w-10 max-[782px]:h-10 rounded-[3px] text-[#b32d2e] hover:bg-[#fcf0f1] shrink-0";
const linkBtn = "inline-flex items-center gap-1 min-h-[30px] max-[782px]:min-h-10 text-[#2271b1] hover:text-[#135e96] hover:underline";
const dangerLinkBtn = "inline-flex items-center min-h-[30px] max-[782px]:min-h-10 px-1 text-[#b32d2e] hover:underline";

/* ── Media Picker ───────────────────────────────────────────── */
function ImagePicker({ value, onChange, label, description }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  return (
    <>
      <div className="wp-frow">
        <span className="wp-flabel" id={`${uid}-label`}>{label}</span>
        <div className="flex flex-wrap items-center gap-3" style={ctrlWrap}>
          {value && <img src={value} alt="" className="h-12 w-auto border border-[#c3c4c7] rounded-[3px] bg-[#f0f0f1]" />}
          <button type="button" onClick={() => setOpen(true)} className="wp-btn" aria-describedby={`${uid}-label`}>{value ? 'Replace image' : 'Select image'}</button>
          {value && <button type="button" onClick={() => onChange('')} className={dangerLinkBtn} aria-label={`Remove ${label}`}>Remove</button>}
        </div>
        {description && <p className="wp-hint">{description}</p>}
      </div>
      {open && <MediaPickerModal open onClose={() => setOpen(false)} onSelect={(sel) => { onChange(sel.url); setOpen(false); }} title={`Select ${label}`} />}
    </>
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
        className="wp-btn"
      >
        {value ? 'Replace image' : 'Select image'}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className={dangerLinkBtn}
          aria-label="Remove banner image"
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

/* ── Settings row helpers ───────────────────────────────────── */
function TextRow({ label, description, value, onChange, placeholder, textarea }) {
  const uid = useId();
  return (
    <div className="wp-frow">
      <label className="wp-flabel" htmlFor={uid}>{label}</label>
      {textarea ? (
        <div style={ctrlWrap}>
          <textarea id={uid} className="wp-textarea" rows={3} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        </div>
      ) : (
        <input id={uid} className="wp-input" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {description && <p className="wp-hint">{description}</p>}
    </div>
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
  const pm = config.commerce?.paymentMethods || {};
  const setPm = (k, v) => onChange({
    ...config,
    commerce: { ...(config.commerce || {}), paymentMethods: { cardEnabled: true, codEnabled: true, ...pm, [k]: v } }
  });
  const cardEnabled = pm.cardEnabled !== false;
  const codEnabled = pm.codEnabled !== false;
  return (
    <>
      <Postbox title="Site identity">
        <TextRow label="Site Title" value={b.name} onChange={v => set('name', v)} placeholder="Pairo" />
        <ImagePicker label="Favicon" description="Upload a square icon (e.g. 512x512) for the browser tab." value={b.faviconUrl} onChange={v => set('faviconUrl', v)} />
        <TextRow label="Tagline" value={b.tagline} onChange={v => set('tagline', v)} placeholder="Premium Shearling" description="In a few words, explain what this site is about." />
        <TextRow label="Footer Brand Name" value={b.footerBrandName} onChange={v => set('footerBrandName', v)} placeholder="PAiRO" description="Large animated text shown at the bottom of the footer." />
        <TextRow label="Copyright Text" value={b.copyrightText} onChange={v => set('copyrightText', v)} placeholder="PAIRO — ALL RIGHTS RESERVED © 2026." />
      </Postbox>

      <Postbox title="Links and contact">
        <TextRow label="Privacy Policy URL" value={b.privacyUrl} onChange={v => set('privacyUrl', v)} placeholder="/privacy" />
        <TextRow label="Terms of Service URL" value={b.termsUrl} onChange={v => set('termsUrl', v)} placeholder="/terms" />
        <TextRow label="WhatsApp Number" value={b.whatsappNumber} onChange={v => set('whatsappNumber', v)} placeholder="+1234567890" description="Atelier WhatsApp contact number with country code." />
        <TextRow label="WhatsApp Chat URL" value={b.whatsappUrl} onChange={v => set('whatsappUrl', v)} placeholder="https://wa.me/..." description="Direct WhatsApp chat link." />
      </Postbox>

      <Postbox title="Search engines and checkout">
        <div className="wp-frow">
          <span className="wp-flabel">Search engine visibility</span>
          <div style={ctrlWrap}>
            <label className="wp-check" htmlFor="site-noindex">
              <input
                id="site-noindex"
                type="checkbox"
                checked={!!config.disableSearchEngineIndexing}
                onChange={e => onChange({ ...config, disableSearchEngineIndexing: e.target.checked })}
              />
              Disable search indexing
            </label>
          </div>
          <p className="wp-hint">Discourage search engines from indexing this site (applies noindex, nofollow globally).</p>
        </div>
        <fieldset className="wp-frow m-0 border-0 p-0 py-2">
          <legend className="sr-only">Payment Methods</legend>
          <span className="wp-flabel" aria-hidden="true">Payment Methods</span>
          <div style={ctrlWrap}>
            <label className="wp-check" htmlFor="site-pm-card">
              <input
                id="site-pm-card"
                type="checkbox"
                checked={cardEnabled}
                onChange={e => setPm('cardEnabled', e.target.checked)}
                disabled={cardEnabled && !codEnabled}
                className="disabled:cursor-not-allowed disabled:opacity-50"
              />
              Card (Stripe)
            </label>
            <label className="wp-check" htmlFor="site-pm-cod">
              <input
                id="site-pm-cod"
                type="checkbox"
                checked={codEnabled}
                onChange={e => setPm('codEnabled', e.target.checked)}
                disabled={codEnabled && !cardEnabled}
                className="disabled:cursor-not-allowed disabled:opacity-50"
              />
              Cash on Delivery (COD)
            </label>
          </div>
          <p className="wp-hint">Choose which payment methods customers can select at checkout. At least one must stay on.</p>
        </fieldset>
      </Postbox>
    </>
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
    <>
      {/* Logo */}
      <Postbox title="Header logo">
        <ImagePicker label="Logo" description="Upload or select from Media Library." value={hc.logoUrl} onChange={v => setHc({ logoUrl: v })} />
      </Postbox>

      {/* Top Announcement Bar */}
      <Postbox
        title="Announcement bar"
        aside={<button type="button" onClick={addOffer} className="wp-btn"><Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add message</button>}
      >
        <div className="space-y-2">
          {topOffers.length === 0 && <p className="wp-muted m-0">No announcement messages. Click &quot;Add message&quot; to create one.</p>}
          {topOffers.map((msg, i) => (
            <div key={i} className="flex items-center gap-2">
              <label htmlFor={`offer-${i}`} className="sr-only">Announcement message {i + 1}</label>
              <input id={`offer-${i}`} className="wp-input flex-1 min-w-0" value={msg} onChange={e => updateOffer(i, e.target.value)} placeholder="e.g. FREE EXPRESS SHIPPING ON ALL ORDERS" />
              <button type="button" onClick={() => removeOffer(i)} className={dangerIconBtn} aria-label={`Remove announcement message ${i + 1}`}><X className="w-4 h-4" aria-hidden="true" /></button>
            </div>
          ))}
        </div>
      </Postbox>

      {/* Navigation Menu */}
      <Postbox
        title="Navigation menu"
        aside={<button type="button" onClick={addNavItem} className="wp-btn"><Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add menu item</button>}
      >
        <div className="space-y-3">
          {navItems.length === 0 && <p className="wp-muted m-0">No menu items yet. Click &quot;Add menu item&quot; to get started.</p>}
          {navItems.map((item, idx) => {
            const itemName = item.label || '(untitled)';
            const valueIsControl = !['blog_list', 'mega_menu', 'dropdown_product', 'dropdown_category'].includes(item.type);
            const valueLabel = item.type === 'page' ? 'Page' : item.type === 'product' ? 'Product' : item.type === 'product_category' ? 'Category' : ['mega_menu', 'dropdown_product', 'dropdown_category', 'blog_list'].includes(item.type) ? 'Configuration' : 'URL';
            return (
              <div key={item.id || idx} className="border border-[#c3c4c7] bg-white">
                {/* Item header bar */}
                <div className="flex flex-wrap items-center gap-1 px-2 py-1 bg-[#f6f7f7] border-b border-[#dcdcde]">
                  <span className="wp-strong flex-1 min-w-0 truncate px-1">{itemName}</span>
                  <span className="wp-chip wp-small">{item.type?.replace('_', ' ')}</span>
                  <button type="button" onClick={() => moveNav(idx, -1)} disabled={idx === 0} className={iconBtn} aria-label={`Move ${itemName} up`}><ChevronUp className="w-4 h-4" aria-hidden="true" /></button>
                  <button type="button" onClick={() => moveNav(idx, 1)} disabled={idx === navItems.length - 1} className={iconBtn} aria-label={`Move ${itemName} down`}><ChevronDown className="w-4 h-4" aria-hidden="true" /></button>
                  <button type="button" onClick={() => updateNav(idx, { enabled: !item.enabled })} className={item.enabled ? okIconBtn : iconBtn} title={item.enabled ? 'Visible' : 'Hidden'} aria-label={item.enabled ? `${itemName} is visible. Hide it` : `${itemName} is hidden. Show it`} aria-pressed={!!item.enabled}>
                    {item.enabled ? <Eye className="w-4 h-4" aria-hidden="true" /> : <EyeOff className="w-4 h-4" aria-hidden="true" />}
                  </button>
                  <button type="button" onClick={() => removeNav(idx)} className={dangerIconBtn} aria-label={`Remove ${itemName}`}><X className="w-4 h-4" aria-hidden="true" /></button>
                </div>
                {/* Item body */}
                <div className="p-3 grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Label */}
                  <div className="md:col-span-3 min-w-0">
                    <label className="wp-label" htmlFor={`nav-${idx}-label`}>Navigation label</label>
                    <input id={`nav-${idx}-label`} className="wp-input wp-full" value={item.label} onChange={e => updateNav(idx, { label: e.target.value })} placeholder="Menu label" />
                  </div>
                  {/* Type */}
                  <div className="md:col-span-3 min-w-0">
                    <label className="wp-label" htmlFor={`nav-${idx}-type`}>Type</label>
                    <select id={`nav-${idx}-type`} className="wp-select wp-full" value={item.type} onChange={e => updateNav(idx, { type: e.target.value, value: e.target.value === 'blog_list' ? '/blog' : '' })}>
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
                  <div className="md:col-span-4 min-w-0">
                    {valueIsControl
                      ? <label className="wp-label" htmlFor={`nav-${idx}-value`}>{valueLabel}</label>
                      : <span className="wp-label">{valueLabel}</span>}
                    {item.type === 'blog_list' ? (
                      <div className="wp-desc m-0 min-h-[30px] flex items-center">
                        Auto-routes to <code className="ml-1">/blog</code>
                      </div>
                    ) : item.type === 'page' ? (
                      <select id={`nav-${idx}-value`} className="wp-select wp-full" value={item.value} onChange={e => updateNav(idx, { value: e.target.value })}>
                        <option value="">— Select Page —</option>
                        <option value="/blog">Blog List (System Page)</option>
                        {dbPages.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                      </select>
                    ) : item.type === 'product' ? (
                      <select id={`nav-${idx}-value`} className="wp-select wp-full" value={item.value} onChange={e => updateNav(idx, { value: e.target.value })}>
                        <option value="">— Select Product —</option>
                        {dbProducts.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                      </select>
                    ) : item.type === 'product_category' ? (
                      <select id={`nav-${idx}-value`} className="wp-select wp-full" value={item.value} onChange={e => updateNav(idx, { value: e.target.value })}>
                        <option value="">— Select Category —</option>
                        {dbCategories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                      </select>
                    ) : ['mega_menu', 'dropdown_product', 'dropdown_category'].includes(item.type) ? (
                      <div className="wp-desc m-0 min-h-[30px] flex items-center">See options below</div>
                    ) : (
                      <input id={`nav-${idx}-value`} className="wp-input wp-full" value={item.value} onChange={e => updateNav(idx, { value: e.target.value })} placeholder={item.type === 'external_url' ? 'https://...' : '/page-slug'} />
                    )}
                  </div>
                  {/* Options */}
                  <div className="md:col-span-2 flex flex-col justify-end gap-1.5">
                    {(item.type === 'custom_url' || item.type === 'external_url') && (
                      <label className="wp-check" htmlFor={`nav-${idx}-newtab`}>
                        <input id={`nav-${idx}-newtab`} type="checkbox" checked={item.openInNewTab || false} onChange={e => updateNav(idx, { openInNewTab: e.target.checked })} /> Open in new tab
                      </label>
                    )}
                  </div>
                </div>

                {/* Mega Menu Sub-Items Builder */}
                {item.type === 'mega_menu' && (
                  <div className="border-t border-[#dcdcde] bg-[#f6f7f7] p-3 sm:p-4 space-y-5">

                    {/* Label Link */}
                    <div>
                      <label className="wp-label" htmlFor={`nav-${idx}-labelhref`}>Label link URL</label>
                      <input
                        id={`nav-${idx}-labelhref`}
                        type="text"
                        value={item.labelHref || ''}
                        onChange={e => updateNav(idx, { labelHref: e.target.value })}
                        placeholder="e.g. /shop or /collections/all"
                        className="wp-input wp-full max-w-sm"
                        aria-describedby={`nav-${idx}-labelhref-desc`}
                      />
                      <p className="wp-desc" id={`nav-${idx}-labelhref-desc`}>Optional. Makes the mega menu label itself a clickable link (e.g. <code>/shop</code> or <code>/collections/all</code>).</p>
                    </div>

                    {/* Category Selection */}
                    <fieldset className="m-0 border-0 p-0">
                      <legend className="wp-label">Mega menu featured categories</legend>
                      <p className="wp-desc mt-0 mb-2">Select which categories appear inside the mega menu dropdown for this item.</p>
                      <div className="wp-checklist grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4">
                        {dbCategories.map(cat => {
                          const megaIds = item.megaCategoryIds || [];
                          const selected = megaIds.includes(cat.slug);
                          return (
                            <label key={cat.slug} className="wp-check min-w-0">
                              <input type="checkbox" checked={selected} onChange={() => {
                                const updated = selected ? megaIds.filter(s => s !== cat.slug) : [...megaIds, cat.slug];
                                updateNav(idx, { megaCategoryIds: updated });
                              }} />
                              {cat.image && <img src={cat.image} alt="" className="w-6 h-6 rounded-[2px] object-cover shrink-0" />}
                              <span className="truncate">{cat.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      {dbCategories.length === 0 && <p className="wp-desc">No categories found.</p>}
                    </fieldset>

                    {/* Promotional Banner */}
                    <div className="border-t border-[#dcdcde] pt-4">
                      <h3 className="wp-strong m-0">Promotional banner</h3>
                      <p className="wp-desc mt-1 mb-3">This banner fills the right side of the mega menu. On hover over a category, it crossfades to that category&apos;s image.</p>

                      {/* Banner Image */}
                      <div className="wp-field">
                        <span className="wp-label">Banner image</span>
                        <div className="flex items-center gap-3 flex-wrap">
                          {item.megaBannerImage && (
                            <img src={item.megaBannerImage} alt="Banner preview" className="h-20 w-auto border border-[#c3c4c7] object-cover bg-[#f0f0f1]" />
                          )}
                          <MegaBannerImagePicker
                            value={item.megaBannerImage}
                            onChange={url => updateNav(idx, { megaBannerImage: url })}
                          />
                        </div>
                        <p className="wp-desc">Recommended: portrait ratio (3:4). Should be high quality.</p>
                      </div>

                      {/* Banner Heading */}
                      <div className="wp-field">
                        <label className="wp-label" htmlFor={`nav-${idx}-bheading`}>Banner heading</label>
                        <input
                          id={`nav-${idx}-bheading`}
                          type="text"
                          value={item.megaBannerHeading || ''}
                          onChange={e => updateNav(idx, { megaBannerHeading: e.target.value })}
                          placeholder="e.g. New Arrivals"
                          className="wp-input wp-full"
                        />
                      </div>

                      {/* Banner Description */}
                      <div className="mb-0">
                        <label className="wp-label" htmlFor={`nav-${idx}-bdesc`}>Banner description</label>
                        <textarea
                          id={`nav-${idx}-bdesc`}
                          rows={2}
                          value={item.megaBannerDesc || ''}
                          onChange={e => updateNav(idx, { megaBannerDesc: e.target.value })}
                          placeholder="e.g. Explore our latest collection of premium shearling jackets."
                          className="wp-textarea"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Dropdown Category List Builder */}
                {item.type === 'dropdown_category' && (
                  <div className="border-t border-[#dcdcde] bg-[#f6f7f7] p-3 sm:p-4"><fieldset className="m-0 border-0 p-0">
                    <legend className="sr-only">Dropdown categories</legend>
                    <h3 className="wp-strong m-0" aria-hidden="true">Dropdown categories</h3>
                    <p className="wp-desc mt-1 mb-2">Select which categories appear inside the dropdown list for this item.</p>
                    <div className="wp-checklist grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4">
                      {dbCategories.map(cat => {
                        const selectedIds = item.dropdownCategoryIds || [];
                        const selected = selectedIds.includes(cat.slug);
                        return (
                          <label key={cat.slug} className="wp-check min-w-0">
                            <input type="checkbox" checked={selected} onChange={() => {
                              const updated = selected ? selectedIds.filter(s => s !== cat.slug) : [...selectedIds, cat.slug];
                              updateNav(idx, { dropdownCategoryIds: updated });
                            }} />
                            <span className="truncate">{cat.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset></div>
                )}

                {/* Dropdown Product List Builder */}
                {item.type === 'dropdown_product' && (
                  <div className="border-t border-[#dcdcde] bg-[#f6f7f7] p-3 sm:p-4"><fieldset className="m-0 border-0 p-0">
                    <legend className="sr-only">Dropdown products</legend>
                    <h3 className="wp-strong m-0" aria-hidden="true">Dropdown products</h3>
                    <p className="wp-desc mt-1 mb-2">Select which products appear inside the dropdown list for this item.</p>
                    <div className="wp-checklist grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                      {dbProducts.map(prod => {
                        const selectedIds = item.dropdownProductIds || [];
                        const selected = selectedIds.includes(prod._id);
                        return (
                          <label key={prod._id} className="wp-check min-w-0">
                            <input type="checkbox" checked={selected} onChange={() => {
                              const updated = selected ? selectedIds.filter(s => s !== prod._id) : [...selectedIds, prod._id];
                              updateNav(idx, { dropdownProductIds: updated });
                            }} />
                            <span className="truncate">{prod.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset></div>
                )}

              </div>
            );
          })}
        </div>
      </Postbox>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB: Footer — Dynamic Column Builder
   ════════════════════════════════════════════════════════════ */

const COLUMN_TYPES = [
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'collections', label: 'Collections' },
  { value: 'blog_posts', label: 'Blog Posts' },
  { value: 'pages', label: 'Pages' },
  { value: 'custom_links', label: 'Custom Links' },
];

function ColumnEditor({ col, idx, total, dbCategories, dbBlogs, dbPages, onChange, onDelete, onMove }) {
  const [expanded, setExpanded] = useState(true);

  const addCustomLink = () => onChange({ customLinks: [...(col.customLinks || []), { id: generateId(), label: '', url: '', order: (col.customLinks || []).length }] });
  const updateCustomLink = (li, u) => onChange({ customLinks: (col.customLinks || []).map((l, i) => i === li ? { ...l, ...u } : l) });
  const removeCustomLink = (li) => onChange({ customLinks: (col.customLinks || []).filter((_, i) => i !== li).map((l, i) => ({ ...l, order: i })) });

  const toggleCat = (slug) => { const ids = col.categoryIds || []; onChange({ categoryIds: ids.includes(slug) ? ids.filter(s => s !== slug) : [...ids, slug] }); };
  const toggleBlog = (id) => { const ids = col.blogIds || []; onChange({ blogIds: ids.includes(id) ? ids.filter(s => s !== id) : [...ids, id] }); };
  const togglePage = (id) => { const ids = col.pageIds || []; onChange({ pageIds: ids.includes(id) ? ids.filter(s => s !== id) : [...ids, id] }); };

  const colName = `Column ${idx + 1}`;
  const bodyId = `footer-col-${idx}-body`;

  return (
    <div className="border border-[#c3c4c7] bg-white">
      {/* Column Card Header */}
      <div className="flex flex-wrap items-center gap-2 px-2 py-2 bg-[#f6f7f7] border-b border-[#dcdcde]">
        <span className="wp-strong shrink-0 px-1">{colName}</span>
        <label htmlFor={`footer-col-${idx}-heading`} className="sr-only">{colName} heading</label>
        <input
          id={`footer-col-${idx}-heading`}
          className="wp-input min-w-0 flex-[1_1_160px] max-w-[240px] max-[782px]:max-w-none"
          value={col.heading}
          onChange={e => onChange({ heading: e.target.value })}
          placeholder="Column Heading"
        />
        <label htmlFor={`footer-col-${idx}-type`} className="sr-only">{colName} type</label>
        <select
          id={`footer-col-${idx}-type`}
          className="wp-select min-w-0 flex-[1_1_140px] max-w-[200px] max-[782px]:max-w-none"
          value={col.type}
          onChange={e => onChange({ type: e.target.value })}
        >
          {COLUMN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <span className="flex-1" />
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" disabled={idx === 0} onClick={() => onMove(idx, -1)}
            className={iconBtn} title="Move Up" aria-label={`Move ${colName} up`}>
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          </button>
          <button type="button" disabled={idx === total - 1} onClick={() => onMove(idx, 1)}
            className={iconBtn} title="Move Down" aria-label={`Move ${colName} down`}>
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setExpanded(v => !v)}
            className={iconBtn} aria-expanded={expanded} aria-controls={bodyId} aria-label={expanded ? `Collapse ${colName}` : `Expand ${colName}`}>
            {expanded ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
          </button>
          <button type="button" onClick={onDelete}
            className={dangerIconBtn} title="Remove Column" aria-label={`Remove ${colName}`}>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Column Body */}
      {expanded && (
        <div className="p-3" id={bodyId}>

          {/* Newsletter */}
          {col.type === 'newsletter' && (
            <p className="wp-muted m-0">Newsletter signup form will render in this column. Customize the heading above — email input and submit are automatic.</p>
          )}

          {/* Collections */}
          {col.type === 'collections' && (
            <fieldset className="m-0 border-0 p-0">
              <legend className="wp-desc mt-0 mb-2">Select which categories appear in this column.</legend>
              {dbCategories.length === 0
                ? <p className="wp-muted m-0">No published categories found.</p>
                : <div className="wp-checklist grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  {dbCategories.map(cat => {
                    const selected = (col.categoryIds || []).includes(cat.slug);
                    return (
                      <label key={cat.slug} className="wp-check min-w-0">
                        <input type="checkbox" checked={selected} onChange={() => toggleCat(cat.slug)} />
                        <span className="truncate">{cat.name}</span>
                      </label>
                    );
                  })}
                </div>
              }
            </fieldset>
          )}

          {/* Blog Posts */}
          {col.type === 'blog_posts' && (
            <fieldset className="m-0 border-0 p-0">
              <legend className="wp-desc mt-0 mb-2">Select which blog posts appear in this column.</legend>
              {dbBlogs.length === 0
                ? <p className="wp-muted m-0">No published blog posts found.</p>
                : <div className="wp-checklist">
                  {dbBlogs.map(blog => {
                    const id = blog._id?.toString();
                    const selected = (col.blogIds || []).includes(id);
                    return (
                      <label key={id} className="wp-check min-w-0">
                        <input type="checkbox" checked={selected} onChange={() => toggleBlog(id)} />
                        <span className="truncate">{blog.title}</span>
                      </label>
                    );
                  })}
                </div>
              }
            </fieldset>
          )}

          {/* Pages */}
          {col.type === 'pages' && (
            <fieldset className="m-0 border-0 p-0">
              <legend className="wp-desc mt-0 mb-2">Select which pages appear in this column.</legend>
              {dbPages.length === 0
                ? <p className="wp-muted m-0">No published pages found.</p>
                : <div className="wp-checklist grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  {dbPages.map(page => {
                    const id = page._id?.toString();
                    const selected = (col.pageIds || []).includes(id);
                    return (
                      <label key={id} className="wp-check min-w-0">
                        <input type="checkbox" checked={selected} onChange={() => togglePage(id)} />
                        <span className="truncate">{page.title || page.slug}</span>
                      </label>
                    );
                  })}
                </div>
              }
            </fieldset>
          )}

          {/* Custom Links */}
          {col.type === 'custom_links' && (
            <div className="space-y-2">
              {(col.customLinks || []).length === 0 && <p className="wp-muted m-0">No links yet. Add one below.</p>}
              {(col.customLinks || []).map((link, li) => (
                <div key={link.id || li} className="flex flex-wrap gap-2 items-center">
                  <label htmlFor={`footer-col-${idx}-link-${li}-label`} className="sr-only">Link {li + 1} label</label>
                  <input id={`footer-col-${idx}-link-${li}-label`} className="wp-input flex-[1_1_160px] min-w-0" value={link.label} onChange={e => updateCustomLink(li, { label: e.target.value })} placeholder="Label" />
                  <label htmlFor={`footer-col-${idx}-link-${li}-url`} className="sr-only">Link {li + 1} URL</label>
                  <input id={`footer-col-${idx}-link-${li}-url`} className="wp-input flex-[1_1_160px] min-w-0" value={link.url} onChange={e => updateCustomLink(li, { url: e.target.value })} placeholder="/url or https://..." />
                  <button type="button" onClick={() => removeCustomLink(li)} className={dangerIconBtn} aria-label={`Remove link ${li + 1}`}><X className="w-4 h-4" aria-hidden="true" /></button>
                </div>
              ))}
              <button type="button" onClick={addCustomLink} className={linkBtn}>
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add link
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

/* One "bottom link" settings row (Privacy / Terms) — markup only */
function BottomLinkFields({ idBase, children }) {
  return <div className="space-y-2" style={ctrlWrap} id={idBase}>{children}</div>;
}

function FooterTab({ config, onChange, dbCategories, dbBlogs, dbPages }) {
  const fc = config.footerConfig || {};
  const setFc = (u) => onChange({ ...config, footerConfig: { ...fc, ...u } });

  const columns = (fc.footerColumns || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  const addColumn = () => {
    const newCol = { id: generateId(), type: 'custom_links', heading: 'New Column', order: columns.length, categoryIds: [], blogIds: [], pageIds: [], customLinks: [] };
    setFc({ footerColumns: [...columns, newCol] });
  };

  const updateColumn = (idx, u) => {
    const updated = columns.map((c, i) => i === idx ? { ...c, ...u } : c);
    setFc({ footerColumns: updated });
  };

  const deleteColumn = (idx) => {
    const updated = columns.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order: i }));
    setFc({ footerColumns: updated });
  };

  const moveColumn = (idx, dir) => {
    const arr = [...columns];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setFc({ footerColumns: arr.map((c, i) => ({ ...c, order: i })) });
  };

  return (
    <>

      {/* Footer Logo */}
      <Postbox title="Footer logo">
        <ImagePicker label="Logo" description="Displayed at the top of the footer." value={fc.logoUrl} onChange={v => setFc({ logoUrl: v })} />
      </Postbox>

      {/* Dynamic Columns */}
      <Postbox
        title="Footer columns"
        aside={<button type="button" onClick={addColumn} className="wp-btn"><Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add column</button>}
      >
        <p className="wp-desc mt-0 mb-3">Add, remove and reorder columns. Each can show a newsletter, collections, blog posts, pages or custom links.</p>
        <div className="space-y-3">
          {columns.length === 0 && (
            <div className="text-center py-8 px-3 border border-dashed border-[#c3c4c7]">
              <p className="wp-muted mt-0 mb-2">No columns yet. Click <strong>Add column</strong> to start building your footer.</p>
              <p className="wp-muted wp-small m-0">Tip: The footer will fall back to the default 4-column layout until you add at least one column here.</p>
            </div>
          )}
          {columns.map((col, idx) => (
            <ColumnEditor
              key={col.id || idx}
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
      </Postbox>

      {/* Privacy, Terms & Sitemap Links */}
      <Postbox title="Footer bottom links (Privacy, Terms, Sitemap)">
        <p className="wp-desc mt-0 mb-2">
          Configure labels, links, and visibility for the links displayed at the bottom of the footer next to the copyright notice.
        </p>

        {/* Privacy Policy Link */}
        <div className="wp-frow items-start">
          <span className="wp-flabel pt-1">Privacy Policy</span>
          <BottomLinkFields idBase="footer-privacy">
            <label className="wp-check" htmlFor="footer-privacy-show">
              <input
                id="footer-privacy-show"
                type="checkbox"
                checked={fc.showPrivacyLink !== false}
                onChange={e => setFc({ showPrivacyLink: e.target.checked })}
              />
              Show in footer
            </label>
            <div>
              <label className="wp-label" htmlFor="footer-privacy-label">Link label</label>
              <input
                id="footer-privacy-label"
                type="text"
                value={fc.privacyLabel ?? "Privacy"}
                onChange={e => setFc({ privacyLabel: e.target.value })}
                placeholder="Link Label (e.g. Privacy Policy)"
                className="wp-input wp-full max-w-[320px]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
              <div className="min-w-0">
                <label className="wp-label" htmlFor="footer-privacy-page">CMS page</label>
                <select
                  id="footer-privacy-page"
                  value={fc.privacyPageSlug || ""}
                  onChange={e => setFc({ privacyPageSlug: e.target.value })}
                  className="wp-select wp-full"
                >
                  <option value="">— None selected —</option>
                  {(dbPages || []).map(p => (
                    <option key={p._id || p.slug} value={p.slug}>{p.title} ({p.slug})</option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="wp-label" htmlFor="footer-privacy-url">Or custom URL (optional)</label>
                <input
                  id="footer-privacy-url"
                  type="text"
                  value={fc.privacyUrl || ""}
                  onChange={e => setFc({ privacyUrl: e.target.value })}
                  placeholder="/privacy or https://..."
                  className="wp-input wp-full"
                />
              </div>
            </div>
          </BottomLinkFields>
          <p className="wp-hint">Label, target page/URL and visibility.</p>
        </div>

        {/* Terms of Service Link */}
        <div className="wp-frow items-start">
          <span className="wp-flabel pt-1">Terms of Service</span>
          <BottomLinkFields idBase="footer-terms">
            <label className="wp-check" htmlFor="footer-terms-show">
              <input
                id="footer-terms-show"
                type="checkbox"
                checked={fc.showTermsLink !== false}
                onChange={e => setFc({ showTermsLink: e.target.checked })}
              />
              Show in footer
            </label>
            <div>
              <label className="wp-label" htmlFor="footer-terms-label">Link label</label>
              <input
                id="footer-terms-label"
                type="text"
                value={fc.termsLabel ?? "Terms"}
                onChange={e => setFc({ termsLabel: e.target.value })}
                placeholder="Link Label (e.g. Terms of Service)"
                className="wp-input wp-full max-w-[320px]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
              <div className="min-w-0">
                <label className="wp-label" htmlFor="footer-terms-page">CMS page</label>
                <select
                  id="footer-terms-page"
                  value={fc.termsPageSlug || ""}
                  onChange={e => setFc({ termsPageSlug: e.target.value })}
                  className="wp-select wp-full"
                >
                  <option value="">— None selected —</option>
                  {(dbPages || []).map(p => (
                    <option key={p._id || p.slug} value={p.slug}>{p.title} ({p.slug})</option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="wp-label" htmlFor="footer-terms-url">Or custom URL (optional)</label>
                <input
                  id="footer-terms-url"
                  type="text"
                  value={fc.termsUrl || ""}
                  onChange={e => setFc({ termsUrl: e.target.value })}
                  placeholder="/terms or https://..."
                  className="wp-input wp-full"
                />
              </div>
            </div>
          </BottomLinkFields>
          <p className="wp-hint">Label, target page/URL and visibility.</p>
        </div>

        {/* Sitemap Link */}
        <div className="wp-frow items-start">
          <span className="wp-flabel pt-1">Sitemap Link</span>
          <BottomLinkFields idBase="footer-sitemap">
            <label className="wp-check" htmlFor="footer-sitemap-show">
              <input
                id="footer-sitemap-show"
                type="checkbox"
                checked={fc.showSitemapLink !== false}
                onChange={e => setFc({ showSitemapLink: e.target.checked })}
              />
              Show in footer
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
              <div className="min-w-0">
                <label className="wp-label" htmlFor="footer-sitemap-label">Link label</label>
                <input
                  id="footer-sitemap-label"
                  type="text"
                  value={fc.sitemapLabel ?? "Sitemap"}
                  onChange={e => setFc({ sitemapLabel: e.target.value })}
                  placeholder="Link Label (e.g. Sitemap)"
                  className="wp-input wp-full"
                />
              </div>
              <div className="min-w-0">
                <label className="wp-label" htmlFor="footer-sitemap-url">URL</label>
                <input
                  id="footer-sitemap-url"
                  type="text"
                  value={fc.sitemapUrl ?? "/sitemap"}
                  onChange={e => setFc({ sitemapUrl: e.target.value })}
                  placeholder="URL (e.g. /sitemap)"
                  className="wp-input wp-full"
                />
              </div>
            </div>
          </BottomLinkFields>
          <p className="wp-hint">Label, URL and visibility.</p>
        </div>

        {/* Copyright & Brand Text */}
        <div className="wp-frow">
          <label className="wp-flabel" htmlFor="footer-copyright">Copyright &amp; Brand Text</label>
          <div style={ctrlWrap}>
            <input
              id="footer-copyright"
              type="text"
              value={config.brand?.copyrightText ?? "PAiRO — ALL RIGHTS RESERVED © 2026."}
              onChange={e => onChange({ ...config, brand: { ...(config.brand || {}), copyrightText: e.target.value } })}
              placeholder="e.g. PAiRO — ALL RIGHTS RESERVED © 2026."
              className="wp-input wp-full max-w-xl"
            />
          </div>
          <p className="wp-hint">Copyright notice in footer.</p>
        </div>
      </Postbox>

    </>
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
    <Postbox title="Social media profiles">
      <p className="wp-desc mt-0 mb-2">Enter your social media URLs. Enable them to show in the footer.</p>
      {SOCIALS.map(({ key, label, Icon }) => {
        const link = get(key);
        return (
          <div key={key} className="wp-frow">
            <label className="wp-flabel inline-flex items-center gap-2" htmlFor={`social-${key}-url`}>
              <Icon className="w-4 h-4 text-[#646970] shrink-0" aria-hidden="true" /> {label}
            </label>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={ctrlWrap}>
              <input id={`social-${key}-url`} className="wp-input flex-[1_1_220px] min-w-0 max-w-[420px]" value={link.url} onChange={e => set(key, { url: e.target.value })} placeholder={`https://${key}.com/yourprofile`} />
              <label className="wp-check whitespace-nowrap" htmlFor={`social-${key}-enabled`}>
                <input id={`social-${key}-enabled`} type="checkbox" checked={link.enabled || false} onChange={() => set(key, { enabled: !link.enabled })} />
                <span className={link.enabled ? 'text-[#2f6f1a] font-semibold' : 'wp-muted'}>{link.enabled ? 'Active' : 'Inactive'}</span>
              </label>
            </div>
          </div>
        );
      })}
    </Postbox>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB: Redirect Manager
   ═══════════════════════════════════════════════════════════════ */
function RedirectsTab() {
  const { showConfirm } = usePopup();
  const [redirects, setRedirects] = useState([]);
  const [totalRedirects, setTotalRedirects] = useState(0);
  const [redirectsPage, setRedirectsPage] = useState(1);
  const [loadingRedirects, setLoadingRedirects] = useState(false);
  const [redirectSearch, setRedirectSearch] = useState("");

  const [redirectForm, setRedirectForm] = useState({
    _id: "",
    sourceUrl: "",
    targetUrl: "",
    statusCode: 301
  });
  const [submittingRedirect, setSubmittingRedirect] = useState(false);
  const [redirectError, setRedirectError] = useState("");

  const fetchRedirects = async () => {
    setLoadingRedirects(true);
    try {
      const params = new URLSearchParams();
      if (redirectSearch) params.set("search", redirectSearch);
      params.set("page", redirectsPage.toString());
      params.set("limit", "10");

      const res = await fetch(`/api/admin/redirects?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRedirects(data.items || []);
        setTotalRedirects(data.total || 0);
      }
    } catch (err) {
      toast.error("Failed to load redirects");
    } finally {
      setLoadingRedirects(false);
    }
  };

  useEffect(() => {
    fetchRedirects();
  }, [redirectsPage, redirectSearch]);

  const handleSaveRedirect = async (e) => {
    e.preventDefault();
    setSubmittingRedirect(true);
    setRedirectError("");
    try {
      const isEdit = !!redirectForm._id;
      const url = "/api/admin/redirects";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(redirectForm)
      });

      const data = await res.json();
      if (res.ok) {
        setRedirectForm({
          _id: "",
          sourceUrl: "",
          targetUrl: "",
          statusCode: 301
        });
        toast.success(isEdit ? "Redirect updated successfully." : "Redirect added successfully.");
        fetchRedirects();
      } else {
        setRedirectError(data.error || "An error occurred.");
      }
    } catch (err) {
      setRedirectError("Failed to save redirect.");
    } finally {
      setSubmittingRedirect(false);
    }
  };

  const handleDeleteRedirect = async (id) => {
    const ok = await showConfirm("Are you sure you want to delete this redirect rule?");
    if (!ok) return;
    try {
      const res = await fetch("/api/admin/redirects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] })
      });
      if (res.ok) {
        toast.success("Redirect deleted.");
        fetchRedirects();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete.");
      }
    } catch (err) {
      toast.error("Delete error.");
    }
  };

  const handleEditRedirect = (item) => {
    setRedirectForm({
      _id: item._id,
      sourceUrl: item.sourceUrl,
      targetUrl: item.targetUrl,
      statusCode: item.statusCode || 301
    });
    setRedirectError("");
  };

  const totalPages = Math.ceil(totalRedirects / 10) || 1;

  return (
    <>
      {/* Add / Edit Form */}
      <form onSubmit={handleSaveRedirect} className="wp-postbox" aria-labelledby="redirect-form-title">
        <div className="wp-postbox-head">
          <h2 id="redirect-form-title">
            {redirectForm._id ? "Edit redirect rule" : "Add new redirect rule"}
          </h2>
        </div>
        <div className="wp-inside">
          {redirectError && (
            <Notice type="error">{redirectError}</Notice>
          )}

          <div className="wp-frow">
            <label className="wp-flabel" htmlFor="redirect-source">Source path</label>
            <input
              id="redirect-source"
              type="text"
              required
              placeholder="/old-page"
              value={redirectForm.sourceUrl}
              onChange={e => setRedirectForm({ ...redirectForm, sourceUrl: e.target.value })}
              className="wp-input"
            />
            <p className="wp-hint">The old URL path to redirect from, e.g. <code>/old-url</code>.</p>
          </div>
          <div className="wp-frow">
            <label className="wp-flabel" htmlFor="redirect-target">Target destination</label>
            <input
              id="redirect-target"
              type="text"
              required
              placeholder="/new-page"
              value={redirectForm.targetUrl}
              onChange={e => setRedirectForm({ ...redirectForm, targetUrl: e.target.value })}
              className="wp-input"
            />
            <p className="wp-hint">Where visitors are sent, e.g. <code>/new-url</code>.</p>
          </div>
          <div className="wp-frow">
            <label className="wp-flabel" htmlFor="redirect-type">Redirect type</label>
            <select
              id="redirect-type"
              value={redirectForm.statusCode}
              onChange={e => setRedirectForm({ ...redirectForm, statusCode: parseInt(e.target.value, 10) })}
              className="wp-select"
            >
              <option value={301}>301 Permanent Redirect</option>
              <option value={302}>302 Temporary Redirect</option>
            </select>
          </div>
        </div>

        <div className="wp-box-foot">
          <button
            type="submit"
            disabled={submittingRedirect}
            className="wp-btn wp-btn-primary"
          >
            {submittingRedirect ? "Saving..." : redirectForm._id ? "Update redirect" : "Add redirect"}
          </button>
          {redirectForm._id && (
            <button
              type="button"
              onClick={() => setRedirectForm({ _id: "", sourceUrl: "", targetUrl: "", statusCode: 301 })}
              className="wp-btn"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      {/* Redirects List Table */}
      <h2 className="text-[16px] font-semibold text-[#1d2327] mt-6 mb-0">
        Redirect rules <span className="wp-muted font-normal">({totalRedirects})</span>
      </h2>
      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <div className="wp-search" role="search">
          <label htmlFor="redirect-search" className="sr-only">Search redirects</label>
          <input
            id="redirect-search"
            type="search"
            placeholder="Search redirects..."
            value={redirectSearch}
            onChange={e => { setRedirectSearch(e.target.value); setRedirectsPage(1); }}
            className="wp-input"
          />
        </div>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th scope="col">Source URL path</th>
              <th scope="col" className="wp-hide-sm">Target destination</th>
              <th scope="col" className="wp-hide-sm" style={{ width: 110 }}>Status code</th>
            </tr>
          </thead>
          <tbody>
            {loadingRedirects ? (
              <tr>
                <td colSpan={3} className="wp-muted text-center" style={{ padding: "32px 10px" }}>
                  Loading redirects...
                </td>
              </tr>
            ) : redirects.length === 0 ? (
              <tr>
                <td colSpan={3} className="wp-muted text-center" style={{ padding: "32px 10px" }}>
                  No redirect rules found.
                </td>
              </tr>
            ) : (
              redirects.map((item) => (
                <tr key={item._id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleEditRedirect(item)}
                      className="wp-row-title font-mono break-all text-left bg-transparent border-0 p-0 cursor-pointer"
                      aria-label={`Edit redirect ${item.sourceUrl}`}
                    >
                      {item.sourceUrl}
                    </button>
                    <div className="wp-mobile-meta">
                      <span className="font-mono break-all">→ {item.targetUrl}</span> · {item.statusCode}
                    </div>
                    <div className="wp-row-actions">
                      <span>
                        <button type="button" onClick={() => handleEditRedirect(item)} aria-label={`Edit redirect ${item.sourceUrl}`}>Edit</button>
                      </span>
                      <span>
                        <button type="button" onClick={() => handleDeleteRedirect(item._id)} className="is-danger" aria-label={`Delete redirect ${item.sourceUrl}`}>Delete</button>
                      </span>
                    </div>
                  </td>
                  <td className="wp-hide-sm font-mono break-all">
                    {item.targetUrl}
                  </td>
                  <td className="wp-hide-sm">
                    <span className={`wp-pill wp-pill-sm ${item.statusCode === 301 ? "wp-st-published" : "wp-st-shipped"}`}>
                      {item.statusCode}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="wp-toolbar">
          <span className="wp-spacer" />
          <div className="wp-pages">
            <span>Page {redirectsPage} of {totalPages}</span>
            <button
              type="button"
              disabled={redirectsPage === 1}
              onClick={() => setRedirectsPage(prev => Math.max(1, prev - 1))}
              className="wp-btn"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={redirectsPage === totalPages}
              onClick={() => setRedirectsPage(prev => Math.min(totalPages, prev + 1))}
              className="wp-btn"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
const TABS = [
  { key: 'general', label: 'General' },
  { key: 'header', label: 'Header' },
  { key: 'footer', label: 'Footer' },
  { key: 'social', label: 'Social Links' },
  { key: 'popup', label: 'Popup' },
  { key: 'redirects', label: 'Redirects' },
];

export default function SiteSettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState(() => {
    if (typeof window !== "undefined") {
      const initialTab = new URLSearchParams(window.location.search).get("tab");
      if (initialTab && TABS.some(t => t.key === initialTab)) {
        return initialTab;
      }
    }
    return 'general';
  });
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

  if (loading) return (
    <Page>
      <PageHeader title="General settings" />
      <div className="wp-postbox wp-inside space-y-3" aria-busy="true">
        <span className="sr-only">Loading settings...</span>
        <Skeleton height={30} width="60%" />
        <Skeleton height={30} width="75%" />
        <Skeleton height={30} width="50%" />
      </div>
    </Page>
  );
  if (!config) return (
    <Page>
      <PageHeader title="General settings" />
      <Notice type="error">Failed to load settings.</Notice>
    </Page>
  );

  return (
    <RequirePermission permission="settings.view">
    <Page>
      <PageHeader title="General settings" />

      {/* WordPress settings tabs */}
      <nav className="wp-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            id={`site-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls="site-tabpanel"
            onClick={() => {
              setTab(key);
              if (typeof window !== "undefined") {
                const url = new URL(window.location);
                url.searchParams.set("tab", key);
                window.history.replaceState({}, "", url);
              }
            }}
            className="wp-tab max-[782px]:min-h-10"
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div id="site-tabpanel" role="tabpanel" aria-labelledby={`site-tab-${tab}`} className="min-w-0">
        {tab === 'general' && <GeneralTab config={config} onChange={setConfig} />}
        {tab === 'header' && <HeaderTab config={config} onChange={setConfig} dbPages={dbPages} dbCategories={dbCategories} dbProducts={dbProducts} />}
        {tab === 'footer' && <FooterTab config={config} onChange={setConfig} dbCategories={dbCategories} dbBlogs={dbBlogs} dbPages={dbPages} />}
        {tab === 'social' && <SocialLinksTab config={config} onChange={setConfig} />}
        {tab === 'popup' && <PopupTab config={config} onChange={setConfig} />}
        {tab === 'redirects' && <RedirectsTab />}
      </div>

      {/* WordPress-style submit row */}
      {tab !== 'redirects' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="wp-btn wp-btn-primary"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <p className="wp-muted m-0">Changes apply immediately after saving.</p>
        </div>
      )}
    </Page>
    </RequirePermission>
  );
}
