"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import {
  Plus, X, ChevronDown, ChevronUp, Save, Globe,
  Truck, Check, Info, Loader2, GripVertical, ShieldCheck
} from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { usePopup } from "@/context/PopupContext";
import { COUNTRIES, countryName } from "@/lib/countries";

// ─── Shared WordPress input styles ─────────────────────────────────────────────
const inp  = "w-full border border-[#8c8f94] rounded-[3px] px-3 py-[6px] text-[13px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] bg-white transition-all shadow-sm";
const lbl  = "block text-[13px] font-semibold text-[#1d2327] mb-1.5";
const hint = "text-[12px] text-[#646970] mt-1.5 italic leading-relaxed";

const PROVIDERS = [
  { key: "FLAT_RATE",     label: "Flat Rate",     emoji: "📦", desc: "Fixed cost per order" },
  { key: "FREE_SHIPPING", label: "Free Shipping", emoji: "🎁", desc: "Free with optional minimum" },
  { key: "LOCAL_PICKUP",  label: "Local Pickup",  emoji: "🏪", desc: "Customer picks up in store" },
];

// Offered when adding a NEW coverage rule. "region" is intentionally excluded —
// it is a confusing, semantically-overlapping duplicate of country matching kept
// only for backward compatibility with older zones.
const RULE_TYPES = [
  { value: "country",           label: "Country" },
  { value: "state",             label: "State / Province" },
  { value: "city",              label: "City" },
  { value: "postal_code",       label: "Postal Code" },
  { value: "postal_code_range", label: "Postal Code Range" },
];
const LEGACY_REGION_TYPE = { value: "region", label: "Region (legacy)" };

const VALUE_PLACEHOLDERS = {
  state:       "e.g. CA, NY — leave blank to match any state",
  province:    "e.g. Ontario, Quebec — leave blank to match any province",
  city:        "e.g. Los Angeles, New York — leave blank to match any city",
  postal_code: "e.g. 90001, 10001 — leave blank to match any postal code",
  region:      "e.g. Pakistan, PK",
  custom:      "Comma separated match values",
};

// ─── WordPress Navigation Tabs ──────────────────────────────────────────────────
function NavTabs({ activeTab }) {
  const tab = (href, key, label) => (
    <Link
      href={href}
      className={`px-4 py-2 text-[14px] font-semibold border-t-2 border-x border-b transition-all ${
        activeTab === key
          ? "bg-[#f0f2f1] border-t-[#2271b1] border-x-[#c3c4c7] border-b-transparent translate-y-[1px] text-[#1d2327]"
          : "bg-white border-t-transparent border-x-transparent border-b-[#c3c4c7] text-[#2271b1] hover:text-[#135e96] hover:bg-[#fafafa]"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex border-b border-[#c3c4c7] mb-6 mt-1 gap-1">
      {tab("/admin/settings/shipping", "shipping", "Shipping")}
      {tab("/admin/settings/tax", "tax", "Tax Settings")}
      {tab("/admin/settings/shipping/pickup-locations", "pickup-locations", "Pickup Locations")}
    </div>
  );
}

// ─── Country Multi-Select (searchable checklist + pills) ──────────────────────
function CountryMultiSelect({ values, onChange }) {
  const [filter, setFilter] = useState("");
  const selected = values || [];
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    : COUNTRIES;

  const toggle = (code) => onChange(selected.includes(code) ? selected.filter(v => v !== code) : [...selected, code]);
  const remove = (code) => onChange(selected.filter(v => v !== code));

  return (
    <div>
      <label className="text-[10px] font-bold text-[#646970] uppercase tracking-wider block mb-1">Countries</label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(code => (
            <span key={code} className="inline-flex items-center gap-1 bg-[#f0f6fb] border border-[#c3c4c7] text-[#1d2327] text-[11px] font-semibold px-2 py-0.5 rounded-[3px]">
              {code} — {countryName(code)}
              <button type="button" onClick={() => remove(code)} className="text-[#646970] hover:text-[#d63638]" title="Remove">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        className={`${inp} mb-1.5`}
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Search countries by name or code…"
      />

      <div className="max-h-48 overflow-y-auto border border-[#c3c4c7] bg-white rounded-[3px] divide-y divide-[#f0f0f1]">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-[11px] text-[#646970] italic">No countries match &quot;{filter}&quot;</div>
        )}
        {filtered.map(c => {
          const checked = selected.includes(c.code);
          return (
            <label key={c.code} className={`flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer hover:bg-[#f0f6fb] ${checked ? "bg-[#f0f6fb]" : ""}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(c.code)} className="accent-[#2271b1]" />
              <span className="font-semibold text-[#1d2327]">{c.code}</span>
              <span className="text-[#646970]">— {c.name}</span>
            </label>
          );
        })}
      </div>
      <p className={hint}>Select one or more countries this rule should match.</p>
    </div>
  );
}

