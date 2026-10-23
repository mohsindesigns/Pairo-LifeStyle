"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import {
  Plus, X, ChevronDown, ChevronUp, Save, Check, Loader2, GripVertical,
} from "lucide-react";
import { Page, PageHeader, Notice } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import { COUNTRIES, countryName } from "@/lib/countries";
import RequirePermission from "@/components/admin/RequirePermission";
import ShippingTaxTabs from "@/components/admin/settings/ShippingTaxTabs";
import { normalizeMethodSettings } from "./methodSettings";

// ─── Shared WordPress input styles ─────────────────────────────────────────────
const inp  = "wp-input wp-full";
const sel  = "wp-select wp-full";
const lbl  = "wp-label";
const hint = "wp-desc";

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

// Display-only labels for the region chips in the zones table.
const RULE_CHIP_LABELS = {
  state: "State", province: "Province", city: "City", postal_code: "Postcode",
  postal_code_range: "Postcodes", region: "Region", custom: "Custom",
};

function regionChips(matchRules) {
  return (matchRules || []).flatMap((r) => {
    const values = r.values || [];
    if (r.type === "country") return values.map((code) => countryName(code) || code);
    const label = RULE_CHIP_LABELS[r.type] || r.type;
    if (values.length === 0) return [`${label}: any`];
    return [`${label}: ${values.join(r.type === "postal_code_range" ? " – " : ", ")}`];
  });
}


// ─── Label-left form row ───────────────────────────────────────────────────────
function FRow({ label, htmlFor, hint: hintText, children }) {
  return (
    <div className="wp-frow">
      {htmlFor ? (
        <label className="wp-flabel" htmlFor={htmlFor}>{label}</label>
      ) : (
        <span className="wp-flabel">{label}</span>
      )}
      <div className="min-w-0" style={{ flex: "1 1 320px", maxWidth: 520 }}>{children}</div>
      {hintText && <p className="wp-hint">{hintText}</p>}
    </div>
  );
}

