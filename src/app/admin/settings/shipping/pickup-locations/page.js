"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { Plus, X, Save, Loader2 } from "lucide-react";
import { Page, PageHeader } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import { COUNTRIES } from "@/lib/countries";
import RequirePermission from "@/components/admin/RequirePermission";
import ShippingTaxTabs from "@/components/admin/settings/ShippingTaxTabs";

// ─── Shared WordPress input styles (kept identical to the shipping/tax pages) ─
const inp  = "wp-input wp-full";
const sel  = "wp-select wp-full";


// ─── Label-left form row ───────────────────────────────────────────────────────
function FRow({ label, htmlFor, hint, children }) {
  return (
    <div className="wp-frow">
      <label className="wp-flabel" htmlFor={htmlFor}>{label}</label>
      <div className="min-w-0" style={{ flex: "1 1 320px", maxWidth: 520 }}>{children}</div>
      {hint && <p className="wp-hint">{hint}</p>}
    </div>
  );
}

function blankLocation() {
  return {
    name: "",
    instructions: "",
    address: { street: "", city: "", state: "", zip: "", country: "" },
    phone: "",
    email: "",
    status: "Active",
    sortOrder: 0,
  };
}

// ─── Add / Edit Location Modal (mirrors MethodModal's pattern) ─────────────────
function LocationModal({ initial, onClose, onSaved }) {
  const [loc, setLoc] = useState(() => {
    const base = blankLocation();
    if (!initial) return base;
    return { ...base, ...initial, address: { ...base.address, ...(initial.address || {}) } };
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setLoc(p => ({ ...p, [k]: v }));
  const setAddr = (k, v) => setLoc(p => ({ ...p, address: { ...p.address, [k]: v } }));

  const save = async () => {
    if (!loc.name?.trim()) return toast.error("Location name is required.");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/shipping/pickup-locations", {
        method: loc._id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...loc, id: loc._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save pickup location.");
      toast.success(loc._id ? "Pickup location updated." : "Pickup location added.");
      onSaved(data.location);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="wp-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wp-modal" role="dialog" aria-modal="true" aria-labelledby="location-modal-title">
        <div className="wp-modal-head">
          <h2 id="location-modal-title">{loc._id ? "Edit" : "Add"} pickup location</h2>
          <button type="button" onClick={onClose} className="wp-notice-dismiss min-w-[40px] min-h-[40px] justify-center" aria-label="Close dialog"><X className="w-5 h-5" /></button>
        </div>

        <div className="wp-modal-body">
          <FRow label={<>Location name <span className="text-[#d63638]">*</span></>} htmlFor="loc-name">
            <input id="loc-name" className={inp} value={loc.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Lahore Flagship Store" />
          </FRow>
          <FRow label="Pickup instructions" htmlFor="loc-instructions" hint="Customers see this alongside the address when they choose Local Pickup at checkout.">
            <textarea id="loc-instructions" rows={3} className="wp-textarea" value={loc.instructions} onChange={e => set("instructions", e.target.value)} placeholder="Shown to the customer at checkout — e.g. opening hours, parking notes, what to bring…" />
          </FRow>
          <FRow label="Street address" htmlFor="loc-street">
            <input id="loc-street" className={inp} value={loc.address.street} onChange={e => setAddr("street", e.target.value)} placeholder="e.g. 123 Main Boulevard" />
          </FRow>
          <FRow label="City" htmlFor="loc-city">
            <input id="loc-city" className={inp} value={loc.address.city} onChange={e => setAddr("city", e.target.value)} placeholder="e.g. Lahore" />
          </FRow>
          <FRow label="State / Province" htmlFor="loc-state">
            <input id="loc-state" className={inp} value={loc.address.state} onChange={e => setAddr("state", e.target.value)} placeholder="e.g. Punjab" />
          </FRow>
          <FRow label="ZIP / Postal code" htmlFor="loc-zip">
            <input id="loc-zip" className={inp} value={loc.address.zip} onChange={e => setAddr("zip", e.target.value)} placeholder="e.g. 54000" />
          </FRow>
          <FRow label="Country" htmlFor="loc-country">
            <select id="loc-country" className={sel} value={loc.address.country} onChange={e => setAddr("country", e.target.value)}>
              <option value="">— Select country —</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </FRow>
          <FRow label="Phone" htmlFor="loc-phone">
            <input id="loc-phone" className={inp} value={loc.phone} onChange={e => set("phone", e.target.value)} placeholder="Optional" />
          </FRow>
          <FRow label="Email" htmlFor="loc-email">
            <input id="loc-email" className={inp} value={loc.email} onChange={e => set("email", e.target.value)} placeholder="Optional" />
          </FRow>
          <FRow label="Status" htmlFor="loc-status" hint="Inactive locations will not be offered as a pickup option at checkout.">
            <select id="loc-status" className={sel} style={{ maxWidth: 200 }} value={loc.status} onChange={e => set("status", e.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </FRow>
        </div>

        <div className="wp-modal-foot flex-wrap">
          <button type="button" onClick={onClose} className="wp-btn">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="wp-btn wp-btn-primary">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Save className="w-3.5 h-3.5" aria-hidden="true" />}
            {saving ? "Saving…" : "Save location"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Pickup Locations Page ────────────────────────────────────────────────
export default function PickupLocationsPage() {
  const { showConfirm } = usePopup();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [duplicating, setDuplicating] = useState(null);

  const handleDuplicate = async (id) => {
    setDuplicating(id);
    try {
      const res = await fetch(`/api/admin/shipping/pickup-locations/${id}/duplicate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to duplicate pickup location.");
      setLocations(p => [...p, data.location]);
      toast.success(`Created "${data.location.name}" (inactive).`);
      setEditing(data.location);
      setShowModal(true);
    } catch (e) { toast.error(e.message); }
    finally { setDuplicating(null); }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/shipping/pickup-locations");
        const data = await res.json();
        if (data.success) setLocations(data.locations);
        else toast.error(data.error || "Failed to load pickup locations.");
      } catch { toast.error("Failed to load pickup locations."); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleDelete = async (id) => {
    const ok = await showConfirm("Delete this pickup location? Shipping methods pointing to it will fall back to no specific location. This cannot be undone.", "Delete pickup location", { confirmText: "Delete", danger: true });
    if (!ok) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/shipping/pickup-locations?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete pickup location.");
      setLocations(p => p.filter(l => l._id !== id));
      toast.success("Pickup location deleted.");
    } catch (e) { toast.error(e.message); }
    finally { setDeleting(null); }
  };

  return (
    <RequirePermission permission="settings.view">
    <Page>
      <PageHeader
        title="Pickup locations"
        actions={
          <button type="button" onClick={() => { setEditing(null); setShowModal(true); }} className="wp-btn">
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />Add pickup location
          </button>
        }
      />
      <ShippingTaxTabs activeTab="pickup-locations" />

      <p className="wp-muted" style={{ margin: "0 0 10px", maxWidth: 900 }}>
        Add the store locations customers can pick up orders from, then attach one to a Local Pickup shipping
        method under any shipping zone. The location&apos;s address and instructions are shown to the customer at checkout.
      </p>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col" className="wp-hide-sm">Address</th>
              <th scope="col" className="wp-hide-sm">Contact</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>
                  <span className="wp-muted inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading pickup locations…</span>
                </td>
              </tr>
            ) : locations.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <span className="wp-strong">No pickup locations yet.</span>{" "}
                  <span className="wp-muted">Add a location so it can be attached to a Local Pickup shipping method.</span>
                </td>
              </tr>
            ) : (
              locations.map(l => {
                const address = [l.address?.city, l.address?.state, l.address?.country].filter(Boolean).join(", ");
                return (
                  <tr key={l._id}>
                    <td>
                      <button type="button" onClick={() => { setEditing(l); setShowModal(true); }} className="wp-row-title bg-transparent border-0 p-0 cursor-pointer text-left">{l.name}</button>
                      {l.instructions && <div className="wp-muted wp-small mt-0.5 truncate" style={{ maxWidth: 320 }}>{l.instructions}</div>}
                      <div className="wp-mobile-meta">
                        {address || "Address not set"}
                        {(l.phone || l.email) && <> · {[l.phone, l.email].filter(Boolean).join(" · ")}</>}
                      </div>
                      <div className="wp-row-actions">
                        <span><button type="button" onClick={() => { setEditing(l); setShowModal(true); }} className="max-[782px]:min-h-[40px]">Edit</button></span>
                        <span>
                          <button type="button" onClick={() => handleDuplicate(l._id)} disabled={duplicating === l._id} className="max-[782px]:min-h-[40px]">
                            {duplicating === l._id ? "Duplicating…" : "Duplicate"}
                          </button>
                        </span>
                        <span>
                          <button type="button" onClick={() => handleDelete(l._id)} disabled={deleting === l._id} className="is-danger max-[782px]:min-h-[40px]">
                            {deleting === l._id ? "Deleting…" : "Delete"}
                          </button>
                        </span>
                      </div>
                    </td>
                    <td className="wp-hide-sm">
                      {address || <span className="wp-muted">Not set</span>}
                    </td>
                    <td className="wp-hide-sm">
                      {l.phone && <div>{l.phone}</div>}
                      {l.email && <div>{l.email}</div>}
                      {!l.phone && !l.email && <span className="wp-muted">—</span>}
                    </td>
                    <td>
                      <span className={`wp-pill wp-pill-sm ${l.status === "Active" ? "wp-st-processing" : "wp-st-pending"}`}>{l.status}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <LocationModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={saved => {
            setLocations(p => editing ? p.map(l => l._id === saved._id ? saved : l) : [...p, saved]);
            setShowModal(false); setEditing(null);
          }}
        />
      )}
    </Page>
    </RequirePermission>
  );
}