// ─── Rule Type Select (injects the legacy "region" option only when a rule already uses it) ──
function RuleTypeSelect({ value, onChange }) {
  const options = value === "region" ? [LEGACY_REGION_TYPE, ...RULE_TYPES] : RULE_TYPES;
  return (
    <select className={inp} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
  );
}

// ─── Rule Value Editor (structured input per rule type) ────────────────────────
function RuleValueEditor({ rule, onUpdate }) {
  if (rule.type === "country") {
    return <CountryMultiSelect values={rule.values} onChange={values => onUpdate({ values })} />;
  }

  if (rule.type === "postal_code_range") {
    const [from = "", to = ""] = rule.values || [];
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-[#646970] uppercase tracking-wider block mb-1">From</label>
          <input className={inp} value={from} onChange={e => onUpdate({ values: [e.target.value, to] })} placeholder="e.g. 10001" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-[#646970] uppercase tracking-wider block mb-1">To</label>
          <input className={inp} value={to} onChange={e => onUpdate({ values: [from, e.target.value] })} placeholder="e.g. 19999" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-[10px] font-bold text-[#646970] uppercase tracking-wider block mb-1">Values (Comma Separated)</label>
      <input className={inp}
        value={(rule.values || []).join(", ")}
        onChange={e => onUpdate({ values: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })}
        placeholder={VALUE_PLACEHOLDERS[rule.type] || "Comma separated values"} />
    </div>
  );
}

// ─── Coverage Rules Editor (shared by ZoneCard edit form & AddZoneForm) ────────
function CoverageRulesEditor({ matchRules, onChange, variant = "edit" }) {
  const rules = matchRules || [];
  const addRule = () => onChange([...rules, { type: "country", values: [] }]);
  const updRule = (i, u) => onChange(rules.map((r, idx) => idx === i ? { ...r, ...u } : r));
  const delRule = (i) => onChange(rules.filter((_, idx) => idx !== i));

  const create = variant === "create";
  const rowBg = create ? "bg-[#f6f7f7]" : "bg-white";
  const labelColor = create ? "text-[#50575e]" : "text-[#646970]";
  const emptyBg = create ? "bg-[#f6f7f7]" : "bg-white";
  const emptyText = create
    ? "Wildcard — matches all addresses"
    : "No coverage rules — matches all addresses (Wildcard Fallback)";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <label className={lbl}>Coverage Rules</label>
          <p className={hint}>
            {create
              ? "Leave empty to match all locations (acts as a wildcard fallback)."
              : "The zone matches customer location if all rules pass. Leave empty for wildcard fallback."}
          </p>
        </div>
        <button type="button" onClick={addRule} className="text-[#2271b1] text-[12px] font-bold hover:underline flex items-center gap-1 shrink-0">
          <Plus className="w-3 h-3" />Add Location Rule
        </button>
      </div>

      {rules.length === 0 && (
        <div className={`text-[11px] text-[#646970] italic border border-dashed border-[#c3c4c7] ${emptyBg} rounded-[3px] px-4 py-3 text-center`}>{emptyText}</div>
      )}

      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div key={i} className={`${rowBg} border border-[#c3c4c7] p-3 space-y-2`}>
            <div className="flex items-center justify-between gap-2">
              <div className="w-[180px]">
                <label className={`text-[10px] font-bold ${labelColor} uppercase tracking-wider block mb-1`}>Rule Type</label>
                <RuleTypeSelect value={rule.type} onChange={type => updRule(i, { type, values: [] })} />
              </div>
              <button type="button" onClick={() => delRule(i)} className="text-[#b32d2e] hover:text-[#d63638] text-[11px] font-bold hover:underline self-end pb-1.5">Remove Rule</button>
            </div>
            <RuleValueEditor rule={rule} onUpdate={u => updRule(i, u)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Provider Settings Form ────────────────────────────────────────────────────
function ProviderSettings({ provider, settings, onChange }) {
  const s = (k, v) => onChange({ ...settings, [k]: v });
  const [pickupLocations, setPickupLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const fetchedLocationsRef = useRef(false);

  useEffect(() => {
    if (provider !== "LOCAL_PICKUP" || fetchedLocationsRef.current) return;
    fetchedLocationsRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/shipping/pickup-locations");
        const data = await res.json();
        if (data.success) setPickupLocations((data.locations || []).filter(l => l.status === "Active"));
      } catch {
        // Silent — the dropdown just falls back to "no specific location".
      } finally {
        setLoadingLocations(false);
      }
    })();
  }, [provider]);

  if (provider === "FLAT_RATE") return (
    <div>
      <label className={lbl}>Shipping Cost ($) <span className="text-red-500">*</span></label>
      <input type="number" min="0" className={`${inp} max-w-[200px] font-bold`} value={settings.cost ?? ""} onChange={e => s("cost", Number(e.target.value))} placeholder="e.g. 10" />
    </div>
  );
  if (provider === "FREE_SHIPPING") return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className={lbl}>Minimum Order Amount ($)</label>
        <input type="number" min="0" className={`${inp} font-semibold`} value={settings.minimumOrderAmount ?? ""} onChange={e => s("minimumOrderAmount", Number(e.target.value))} placeholder="0 = always free" />
        <p className={hint}>Leave 0 to always offer free shipping.</p>
      </div>
      <div>
        <label className={lbl}>Fallback Cost ($)</label>
        <input type="number" min="0" className={`${inp} font-semibold`} value={settings.fallbackCost ?? ""} onChange={e => s("fallbackCost", Number(e.target.value))} placeholder="Charged if minimum not met" />
      </div>
    </div>
  );
  if (provider === "LOCAL_PICKUP") return (
    <div className="space-y-4">
      <div>
        <label className={lbl}>Handling Fee ($)</label>
        <input type="number" min="0" className={`${inp} max-w-[200px] font-bold`} value={settings.cost ?? ""} onChange={e => s("cost", Number(e.target.value))} placeholder="0" />
        <p className={hint}>Usually 0. This is an optional admin/preparation charge.</p>
      </div>
      <div>
        <label className={lbl}>Pickup Location</label>
        <select className={inp} value={settings.pickupLocationId ?? ""} onChange={e => s("pickupLocationId", e.target.value || null)} disabled={loadingLocations}>
          <option value="">— No specific location —</option>
          {pickupLocations.map(loc => (
            <option key={loc._id} value={loc._id}>{loc.name}{loc.address?.city ? ` (${loc.address.city})` : ""}</option>
          ))}
        </select>
        <p className={hint}>
          {loadingLocations ? (
            "Loading pickup locations…"
          ) : pickupLocations.length === 0 ? (
            <>No active pickup locations yet. <Link href="/admin/settings/shipping/pickup-locations" className="text-[#2271b1] hover:underline">Add one</Link>.</>
          ) : (
            "Customers will see this location's address and instructions at checkout."
          )}
        </p>
      </div>
    </div>
  );
  return null;
}

// ─── Add / Edit Method Modal (WP Theme) ─────────────────────────────────────────
function MethodModal({ zoneId, initial, onClose, onSaved }) {
  const blank = { name: "", description: "", provider: "FLAT_RATE", settings: {}, status: "Active", sortOrder: 0, activeFrom: "", activeUntil: "" };
  const [m, setM] = useState(initial ?? blank);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setM(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!m.name?.trim()) return toast.error("Method name is required.");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${zoneId}/methods`, {
        method: m._id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...m, id: m._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      toast.success(m._id ? "Method updated." : "Method added.");
      onSaved(data.method);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white border border-[#c3c4c7] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#c3c4c7] bg-[#f6f7f7]">
          <div>
            <h2 className="text-[14px] font-bold text-[#1d2327] m-0">{m._id ? "Edit" : "Add"} Shipping Method</h2>
          </div>
          <button onClick={onClose} className="p-1 text-[#646970] hover:text-[#d63638]"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Name & description */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Method Name <span className="text-red-500">*</span></label>
              <input className={inp} value={m.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Standard Delivery" />
            </div>
            <div>
              <label className={lbl}>Description</label>
              <input className={inp} value={m.description} onChange={e => set("description", e.target.value)} placeholder="Shown to customer (optional)" />
            </div>
          </div>

          {/* Provider selector */}
          <div>
            <label className={lbl}>Shipping Type</label>
            <div className="grid grid-cols-3 gap-3 mt-1.5">
              {PROVIDERS.map(p => (
                <button key={p.key} type="button"
                  onClick={() => setM(prev => ({ ...prev, provider: p.key, settings: {} }))}
                  className={`relative border text-left p-3 transition-all rounded-none ${
                    m.provider === p.key
                      ? "border-[#2271b1] bg-[#f0f6fb] shadow-sm"
                      : "border-[#c3c4c7] bg-white hover:border-[#8c8f94]"
                  }`}
                >
                  {m.provider === p.key && <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-[#2271b1]" />}
                  <div className="text-xl mb-1">{p.emoji}</div>
                  <div className="text-[12px] font-bold text-[#1d2327]">{p.label}</div>
                  <div className="text-[10px] text-[#646970] mt-0.5 leading-snug">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Provider settings */}
          <div className="bg-[#f6f7f7] border border-[#c3c4c7] p-4">
            <p className="text-[11px] font-bold text-[#646970] uppercase tracking-wider mb-3">Rate Configuration</p>
            <ProviderSettings provider={m.provider} settings={m.settings ?? {}} onChange={v => set("settings", v)} />
          </div>

          {/* Schedule & status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Active From</label>
              <input type="datetime-local" className={inp} value={m.activeFrom || ""} onChange={e => set("activeFrom", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Active Until</label>
              <input type="datetime-local" className={inp} value={m.activeUntil || ""} onChange={e => set("activeUntil", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Sort Order</label>
              <input type="number" className={inp} value={m.sortOrder ?? 0} onChange={e => set("sortOrder", Number(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select className={inp} value={m.status} onChange={e => set("status", e.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#c3c4c7] bg-[#f6f7f7]">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-[12px] text-[#2271b1] border border-[#c3c4c7] bg-white rounded-[3px] hover:bg-[#f6f7f7] font-semibold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2271b1] border border-[#2271b1] text-white text-[12px] font-bold rounded-[3px] hover:bg-[#135e96] disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Method"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Zone Postbox (Metabox) ────────────────────────────────────────────────────
function ZoneCard({ zone: initZone, onDelete, onUpdate, dragHandle, deleteDisabled }) {
  const { showConfirm } = usePopup();
  const [zone, setZone]               = useState(initZone);
  const [methods, setMethods]         = useState([]);
  const [hasLoaded, setHasLoaded]     = useState(false);
  const [expanded, setExpanded]       = useState(false);
  const [loadingMethods, setLM]       = useState(false);
  const [showMethodModal, setSMM]     = useState(false);
  const [editingMethod, setEM]        = useState(null);
  const [editing, setEditing]         = useState(false);
  const [form, setForm]               = useState(initZone);
  const [savingZone, setSavingZone]   = useState(false);
  const [deletingMethod, setDM]       = useState(null);

  const loadMethods = useCallback(async () => {
    if (!zone._id) return;
    setLM(true);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${zone._id}/methods`);
      const data = await res.json();
      if (data.success) {
        setMethods(data.methods);
        setHasLoaded(true);
      }
    } catch { toast.error("Failed to load methods."); }
    finally { setLM(false); }
  }, [zone._id]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && methods.length === 0) loadMethods();
  };

  const saveZone = async () => {
    setSavingZone(true);
    try {
      const res = await fetch("/api/admin/shipping/zones", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: zone._id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // PUT returns the raw document without the computed isCatchAll/methodCount
      // fields the GET listing adds — recompute isCatchAll here so the badge and
      // delete-guard stay correct immediately after a save.
      const saved = { ...zone, ...data.zone, isCatchAll: (data.zone.matchRules?.length ?? 0) === 0 };
      setZone(saved); setForm(saved); setEditing(false);
      toast.success("Zone saved.");
      onUpdate(saved);
    } catch (e) { toast.error(e.message); }
    finally { setSavingZone(false); }
  };

  const deleteMethod = async (mid) => {
    const ok = await showConfirm("Are you sure you want to delete this shipping method?");
    if (!ok) return;
    setDM(mid);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${zone._id}/methods?id=${mid}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMethods(p => p.filter(m => m._id !== mid));
      toast.success("Method deleted.");
    } catch (e) { toast.error(e.message); }
    finally { setDM(null); }
  };

  const providerLabel = { FLAT_RATE: "Flat Rate", FREE_SHIPPING: "Free Shipping", LOCAL_PICKUP: "Local Pickup" };
  const displayCount = hasLoaded ? methods.length : (initZone.methodCount ?? 0);

  return (
    <div className="bg-white border border-[#c3c4c7] shadow-sm mb-4 rounded-none overflow-hidden">
      {/* Zone header row */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#c3c4c7] select-none gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {dragHandle}
          <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={toggle}>
            <button className="text-[#646970] hover:text-[#1d2327] transition-colors shrink-0">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <div className="w-7 h-7 rounded-[3px] bg-[#f0f6fb] border border-[#c3c4c7] flex items-center justify-center shrink-0">
              <Globe className="w-3.5 h-3.5 text-[#2271b1]" />
            </div>
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-[#1d2327] leading-tight flex items-center gap-2 flex-wrap">
                <span className="truncate">{zone.name}</span>
                {zone.isCatchAll && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold border border-[#dba617] bg-[#fcf9e8] text-[#8a6100] px-1.5 py-0.5 rounded-[2px] shrink-0"
                    title="This zone automatically matches any address not covered by another zone."
                  >
                    <ShieldCheck className="w-3 h-3" />Catch-all — matches any other address
                  </span>
                )}
              </p>
              {zone.description && <p className="text-[11px] text-[#646970] mt-0.5 truncate">{zone.description}</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[9px] font-bold uppercase border px-2 py-0.5 rounded-[2px] ${
            zone.status === "Active" ? "border-green-300 bg-green-50 text-green-700" : "border-[#c3c4c7] bg-[#f6f7f7] text-[#646970]"
          }`}>{zone.status}</span>

          <span className="text-[11px] text-[#2c3338] bg-[#f6f7f7] border border-[#c3c4c7] px-2 py-0.5 rounded-[3px] font-semibold">
            {displayCount} method{displayCount !== 1 ? "s" : ""}
          </span>

          <button onClick={() => { setForm(zone); setEditing(p => !p); setExpanded(true); }} className="text-[#2271b1] hover:text-[#135e96] text-[12px] font-semibold hover:underline" title="Edit zone">Edit Settings</button>
          <span className="text-[#c3c4c7]">|</span>
          {deleteDisabled ? (
            <span
              className="text-[#a7aaad] text-[12px] font-semibold cursor-not-allowed select-none"
              title="This is your only catch-all zone — every store needs one so customers outside all other zones can still check out. Create another catch-all zone first if you want to remove this one."
            >
              Delete
            </span>
          ) : (
            <button onClick={() => onDelete(zone._id)} className="text-[#b32d2e] hover:text-[#d63638] text-[12px] font-semibold hover:underline" title="Delete zone">Delete</button>
          )}
        </div>
      </div>

      {/* Edit zone inline form */}
      {editing && (
        <div className="border-b border-[#c3c4c7] bg-[#fafafa] p-5 space-y-4">
          <p className="text-[12px] font-bold text-[#1d2327] uppercase tracking-wider">Zone Configuration</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Zone Name</label><input className={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className={lbl}>Description</label><input className={inp} value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div><label className={lbl}>Priority (higher wins tie)</label><input type="number" className={inp} value={form.priority ?? 0} onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))} /></div>
            <div>
              <label className={lbl}>Status</label>
              <select className={inp} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {zone.isCatchAll && (
            <div className="flex items-start gap-2 border border-[#dba617] bg-[#fcf9e8] text-[#8a6100] px-3 py-2.5 text-[12px] rounded-[3px]">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p>This is your store&apos;s catch-all zone. It matches any address not covered by another zone. Adding a coverage rule here will turn it into a regular zone — make sure another catch-all zone exists first, or the save will be rejected.</p>
            </div>
          )}

          {/* Coverage rules */}
          <CoverageRulesEditor matchRules={form.matchRules} onChange={matchRules => setForm(p => ({ ...p, matchRules }))} variant="edit" />

          <div className="flex gap-2 pt-2">
            <button onClick={saveZone} disabled={savingZone} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2271b1] border border-[#2271b1] text-white text-[12px] font-bold rounded-[3px] hover:bg-[#135e96] disabled:opacity-60 transition-colors cursor-pointer">
              {savingZone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{savingZone ? "Saving…" : "Save Zone Settings"}
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-[12px] text-[#2271b1] border border-[#c3c4c7] bg-white rounded-[3px] hover:bg-[#f6f7f7] font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {/* Methods panel */}
      {expanded && (
        <div className="bg-[#f6f7f7] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-[#50575e] uppercase tracking-wider">Shipping Rates & Methods</p>
            <button onClick={() => { setEM(null); setSMM(true); }} className="bg-white border border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fb] px-2.5 py-1 rounded-[3px] text-[11.5px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer">
              <Plus className="w-3 h-3" />Add Shipping Method
            </button>
          </div>

          {loadingMethods && <div className="flex items-center gap-2 text-[12px] text-[#646970] py-3"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading methods…</div>}

          {!loadingMethods && methods.length === 0 && (
            <div className="border border-dashed border-[#c3c4c7] bg-white p-6 text-center">
              <Truck className="w-8 h-8 text-[#ccd0d4] mx-auto mb-2" />
              <p className="text-[12.5px] font-bold text-[#1d2327]">No shipping methods assigned</p>
              <p className="text-[11.5px] text-[#646970]">Customers matched to this zone will not be able to checkout. Add a method above.</p>
            </div>
          )}

          {methods.length > 0 && (
            <table className="wp-list-table widefat fixed striped posts w-full border border-[#c3c4c7] border-collapse bg-white text-left text-[13px]">
              <thead>
                <tr className="bg-[#f6f7f7] border-b border-[#c3c4c7] text-[#2c3338]">
                  <th className="px-3 py-2 font-bold w-[35%]">Method Name</th>
                  <th className="px-3 py-2 font-bold w-[25%]">Provider</th>
                  <th className="px-3 py-2 font-bold w-[20%]">Cost</th>
                  <th className="px-3 py-2 font-bold w-[10%]">Status</th>
                  <th className="px-3 py-2 font-bold w-[10%] text-center"></th>
                </tr>
              </thead>
              <tbody>
                {methods.map(m => {
                  const cost = m.provider === "FLAT_RATE" ? `$${m.settings?.cost ?? 0}`
                    : m.provider === "FREE_SHIPPING" ? (m.settings?.minimumOrderAmount > 0 ? `Free over $${m.settings.minimumOrderAmount}` : "Free") : `$${m.settings?.cost ?? 0}`;
                  return (
                    <tr key={m._id} className="hover:bg-[#f0f6fb] border-b border-[#f0f0f1] last:border-0 group">
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-[#1d2327]">{m.name}</span>
                        {m.description && <p className="text-[11px] text-[#646970] mt-0.5">{m.description}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-[#646970]">
                        {providerLabel[m.provider]}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-[#2271b1]">
                        {cost}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-bold uppercase border px-1.5 py-0.5 rounded-[2px] ${
                          m.status === "Active" ? "border-green-300 bg-green-50 text-green-700" : "border-[#c3c4c7] bg-[#f6f7f7] text-[#646970]"
                        }`}>{m.status}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setEM(m); setSMM(true); }} className="text-[#2271b1] hover:text-[#135e96] font-semibold text-[12px] hover:underline">Edit</button>
                          <span className="text-[#c3c4c7]">|</span>
                          <button onClick={() => deleteMethod(m._id)} disabled={deletingMethod === m._id} className="text-[#b32d2e] hover:text-[#d63638] font-semibold text-[12px] hover:underline">
                            {deletingMethod === m._id ? "..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showMethodModal && (
        <MethodModal zoneId={zone._id} initial={editingMethod} onClose={() => { setSMM(false); setEM(null); }}
          onSaved={saved => {
            setMethods(p => editingMethod ? p.map(m => m._id === saved._id ? saved : m) : [...p, saved]);
            setSMM(false); setEM(null);
          }} />
      )}
    </div>
  );
}

