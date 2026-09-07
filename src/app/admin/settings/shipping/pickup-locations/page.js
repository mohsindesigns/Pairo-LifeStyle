"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import {
  Plus, X, Save, Loader2, MapPin, Store, Phone, Mail
} from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { usePopup } from "@/context/PopupContext";
import { COUNTRIES } from "@/lib/countries";

// ─── Shared WordPress input styles (kept identical to the shipping/tax pages) ─
const inp  = "w-full border border-[#8c8f94] rounded-[3px] px-3 py-[6px] text-[13px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] bg-white transition-all shadow-sm";
const lbl  = "block text-[13px] font-semibold text-[#1d2327] mb-1.5";
const hint = "text-[12px] text-[#646970] mt-1.5 italic leading-relaxed";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white border border-[#c3c4c7] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#c3c4c7] bg-[#f6f7f7]">
          <h2 className="text-[14px] font-bold text-[#1d2327] m-0">{loc._id ? "Edit" : "Add"} Pickup Location</h2>
          <button onClick={onClose} className="p-1 text-[#646970] hover:text-[#d63638]"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          <div>
            <label className={lbl}>Location Name <span className="text-red-500">*</span></label>
            <input className={inp} value={loc.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Lahore Flagship Store" />
          </div>

          <div>
            <label className={lbl}>Pickup Instructions</label>
            <textarea rows={3} className={`${inp} resize-none`} value={loc.instructions} onChange={e => set("instructions", e.target.value)} placeholder="Shown to the customer at checkout — e.g. opening hours, parking notes, what to bring…" />
            <p className={hint}>Customers see this alongside the address when they choose Local Pickup at checkout.</p>
          </div>

          <div className="bg-[#f6f7f7] border border-[#c3c4c7] p-4 space-y-3">
            <p className="text-[11px] font-bold text-[#646970] uppercase tracking-wider">Address</p>
            <div>
              <label className={lbl}>Street</label>
              <input className={inp} value={loc.address.street} onChange={e => setAddr("street", e.target.value)} placeholder="e.g. 123 Main Boulevard" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>City</label>
                <input className={inp} value={loc.address.city} onChange={e => setAddr("city", e.target.value)} placeholder="e.g. Lahore" />
              </div>
              <div>
                <label className={lbl}>State / Province</label>
                <input className={inp} value={loc.address.state} onChange={e => setAddr("state", e.target.value)} placeholder="e.g. Punjab" />
              </div>
              <div>
                <label className={lbl}>ZIP / Postal Code</label>
                <input className={inp} value={loc.address.zip} onChange={e => setAddr("zip", e.target.value)} placeholder="e.g. 54000" />
              </div>
              <div>
                <label className={lbl}>Country</label>
                <select className={inp} value={loc.address.country} onChange={e => setAddr("country", e.target.value)}>
                  <option value="">— Select country —</option>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Phone</label>
              <input className={inp} value={loc.phone} onChange={e => set("phone", e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input className={inp} value={loc.email} onChange={e => set("email", e.target.value)} placeholder="Optional" />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Status</label>
              <select className={inp} value={loc.status} onChange={e => set("status", e.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <p className={hint}>Inactive locations will not be offered as a pickup option at checkout.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#c3c4c7] bg-[#f6f7f7]">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-[12px] text-[#2271b1] border border-[#c3c4c7] bg-white rounded-[3px] hover:bg-[#f6f7f7] font-semibold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2271b1] border border-[#2271b1] text-white text-[12px] font-bold rounded-[3px] hover:bg-[#135e96] disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Location"}
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
    const ok = await showConfirm("Delete this pickup location? Shipping methods pointing to it will fall back to no specific location.");
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
    <AdminPageLayout
      title="Pickup locations"
      breadcrumbs={[{ label: "Settings" }, { label: "Shipping", href: "/admin/settings/shipping" }, { label: "Pickup Locations" }]}
    >
      <NavTabs activeTab="pickup-locations" />

      {/* WordPress Style Notice Callout */}
      <div className="bg-white border-l-4 border-[#72aee6] shadow-sm p-4 mb-6 text-[13.5px] text-[#1d2327]">
        <p className="font-semibold mb-1">Local Pickup Locations</p>
        <p className="text-[#646970] leading-relaxed">
          Add the store locations customers can pick up orders from, then attach one to a Local Pickup shipping
          method under any shipping zone. The location&apos;s address and instructions are shown to the customer at checkout.
        </p>
      </div>

      <div className="bg-white border border-[#c3c4c7] shadow-sm mb-5 rounded-none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#c3c4c7] bg-white">
          <h2 className="text-[14px] font-bold text-[#1d2327] m-0">Pickup Locations</h2>
          <button
            onClick={() => { setEditing(null); setShowModal(true); }}
            className="bg-white border border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fb] px-2.5 py-1 rounded-[3px] text-[11.5px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />Add Pickup Location
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-[13px] text-[#646970]">
              <Loader2 className="w-4 h-4 animate-spin" />Loading pickup locations…
            </div>
          ) : locations.length === 0 ? (
            <div className="border border-dashed border-[#c3c4c7] bg-[#f6f7f7] p-10 text-center">
              <Store className="w-8 h-8 text-[#ccd0d4] mx-auto mb-2" />
              <p className="text-[12.5px] font-bold text-[#1d2327]">No pickup locations yet</p>
              <p className="text-[11.5px] text-[#646970]">Add a location above so it can be attached to a Local Pickup shipping method.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full border border-[#c3c4c7] bg-white">
              <table className="wp-list-table widefat striped posts w-full border-collapse bg-white text-left text-[13px]">
              <thead>
                <tr className="bg-[#f6f7f7] border-b border-[#c3c4c7] text-[#2c3338]">
                  <th className="px-3 py-2 font-bold w-[30%]">Name</th>
                  <th className="px-3 py-2 font-bold w-[28%]">Address</th>
                  <th className="px-3 py-2 font-bold w-[22%]">Contact</th>
                  <th className="px-3 py-2 font-bold w-[10%]">Status</th>
                  <th className="px-3 py-2 font-bold w-[10%] text-center"></th>
                </tr>
              </thead>
              <tbody>
                {locations.map(l => (
                  <tr key={l._id} className="hover:bg-[#f0f6fb] border-b border-[#f0f0f1] last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-[#1d2327] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#2271b1] shrink-0" />{l.name}
                      </span>
                      {l.instructions && <p className="text-[11px] text-[#646970] mt-0.5 truncate max-w-[240px]">{l.instructions}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-[#646970]">
                      {[l.address?.city, l.address?.state, l.address?.country].filter(Boolean).join(", ") || <span className="italic text-[#a7aaad]">Not set</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[#646970]">
                      {l.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" />{l.phone}</div>}
                      {l.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3 shrink-0" />{l.email}</div>}
                      {!l.phone && !l.email && <span className="italic text-[#a7aaad]">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold uppercase border px-1.5 py-0.5 rounded-[2px] ${
                        l.status === "Active" ? "border-green-300 bg-green-50 text-green-700" : "border-[#c3c4c7] bg-[#f6f7f7] text-[#646970]"
                      }`}>{l.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setEditing(l); setShowModal(true); }} className="text-[#2271b1] hover:text-[#135e96] font-semibold text-[12px] hover:underline">Edit</button>
                        <span className="text-[#c3c4c7]">|</span>
                        <button onClick={() => handleDelete(l._id)} disabled={deleting === l._id} className="text-[#b32d2e] hover:text-[#d63638] font-semibold text-[12px] hover:underline">
                          {deleting === l._id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
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
    </AdminPageLayout>
  );
}