// ─── Country Multi-Select (searchable checklist + chips) ──────────────────────
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
      <span className={lbl}>Countries</span>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(code => (
            <span key={code} className="wp-chip">
              {code} — {countryName(code)}
              <button type="button" onClick={() => remove(code)} className="min-w-[24px] min-h-[24px] justify-center" title="Remove" aria-label={`Remove ${countryName(code) || code}`}>
                <X className="w-3.5 h-3.5" />
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
        aria-label="Search countries"
      />

      <div className="wp-checklist" style={{ maxHeight: 192, padding: 0 }}>
        {filtered.length === 0 && (
          <div className="wp-muted px-3 py-3 text-center">No countries match &quot;{filter}&quot;</div>
        )}
        {filtered.map(c => {
          const checked = selected.includes(c.code);
          return (
            <label key={c.code} className={`wp-check px-2.5 ${checked ? "bg-[#f0f6fc]" : ""}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(c.code)} />
              <span className="wp-strong">{c.code}</span>
              <span className="wp-muted">— {c.name}</span>
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
    <select className={sel} value={value} onChange={e => onChange(e.target.value)} aria-label="Rule type">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={lbl}>From</span>
          <input className={inp} value={from} onChange={e => onUpdate({ values: [e.target.value, to] })} placeholder="e.g. 10001" />
        </label>
        <label className="block">
          <span className={lbl}>To</span>
          <input className={inp} value={to} onChange={e => onUpdate({ values: [from, e.target.value] })} placeholder="e.g. 19999" />
        </label>
      </div>
    );
  }

  return (
    <label className="block">
      <span className={lbl}>Values (comma separated)</span>
      <input className={inp}
        value={(rule.values || []).join(", ")}
        onChange={e => onUpdate({ values: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })}
        placeholder={VALUE_PLACEHOLDERS[rule.type] || "Comma separated values"} />
    </label>
  );
}

// ─── Coverage Rules Editor (shared by ZoneCard edit form & AddZoneForm) ────────
function CoverageRulesEditor({ matchRules, onChange, variant = "edit" }) {
  const rules = matchRules || [];
  const addRule = () => onChange([...rules, { type: "country", values: [] }]);
  const updRule = (i, u) => onChange(rules.map((r, idx) => idx === i ? { ...r, ...u } : r));
  const delRule = (i) => onChange(rules.filter((_, idx) => idx !== i));

  const create = variant === "create";
  const emptyText = create
    ? "Wildcard — matches all addresses"
    : "No coverage rules — matches all addresses (Wildcard Fallback)";

  return (
    <div>
      <p className={hint} style={{ marginTop: 0, marginBottom: 8 }}>
        {create
          ? "Leave empty to match all locations (acts as a wildcard fallback)."
          : "The zone matches customer location if all rules pass. Leave empty for wildcard fallback."}
      </p>

      {rules.length === 0 && (
        <div className="wp-muted border border-dashed border-[#c3c4c7] bg-white px-3 py-3 mb-2">{emptyText}</div>
      )}

      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div key={i} className="bg-white border border-[#dcdcde] p-3 space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="w-full sm:w-[220px]">
                <span className={lbl}>Rule type</span>
                <RuleTypeSelect value={rule.type} onChange={type => updRule(i, { type, values: [] })} />
              </div>
              <div className="wp-row-actions" style={{ visibility: "visible", paddingTop: 0 }}>
                <button type="button" onClick={() => delRule(i)} className="is-danger max-[782px]:min-h-[40px]">Remove rule</button>
              </div>
            </div>
            <RuleValueEditor rule={rule} onUpdate={u => updRule(i, u)} />
          </div>
        ))}
      </div>

      <button type="button" onClick={addRule} className="wp-btn mt-2">
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />Add location rule
      </button>
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
    <FRow label={<>Shipping cost ($) <span className="text-[#d63638]">*</span></>} htmlFor="method-cost">
      <input id="method-cost" type="number" min="0" className={inp} style={{ maxWidth: 200 }} value={settings.cost ?? ""} onChange={e => s("cost", e.target.value)} placeholder="e.g. 10" required aria-required="true" />
    </FRow>
  );
  if (provider === "FREE_SHIPPING") return (
    <>
      <FRow label="Minimum order amount ($)" htmlFor="method-min" hint="Leave blank (or 0) to always offer free shipping.">
        <input id="method-min" type="number" min="0" className={inp} style={{ maxWidth: 200 }} value={settings.minimumOrderAmount ?? ""} onChange={e => s("minimumOrderAmount", e.target.value)} placeholder="Blank = always free" />
      </FRow>
      <FRow label="Fallback cost ($)" htmlFor="method-fallback">
        <input id="method-fallback" type="number" min="0" className={inp} style={{ maxWidth: 200 }} value={settings.fallbackCost ?? ""} onChange={e => s("fallbackCost", e.target.value)} placeholder="Charged if minimum not met" />
      </FRow>
    </>
  );
  if (provider === "LOCAL_PICKUP") return (
    <>
      <FRow label="Handling fee ($)" htmlFor="method-fee" hint="Usually 0. This is an optional admin/preparation charge.">
        <input id="method-fee" type="number" min="0" className={inp} style={{ maxWidth: 200 }} value={settings.cost ?? ""} onChange={e => s("cost", e.target.value)} placeholder="0" />
      </FRow>
      <FRow label="Pickup location" htmlFor="method-pickup">
        <select id="method-pickup" className={sel} value={settings.pickupLocationId ?? ""} onChange={e => s("pickupLocationId", e.target.value || null)} disabled={loadingLocations}>
          <option value="">— No specific location —</option>
          {pickupLocations.map(loc => (
            <option key={loc._id} value={loc._id}>{loc.name}{loc.address?.city ? ` (${loc.address.city})` : ""}</option>
          ))}
        </select>
        <p className={hint}>
          {loadingLocations ? (
            "Loading pickup locations…"
          ) : pickupLocations.length === 0 ? (
            <>No active pickup locations yet. <Link href="/admin/settings/shipping/pickup-locations" className="wp-link">Add one</Link>.</>
          ) : (
            "Customers will see this location's address and instructions at checkout."
          )}
        </p>
      </FRow>
    </>
  );
  return null;
}

// ─── Add / Edit Method Modal ────────────────────────────────────────────────────
function MethodModal({ zoneId, initial, onClose, onSaved }) {
  const blank = { name: "", description: "", provider: "FLAT_RATE", settings: {}, status: "Active", sortOrder: 0, activeFrom: "", activeUntil: "" };
  const [m, setM] = useState(initial ?? blank);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setM(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!m.name?.trim()) return toast.error("Method name is required.");
    const normalized = normalizeMethodSettings(m.provider, m.settings);
    if (normalized.error) return toast.error(normalized.error);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${zoneId}/methods`, {
        method: m._id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...m, settings: normalized.settings, id: m._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      toast.success(m._id ? "Method updated." : "Method added.");
      onSaved(data.method);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="wp-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wp-modal" role="dialog" aria-modal="true" aria-labelledby="method-modal-title">
        <div className="wp-modal-head">
          <h2 id="method-modal-title">{m._id ? "Edit" : "Add"} shipping method</h2>
          <button type="button" onClick={onClose} className="wp-notice-dismiss min-w-[40px] min-h-[40px] justify-center" aria-label="Close dialog"><X className="w-5 h-5" /></button>
        </div>

        <div className="wp-modal-body">
          <FRow label={<>Method name <span className="text-[#d63638]">*</span></>} htmlFor="method-name">
            <input id="method-name" className={inp} value={m.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Standard Delivery" />
          </FRow>
          <FRow label="Description" htmlFor="method-desc" hint="Shown to the customer (optional).">
            <input id="method-desc" className={inp} value={m.description} onChange={e => set("description", e.target.value)} placeholder="Shown to customer (optional)" />
          </FRow>

          {/* Provider selector */}
          <FRow label="Shipping type">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="group" aria-label="Shipping type">
              {PROVIDERS.map(p => (
                <button key={p.key} type="button"
                  onClick={() => setM(prev => ({ ...prev, provider: p.key, settings: {} }))}
                  aria-pressed={m.provider === p.key}
                  className={`relative border text-left px-3 py-2 min-h-[44px] rounded-[3px] cursor-pointer ${
                    m.provider === p.key
                      ? "border-[#2271b1] bg-[#f0f6fc] shadow-[0_0_0_1px_#2271b1]"
                      : "border-[#c3c4c7] bg-white hover:border-[#8c8f94]"
                  }`}
                >
                  {m.provider === p.key && <Check className="absolute top-2 right-2 w-4 h-4 text-[#2271b1]" aria-hidden="true" />}
                  <span className="wp-strong block"><span aria-hidden="true">{p.emoji}</span> {p.label}</span>
                  <span className="wp-muted wp-small block mt-0.5">{p.desc}</span>
                </button>
              ))}
            </div>
          </FRow>

          {/* Provider settings */}
          <ProviderSettings provider={m.provider} settings={m.settings ?? {}} onChange={v => set("settings", v)} />

          {/* Schedule & status */}
          <FRow label="Active from" htmlFor="method-from">
            <input id="method-from" type="datetime-local" className={inp} value={m.activeFrom || ""} onChange={e => set("activeFrom", e.target.value)} />
          </FRow>
          <FRow label="Active until" htmlFor="method-until">
            <input id="method-until" type="datetime-local" className={inp} value={m.activeUntil || ""} onChange={e => set("activeUntil", e.target.value)} />
          </FRow>
          <FRow label="Sort order" htmlFor="method-sort">
            <input id="method-sort" type="number" className={inp} style={{ maxWidth: 120 }} value={m.sortOrder ?? 0} onChange={e => set("sortOrder", Number(e.target.value))} />
          </FRow>
          <FRow label="Status" htmlFor="method-status">
            <select id="method-status" className={sel} style={{ maxWidth: 200 }} value={m.status} onChange={e => set("status", e.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </FRow>
        </div>

        <div className="wp-modal-foot flex-wrap">
          <button type="button" onClick={onClose} className="wp-btn">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="wp-btn wp-btn-primary">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Save className="w-3.5 h-3.5" aria-hidden="true" />}
            {saving ? "Saving…" : "Save method"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Number of columns in the zones table (drag handle, name, regions, methods, status).
const ZONE_COLS = 5;

function StatusPill({ status }) {
  return (
    <span className={`wp-pill wp-pill-sm ${status === "Active" ? "wp-st-processing" : "wp-st-pending"}`}>{status}</span>
  );
}

// ─── Zone row(s) in the zones table ────────────────────────────────────────────
function ZoneCard({ zone: initZone, onDelete, onUpdate, onDuplicate, dragHandle, deleteDisabled, onMoveUp, onMoveDown, moveDisabled }) {
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
  const [duplicating, setDuplicating] = useState(null);

  const loadMethods = useCallback(async () => {
    if (!zone._id) return;
    setLM(true);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${zone._id}/methods`);
      const data = await res.json();
      if (data.success) {
        setMethods(data.methods || []);
        setHasLoaded(true);
      }
    } catch { toast.error("Failed to load methods."); }
    finally { setLM(false); }
  }, [zone._id]);

  // Methods are fetched the first time the zone is expanded, then cached
  // (mutations below refresh the cache).
  const expand = () => {
    setExpanded(true);
    if (!hasLoaded && !loadingMethods) loadMethods();
  };

  const toggle = () => {
    if (expanded) setExpanded(false);
    else expand();
  };

  const saveZone = async () => {
    setSavingZone(true);
    try {
      const res = await fetch("/api/admin/shipping/zones", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: zone._id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const saved = { ...zone, ...data.zone, isCatchAll: (data.zone.matchRules?.length ?? 0) === 0 };
      setZone(saved); setForm(saved); setEditing(false);
      toast.success("Zone saved.");
      onUpdate(saved);
    } catch (e) { toast.error(e.message); }
    finally { setSavingZone(false); }
  };

  const deleteMethod = async (mid) => {
    const ok = await showConfirm("Delete this shipping method? Customers in this zone will no longer see it at checkout. This cannot be undone.", "Delete shipping method", { confirmText: "Delete", danger: true });
    if (!ok) return;
    setDM(mid);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${zone._id}/methods?id=${mid}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Delete failed (HTTP ${res.status}).`);
      await loadMethods();
      toast.success("Method deleted.");
    } catch (e) { toast.error(e.message); }
    finally { setDM(null); }
  };

  const duplicateMethod = async (mid) => {
    setDuplicating(mid);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${zone._id}/methods/${mid}/duplicate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Duplicate failed (HTTP ${res.status}).`);
      await loadMethods();
      toast.success(`Created "${data.method.name}" (inactive).`);
      setEM(data.method); setSMM(true);
    } catch (e) { toast.error(e.message); }
    finally { setDuplicating(null); }
  };

  const duplicateZone = async () => {
    setDuplicating(zone._id);
    try { await onDuplicate(zone._id); }
    finally { setDuplicating(null); }
  };

  const providerLabel = { FLAT_RATE: "Flat Rate", FREE_SHIPPING: "Free Shipping", LOCAL_PICKUP: "Local Pickup" };
  const displayCount = hasLoaded ? methods.length : (initZone.methodCount ?? 0);
  // Before the methods are loaded, show the summary the zones list returns.
  const pillMethods = hasLoaded ? methods : (initZone.methodSummary || []);
  const chips = regionChips(zone.matchRules);
  const zid = zone._id;

  return (
    <>
      {/* Zone row */}
      <tr>
        <td className="wp-check-col" style={{ verticalAlign: "middle" }}>{dragHandle}</td>
        <td>
          <button
            type="button"
            className="wp-row-title bg-transparent border-0 p-0 cursor-pointer text-left"
            onClick={() => { setForm(zone); setEditing(p => !p); expand(); }}
            aria-expanded={editing}
          >
            {zone.name}
          </button>
          {zone.isCatchAll && (
            <span
              className="wp-pill wp-pill-sm wp-st-confirmed ml-2 align-middle"
              title="This zone automatically matches any address not covered by another zone."
            >
              Catch-all
            </span>
          )}
          {zone.description && <div className="wp-muted wp-small mt-0.5">{zone.description}</div>}
          <div className="wp-mobile-meta">
            {chips.length ? chips.join(", ") : "Everywhere (catch-all)"} · {displayCount} method{displayCount !== 1 ? "s" : ""} · {zone.status}
          </div>
          <div className="wp-row-actions">
            <span><button type="button" onClick={() => { setForm(zone); setEditing(p => !p); expand(); }} className="max-[782px]:min-h-[40px]" title="Edit zone">Edit</button></span>
            {!zone.isCatchAll && onDuplicate && (
              <span>
                <button type="button" onClick={duplicateZone} disabled={duplicating === zone._id} className="max-[782px]:min-h-[40px]" title="Copy this zone and its methods (created inactive)">
                  {duplicating === zone._id ? "Duplicating…" : "Duplicate"}
                </button>
              </span>
            )}
            <span>
              {deleteDisabled ? (
                <span
                  className="is-muted cursor-not-allowed select-none"
                  title="This is your only catch-all zone — every store needs one so customers outside all other zones can still check out. Create another catch-all zone first if you want to remove this one."
                >
                  Delete
                </span>
              ) : (
                <button type="button" onClick={() => onDelete(zone._id)} className="is-danger max-[782px]:min-h-[40px]" title="Delete zone">Delete</button>
              )}
            </span>
            {onMoveUp && (
              <span>
                <button type="button" onClick={onMoveUp} disabled={moveDisabled} className="max-[782px]:min-h-[40px]" aria-label={`Move ${zone.name} up`}>Move up</button>
              </span>
            )}
            {onMoveDown && (
              <span>
                <button type="button" onClick={onMoveDown} disabled={moveDisabled} className="max-[782px]:min-h-[40px]" aria-label={`Move ${zone.name} down`}>Move down</button>
              </span>
            )}
            <span>
              <button type="button" onClick={toggle} className="inline-flex items-center gap-1 max-[782px]:min-h-[40px]" aria-expanded={expanded}>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
                {expanded ? "Hide methods" : "Show methods"}
              </button>
            </span>
          </div>
        </td>
        <td className="wp-hide-sm">
          {chips.length === 0 ? (
            <span className="wp-muted">Everywhere — matches any other address</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {chips.map((c, i) => <span key={i} className="wp-chip wp-small" style={{ padding: "1px 6px" }}>{c}</span>)}
            </div>
          )}
        </td>
        <td className="wp-hide-sm">
          {pillMethods.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {pillMethods.map(m => (
                <span key={m._id} className={`wp-pill wp-pill-sm ${m.status === "Active" ? "" : "opacity-60"}`} title={providerLabel[m.provider]}>{m.name}</span>
              ))}
            </div>
          ) : (
            <span className="wp-muted">{displayCount} method{displayCount !== 1 ? "s" : ""}</span>
          )}
        </td>
        <td className="wp-hide-sm"><StatusPill status={zone.status} /></td>
      </tr>

      {/* Edit zone inline form */}
      {editing && (
        <tr style={{ background: "#f6f7f7" }}>
          <td colSpan={ZONE_COLS} style={{ padding: 12 }}>
            <div className="wp-postbox" style={{ margin: 0 }}>
              <div className="wp-postbox-head"><h2>Edit zone: {zone.name}</h2></div>
              <div className="wp-inside">
                <FRow label="Zone name" htmlFor={`zone-${zid}-name`}>
                  <input id={`zone-${zid}-name`} className={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </FRow>
                <FRow label="Description" htmlFor={`zone-${zid}-desc`}>
                  <input id={`zone-${zid}-desc`} className={inp} value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </FRow>
                <FRow label="Priority" htmlFor={`zone-${zid}-priority`} hint="Higher priority wins a tie.">
                  <input id={`zone-${zid}-priority`} type="number" className={inp} style={{ maxWidth: 120 }} value={form.priority ?? 0} onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))} />
                </FRow>
                <FRow label="Status" htmlFor={`zone-${zid}-status`}>
                  <select id={`zone-${zid}-status`} className={sel} style={{ maxWidth: 200 }} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </FRow>

                {zone.isCatchAll && (
                  <div className="wp-notice wp-notice-warning" style={{ margin: "8px 0" }}>
                    <p>This is your store&apos;s catch-all zone. It matches any address not covered by another zone. Adding a coverage rule here will turn it into a regular zone — make sure another catch-all zone exists first, or the save will be rejected.</p>
                  </div>
                )}

                <FRow label="Zone regions">
                  <CoverageRulesEditor matchRules={form.matchRules} onChange={matchRules => setForm(p => ({ ...p, matchRules }))} variant="edit" />
                </FRow>
              </div>
              <div className="wp-box-foot">
                <button type="button" onClick={saveZone} disabled={savingZone} className="wp-btn wp-btn-primary">
                  {savingZone ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Save className="w-3.5 h-3.5" aria-hidden="true" />}{savingZone ? "Saving…" : "Save zone"}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="wp-btn">Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Methods panel */}
      {expanded && (
        <tr style={{ background: "#f6f7f7" }}>
          <td colSpan={ZONE_COLS} style={{ padding: "8px 12px 14px" }}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="wp-strong">Shipping methods for {zone.name}</span>
              <button type="button" onClick={() => { setEM(null); setSMM(true); }} className="wp-btn">
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />Add shipping method
              </button>
            </div>

            {loadingMethods && <p className="wp-muted flex items-center gap-2 m-0 py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />Loading methods…</p>}

            {!loadingMethods && methods.length === 0 && (
              <div className="bg-white border border-dashed border-[#c3c4c7] px-3 py-3">
                <p className="wp-strong m-0">No shipping methods assigned</p>
                <p className="wp-muted m-0">Customers matched to this zone will not be able to checkout. Add a method above.</p>
              </div>
            )}

            {methods.length > 0 && (
              <div className="wp-table-box">
                <table className="wp-list-table">
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col" className="wp-hide-sm">Type</th>
                      <th scope="col">Cost</th>
                      <th scope="col" className="wp-hide-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methods.map(m => {
                      const cost = m.provider === "FLAT_RATE" ? `$${m.settings?.cost ?? 0}`
                        : m.provider === "FREE_SHIPPING" ? (m.settings?.minimumOrderAmount > 0 ? `Free over $${m.settings.minimumOrderAmount}` : "Free") : `$${m.settings?.cost ?? 0}`;
                      return (
                        <tr key={m._id}>
                          <td>
                            <button type="button" onClick={() => { setEM(m); setSMM(true); }} className="wp-row-title bg-transparent border-0 p-0 cursor-pointer text-left">{m.name}</button>
                            {m.description && <div className="wp-muted wp-small mt-0.5">{m.description}</div>}
                            <div className="wp-mobile-meta">{providerLabel[m.provider]} · {m.status}</div>
                            <div className="wp-row-actions">
                              <span><button type="button" onClick={() => { setEM(m); setSMM(true); }} className="max-[782px]:min-h-[40px]">Edit</button></span>
                              <span>
                                <button type="button" onClick={() => duplicateMethod(m._id)} disabled={duplicating === m._id} className="max-[782px]:min-h-[40px]" title="Copy this method (created inactive)">
                                  {duplicating === m._id ? "Duplicating…" : "Duplicate"}
                                </button>
                              </span>
                              <span>
                                <button type="button" onClick={() => deleteMethod(m._id)} disabled={deletingMethod === m._id} className="is-danger max-[782px]:min-h-[40px]">
                                  {deletingMethod === m._id ? "Deleting…" : "Delete"}
                                </button>
                              </span>
                            </div>
                          </td>
                          <td className="wp-hide-sm">{providerLabel[m.provider]}</td>
                          <td className="wp-strong">{cost}</td>
                          <td className="wp-hide-sm"><StatusPill status={m.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}

      {showMethodModal && (
        <tr>
          <td colSpan={ZONE_COLS} style={{ padding: 0, border: 0 }}>
            <MethodModal zoneId={zone._id} initial={editingMethod} onClose={() => { setSMM(false); setEM(null); }}
              onSaved={async (saved) => {
                if (saved) {
                  setMethods(prev => {
                    const exists = prev.some(m => m._id === saved._id);
                    if (exists) return prev.map(m => m._id === saved._id ? saved : m);
                    return [...prev, saved];
                  });
                  setHasLoaded(true);
                }
                await loadMethods();
                setSMM(false);
                setEM(null);
              }} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Add Zone Postbox ──────────────────────────────────────────────────────────
function AddZoneForm({ onCreated, open, setOpen }) {
  const blank = { name: "", description: "", priority: 0, sortOrder: 0, status: "Active", matchRules: [] };
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

  // Opened from the "Add shipping zone" button in the page header.
  if (!open) return null;

  return (
    <section id="new-zone" className="wp-postbox" aria-labelledby="new-zone-title" style={{ marginTop: 12, scrollMarginTop: 56 }}>
      <div className="wp-postbox-head"><h2 id="new-zone-title">New shipping zone</h2></div>
      <div className="wp-inside">
        <FRow label={<>Zone name <span className="text-[#d63638]">*</span></>} htmlFor="new-zone-name" hint="Give your zone a name, e.g. Local, or Europe.">
          <input id="new-zone-name" className={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Pakistan" />
        </FRow>
        <FRow label="Description" htmlFor="new-zone-desc">
          <input id="new-zone-desc" className={inp} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional notes" />
        </FRow>
        <FRow label="Priority" htmlFor="new-zone-priority" hint="Higher priority zones win on ties during checkout.">
          <input id="new-zone-priority" type="number" className={inp} style={{ maxWidth: 120 }} value={form.priority} onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))} />
        </FRow>
        <FRow label="Status" htmlFor="new-zone-status">
          <select id="new-zone-status" className={sel} style={{ maxWidth: 200 }} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
        </FRow>
        <FRow label="Zone regions">
          <CoverageRulesEditor matchRules={form.matchRules} onChange={matchRules => setForm(p => ({ ...p, matchRules }))} variant="create" />
        </FRow>
      </div>
      <div className="wp-box-foot">
        <button type="button" onClick={create} disabled={saving} className="wp-btn wp-btn-primary">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}{saving ? "Creating…" : "Create shipping zone"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setForm(blank); }} className="wp-btn">Cancel</button>
      </div>
    </section>
  );
}

// ─── WordPress Style Toggle (switch) ───────────────────────────────────────────
function Toggle({ on, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`inline-flex items-center min-h-[40px] bg-transparent border-0 p-0 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? "bg-[#2271b1]" : "bg-[#8c8f94]"}`}>
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

// ─── Main Shipping Settings Page ──────────────────────────────────────────────
export default function ShippingSettingsPage() {
  const { showConfirm } = usePopup();
  const [zones, setZones]   = useState([]);
  const [shippingEnabled, setShippingEnabled] = useState(true);
  const [togglingShipping, setTogglingShipping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const openAddZone = () => {
    setAddOpen(true);
    // Wait for the form to render, then bring it into view and focus the name field.
    setTimeout(() => {
      document.getElementById("new-zone")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("new-zone-name")?.focus({ preventScroll: true });
    }, 50);
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await fetch(`/api/admin/shipping/zones/${id}/duplicate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Duplicate failed (HTTP ${res.status}).`);
      setZones(p => [...p, data.zone]);
      toast.success(`Created "${data.zone.name}" (inactive) with ${data.zone.methodCount} method${data.zone.methodCount === 1 ? "" : "s"}.`);
    } catch (e) { toast.error(e.message); }
  };

  useEffect(() => {
    (async () => {
      try {
        const [zonesRes, settingsRes] = await Promise.all([
          fetch("/api/admin/shipping/zones", { cache: "no-store" }),
          fetch("/api/admin/shipping/settings", { cache: "no-store" }),
        ]);
        const zonesData = await zonesRes.json();
        const settingsData = await settingsRes.json();

        if (zonesData.success) setZones(zonesData.zones);
        else toast.error(zonesData.error || "Failed to load zones.");

        if (settingsData.success) {
          setShippingEnabled(settingsData.shippingEnabled !== false);
        }
      } catch {
        toast.error("Failed to load shipping data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggleShipping = async () => {
    if (togglingShipping) return;
    const nextVal = !shippingEnabled;
    setTogglingShipping(true);
    setShippingEnabled(nextVal);
    try {
      const res = await fetch("/api/admin/shipping/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingEnabled: nextVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update shipping settings.");
      toast.success(
        nextVal
          ? "Shipping module enabled. Custom rates will be applied at checkout."
          : "Shipping module disabled. Free Delivery will be offered at checkout."
      );
    } catch (e) {
      setShippingEnabled(!nextVal);
      toast.error(e.message || "Failed to update shipping status.");
    } finally {
      setTogglingShipping(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await showConfirm("Delete this zone and ALL its shipping methods? This cannot be undone.", "Delete shipping zone", { confirmText: "Delete zone", danger: true });
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
          methodSummary: byId[z._id]?.methodSummary ?? [],
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
    const next = [...zones];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setZones(next);
    persistOrder(next);
    setDragIndex(null);
  };

  // Keyboard/touch alternative to drag — same persistence call.
  const moveZone = (index, delta) => {
    const target = index + delta;
    if (reordering || target < 0 || target >= zones.length) return;
    const next = [...zones];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setZones(next);
    persistOrder(next);
  };

  const catchAllCount = zones.filter(z => z.isCatchAll).length;

  return (
    <RequirePermission permission="settings.view">
    <Page>
      <PageHeader
        title="Shipping"
        actions={shippingEnabled && !loading && (
          <button type="button" onClick={openAddZone} className="wp-btn">
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />Add shipping zone
          </button>
        )}
      />
      <ShippingTaxTabs activeTab="shipping" />

      {/* ── 1. Enable / Disable ─────────────────────── */}
      <section className="wp-postbox" aria-labelledby="shipping-options-title">
        <div className="wp-postbox-head"><h2 id="shipping-options-title">Shipping options</h2></div>
        <div className="wp-inside" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <div className="wp-frow">
            <span className="wp-flabel" id="shipping-enabled-label">Enable shipping</span>
            <div className="flex items-center gap-3">
              <Toggle on={shippingEnabled} onChange={handleToggleShipping} disabled={togglingShipping} label="Enable shipping and delivery module" />
              <span className={shippingEnabled ? "wp-strong" : "wp-muted"}>
                {shippingEnabled ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="wp-hint">
              When on, your shipping zones and rates are applied. When off, checkout offers Free Delivery.
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <p className="wp-muted flex items-center gap-2 py-6">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading shipping zones…
        </p>
      ) : !shippingEnabled ? (
        /* ── Module OFF View: Show Free Delivery status notice, hide zones/features ── */
        <div className="wp-notice wp-notice-warning">
          <p>
            <strong className="wp-strong">Shipping is turned off.</strong> Custom shipping zones, rules, and rate calculations are currently inactive. All customers on the website checkout page will automatically receive <strong className="wp-strong">Free Delivery ($0.00)</strong>. Turn shipping on above to view and configure shipping zones and rates.
          </p>
        </div>
      ) : (
        /* ── Module ON View: Zones, Rules, Rates ── */
        <>
          <p className="wp-muted" style={{ margin: "0 0 10px", maxWidth: 900 }}>
            A shipping zone is a geographic region where a certain set of shipping methods are offered.
            During checkout, the matching engine looks for the most specific geographical match.
            Drag zones by their handle (or use Move up / Move down) to reorder them. Every store keeps exactly one catch-all zone
            that matches any address not covered elsewhere.
          </p>

          {reordering && (
            <Notice type="info">
              <span className="inline-flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />Saving new zone order…</span>
            </Notice>
          )}

          <div className="wp-table-box">
            <table className="wp-list-table">
              <thead>
                <tr>
                  <th scope="col" className="wp-check-col"><span className="sr-only">Reorder</span></th>
                  <th scope="col">Zone name</th>
                  <th scope="col" className="wp-hide-sm">Region(s)</th>
                  <th scope="col" className="wp-hide-sm">Shipping method(s)</th>
                  <th scope="col" className="wp-hide-sm">Status</th>
                </tr>
              </thead>

              {zones.length === 0 && (
                <tbody>
                  <tr>
                    <td colSpan={ZONE_COLS}>
                      <span className="wp-strong">No shipping zones configured.</span>{" "}
                      <span className="wp-muted">Use “Add shipping zone” above to start configuring shipping rates for your customers.</span>
                    </td>
                  </tr>
                </tbody>
              )}

              {zones.map((zone, index) => (
                <tbody
                  key={zone._id}
                  onDragOver={e => { e.preventDefault(); if (overIndex !== index) setOverIndex(index); }}
                  onDragLeave={() => setOverIndex(o => (o === index ? null : o))}
                  onDrop={() => handleDrop(index)}
                  className={`${dragIndex === index ? "opacity-40" : ""} ${overIndex === index && dragIndex !== null && dragIndex !== index ? "[&>tr:first-child>td]:shadow-[inset_0_2px_0_#2271b1]" : ""}`}
                  style={{ borderTop: index > 0 ? "1px solid #dcdcde" : undefined }}
                >
                  <ZoneCard
                    zone={zone}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onUpdate={updated => setZones(p => p.map(z => z._id === updated._id ? { ...z, ...updated } : z))}
                    deleteDisabled={zone.isCatchAll && catchAllCount <= 1}
                    onMoveUp={index > 0 ? () => moveZone(index, -1) : undefined}
                    onMoveDown={index < zones.length - 1 ? () => moveZone(index, 1) : undefined}
                    moveDisabled={reordering}
                    dragHandle={
                      <span
                        draggable
                        onDragStart={e => { e.stopPropagation(); setDragIndex(index); }}
                        onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                        onClick={e => e.stopPropagation()}
                        className="inline-flex cursor-grab active:cursor-grabbing text-[#8c8f94] hover:text-[#1d2327] p-1"
                        title="Drag to reorder zones"
                      >
                        <GripVertical className="w-4 h-4" aria-hidden="true" />
                      </span>
                    }
                  />
                </tbody>
              ))}
            </table>
          </div>

          <AddZoneForm open={addOpen} setOpen={setAddOpen} onCreated={zone => setZones(p => [...p, zone])} />
        </>
      )}
    </Page>
    </RequirePermission>
  );
}