// ─── Add Zone Postbox (Metabox) ────────────────────────────────────────────────
function AddZoneForm({ onCreated }) {
  const blank = { name: "", description: "", priority: 0, sortOrder: 0, status: "Active", matchRules: [] };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!form.name?.trim()) return toast.error("Zone name is required.");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/shipping/zones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Shipping zone created.");
      onCreated({ ...data.zone, methodCount: 0, isCatchAll: (data.zone.matchRules?.length ?? 0) === 0 });
      setForm(blank); setOpen(false);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-2 border border-dashed border-[#8c8f94] bg-white rounded-none py-4 text-[13px] font-bold text-[#2271b1] hover:border-[#2271b1] hover:bg-[#f0f6fb] transition-all">
      <Plus className="w-4 h-4" />Create Shipping Zone
    </button>
  );

  return (
    <div className="bg-white border-2 border-[#2271b1] shadow-sm p-5 space-y-5 rounded-none">
      <p className="text-[14px] font-bold text-[#1d2327] m-0 border-b border-[#f0f0f1] pb-2.5">New Shipping Zone</p>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>Zone Name <span className="text-red-500">*</span></label><input className={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Pakistan" /></div>
        <div><label className={lbl}>Description</label><input className={inp} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional notes" /></div>
        <div><label className={lbl}>Priority</label><input type="number" className={inp} value={form.priority} onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))} /><p className={hint}>Higher priority zones win on ties during checkout.</p></div>
        <div><label className={lbl}>Status</label><select className={inp} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
      </div>

      <CoverageRulesEditor matchRules={form.matchRules} onChange={matchRules => setForm(p => ({ ...p, matchRules }))} variant="create" />

      <div className="flex gap-2 pt-1">
        <button onClick={create} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2271b1] border border-[#2271b1] text-white text-[12px] font-bold rounded-[3px] hover:bg-[#135e96] disabled:opacity-60 transition-colors cursor-pointer">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}{saving ? "Creating…" : "Create Shipping Zone"}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-[12px] text-[#2271b1] border border-[#c3c4c7] bg-white rounded-[3px] hover:bg-[#f6f7f7] font-semibold">Cancel</button>
      </div>
    </div>
  );
}

// ─── Main Shipping Settings Page ──────────────────────────────────────────────
export default function ShippingSettingsPage() {
  const { showConfirm } = usePopup();
  const [zones, setZones]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/shipping/zones");
        const data = await res.json();
        if (data.success) setZones(data.zones);
        else toast.error(data.error || "Failed to load zones.");
      } catch { toast.error("Failed to load shipping zones."); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleDelete = async (id) => {
    const ok = await showConfirm("Delete this zone and ALL its shipping methods? This cannot be undone.");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/shipping/zones?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setZones(p => p.filter(z => z._id !== id));
      toast.success("Zone deleted.");
    } catch (e) { toast.error(e.message); }
  };

  const persistOrder = useCallback(async (orderedZones) => {
    setReordering(true);
    try {
      const res = await fetch("/api/admin/shipping/zones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: orderedZones.map(z => z._id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save the new zone order.");
      // The reorder endpoint returns raw zone documents without the computed
      // isCatchAll/methodCount fields the GET listing adds — recompute/preserve
      // them from what we already have so the badge, method counts and the
      // delete-guard for the catch-all zone don't go stale after a drop.
      setZones(prevZones => {
        const byId = Object.fromEntries(prevZones.map(z => [z._id, z]));
        return data.zones.map(z => ({
          ...z,
          isCatchAll: (z.matchRules?.length ?? 0) === 0,
          methodCount: byId[z._id]?.methodCount ?? 0,
        }));
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setReordering(false);
    }
  }, []);

  const handleDrop = (dropIndex) => {
    setOverIndex(null);
    if (dragIndex === null || dragIndex === dropIndex) { setDragIndex(null); return; }
    // Compute the reordered list and persist it as a plain side effect (not from
    // inside the setZones updater) so a double-invoked updater (e.g. React Strict
    // Mode) can never fire the PATCH request twice.
    const next = [...zones];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setZones(next);
    persistOrder(next);
    setDragIndex(null);
  };

  const catchAllCount = zones.filter(z => z.isCatchAll).length;

  return (
    <AdminPageLayout title="Shipping settings" breadcrumbs={[{ label: "Settings" }, { label: "Shipping" }]}>
      <NavTabs activeTab="shipping" />

      {/* WordPress Style Notice Callout */}
      <div className="bg-white border-l-4 border-[#72aee6] shadow-sm p-4 mb-6 text-[13.5px] text-[#1d2327]">
        <p className="font-semibold mb-1">Store Shipping Management</p>
        <p className="text-[#646970] leading-relaxed">
          Create zones representing your shipping locations, then assign methods and rates to them.
          During checkout, the matching engine looks for the most specific geographical match.
          Drag zones by their handle to reorder them, and use the country picker below to avoid typos in coverage rules.
          Every store keeps exactly one catch-all zone (marked below) that matches any address not covered elsewhere.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-[13px] text-[#646970]">
          <Loader2 className="w-4 h-4 animate-spin" />Loading shipping zones…
        </div>
      ) : (
        <div className="space-y-4 pb-16">
          {zones.length === 0 && (
            <div className="bg-white border border-[#c3c4c7] p-12 text-center shadow-sm">
              <Globe className="w-10 h-10 text-[#ccd0d4] mx-auto mb-3" />
              <p className="text-[14px] font-bold text-[#1d2327] mb-1">No shipping zones configured</p>
              <p className="text-[12px] text-[#646970] max-w-sm mx-auto">Create a shipping zone below to start configuring shipping rates for your customers.</p>
            </div>
          )}

          {reordering && (
            <div className="flex items-center gap-2 text-[12px] text-[#2271b1] font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />Saving new zone order…
            </div>
          )}

          <div className="space-y-3">
            {zones.map((zone, index) => (
              <div
                key={zone._id}
                onDragOver={e => { e.preventDefault(); if (overIndex !== index) setOverIndex(index); }}
                onDragLeave={() => setOverIndex(o => (o === index ? null : o))}
                onDrop={() => handleDrop(index)}
                className={`transition-all rounded-none ${dragIndex === index ? "opacity-40" : ""} ${overIndex === index && dragIndex !== null && dragIndex !== index ? "outline outline-2 outline-[#2271b1] outline-offset-2" : ""}`}
              >
                <ZoneCard
                  zone={zone}
                  onDelete={handleDelete}
                  onUpdate={updated => setZones(p => p.map(z => z._id === updated._id ? { ...z, ...updated } : z))}
                  deleteDisabled={zone.isCatchAll && catchAllCount <= 1}
                  dragHandle={
                    <span
                      draggable
                      onDragStart={e => { e.stopPropagation(); setDragIndex(index); }}
                      onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                      onClick={e => e.stopPropagation()}
                      className="cursor-grab active:cursor-grabbing text-[#a7aaad] hover:text-[#646970] shrink-0 px-0.5"
                      title="Drag to reorder zones"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                  }
                />
              </div>
            ))}
          </div>

          <AddZoneForm onCreated={zone => setZones(p => [...p, zone])} />
        </div>
      )}
    </AdminPageLayout>
  );
}
