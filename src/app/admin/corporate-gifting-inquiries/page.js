"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";
import { Eye, Trash2, Search, ChevronLeft, ChevronRight, X, FileText } from "lucide-react";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

const STATUS_COLORS = {
  New: "bg-blue-100 text-blue-700 border-blue-200",
  Contacted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Quoted: "bg-indigo-100 text-indigo-700 border-indigo-200",
  "In Progress": "bg-purple-100 text-purple-700 border-purple-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200"
};
const ALL_STATUSES = ["New", "Contacted", "Quoted", "In Progress", "Completed", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High"];

const Detail = ({ label, value }) =>
  value ? (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#646970]">{label}</p>
      <p className="text-[#1d2327] font-medium mt-0.5 break-words">{value}</p>
    </div>
  ) : null;

function DetailModal({ inquiry, onClose, onSaved }) {
  const [status, setStatus] = useState(inquiry.status);
  const [priority, setPriority] = useState(inquiry.priority || "Medium");
  const [notes, setNotes] = useState(inquiry.adminNotes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/corporate-gifting-inquiries/${inquiry._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, priority, adminNotes: notes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Inquiry updated");
      onSaved(data);
      onClose();
    } catch (e) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const isImage = (u) => /\.(png|jpe?g|webp|svg|gif)$/i.test(u || "");

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-[16px] font-bold text-[#1d2327]">{inquiry.company}</h2>
            <p className="text-[12px] text-[#646970]">{inquiry.contactName} · {inquiry.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 text-[13px]">
            <Detail label="Phone" value={inquiry.phone} />
            <Detail label="Location" value={[inquiry.city, inquiry.country].filter(Boolean).join(", ")} />
            <Detail label="Submitted" value={new Date(inquiry.createdAt).toLocaleString()} />
          </div>

          <hr className="border-gray-100" />

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 text-[13px]">
            <Detail label="Occasion" value={inquiry.occasion} />
            <Detail label="Number of packs" value={inquiry.quantity} />
            <Detail label="Budget per pack" value={inquiry.budget} />
            <Detail label="Needed by" value={inquiry.deliveryDate} />
            <Detail label="Branding" value={inquiry.branding} />
            <Detail label="Packaging" value={inquiry.packaging} />
            <Detail label="Leather" value={inquiry.leather} />
            <Detail label="Brand colors" value={inquiry.brandColors} />
            <Detail label="Greeting card" value={inquiry.greetingCard ? "Yes" : ""} />
          </div>

          {inquiry.items?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#646970] mb-2">Items in pack</p>
              <div className="flex flex-wrap gap-1.5">
                {inquiry.items.map((i) => (
                  <span key={i} className="text-[12px] bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{i}</span>
                ))}
              </div>
            </div>
          )}

          {inquiry.notes && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#646970] mb-2">Notes</p>
              <p className="text-[13px] text-[#1d2327] leading-relaxed bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{inquiry.notes}</p>
            </div>
          )}

          {inquiry.logos?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#646970] mb-2">Logo files ({inquiry.logos.length})</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {inquiry.logos.map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                    {isImage(l.url) ? (
                      <img src={l.url} alt={l.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="flex flex-col items-center text-[10px] text-gray-500 p-1 text-center break-all"><FileText className="w-5 h-5 mb-1" />{l.name}</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {inquiry.referenceImages?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#646970] mb-2">Reference images ({inquiry.referenceImages.length})</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {inquiry.referenceImages.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden border border-gray-100">
                    <img src={u} alt={`Reference ${i + 1}`} className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <hr className="border-gray-100" />

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-2">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] w-full outline-none focus:border-[#2271b1]">
                {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-2">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] w-full outline-none focus:border-[#2271b1]">
                {PRIORITIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-2">Admin notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes (not visible to the customer)..."
              className="border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] w-full outline-none focus:border-[#2271b1] resize-none"
            />
          </div>
        </div>

        <div className="p-3 sm:p-6 border-t border-gray-100 flex flex-col-reverse xs:flex-row xs:justify-end gap-2 sm:gap-3">
          <button onClick={onClose} className="border border-[#8c8f94] text-[#3c434a] px-4 py-1.5 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Cancel</button>
          <button onClick={save} disabled={saving} className="bg-[#2271b1] text-white px-4 py-1.5 rounded-[3px] text-[13px] font-medium hover:bg-[#135e96] disabled:opacity-60">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CorporateGiftingInquiriesPage() {
  const { showConfirm } = usePopup();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [counts, setCounts] = useState({});
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/corporate-gifting-inquiries?${params}`);
      const data = await res.json();
      if (res.ok) {
        setInquiries(data.items || []);
        setPagination(data.pagination || {});
        setCounts(data.counts || {});
      }
    } catch {
      toast.error("Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id) => {
    if (!(await showConfirm("Move this inquiry to trash?"))) return;
    const res = await fetch(`/api/admin/corporate-gifting-inquiries/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Inquiry removed"); load(); } else toast.error("Failed to delete");
  };

  return (
    <RequirePermission permission="submissions.view">
      <AdminPageLayout title="Corporate Gifting Inquiries">
        <div className="space-y-4">
          <ul className="flex flex-wrap items-center gap-2 text-[13px] text-[#2271b1]">
            {[["all", "All"], ...ALL_STATUSES.map((s) => [s, s])].map(([val, label]) => (
              <li key={val} className="flex items-center gap-1">
                <button onClick={() => { setStatusFilter(val); setPage(1); }} className={`hover:text-[#135e96] ${statusFilter === val ? "text-[#1d2327] font-semibold" : ""}`}>
                  {label} <span className="text-[#646970] font-normal">({counts[val] || 0})</span>
                </button>
                {val !== "Cancelled" && <span className="text-[#c3c4c7]">|</span>}
              </li>
            ))}
          </ul>

          <div className="bg-white border border-[#ccd0d4] p-2 sm:p-3 flex items-center gap-2 shadow-sm">
            <input
              type="text"
              placeholder="Search by company, contact, email, occasion..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="border border-[#8c8f94] outline-none px-3 py-1 text-[13px] w-full max-w-sm bg-white focus:border-[#2271b1] rounded-[3px]"
            />
            <Search className="w-3.5 h-3.5 text-gray-400" />
          </div>

          <div className="bg-white border border-[#ccd0d4] overflow-x-auto max-w-full shadow-sm">
            <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
              <thead>
                <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                  {["Company", "Contact", "Occasion", "Packs", "Status", "Date", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-2 font-bold text-[#1d2327]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f1]">
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center italic text-gray-400">Loading inquiries...</td></tr>
                ) : inquiries.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center italic text-gray-400">No inquiries found.</td></tr>
                ) : (
                  inquiries.map((inq) => (
                    <tr key={inq._id} className="hover:bg-[#f6f7f7] group transition-colors">
                      <td className="px-4 py-3 font-medium text-[#1d2327]">{inq.company}</td>
                      <td className="px-4 py-3 text-[#646970]">{inq.contactName}<br /><span className="text-[12px] break-all">{inq.email}</span></td>
                      <td className="px-4 py-3 text-[#646970]">{inq.occasion || "—"}</td>
                      <td className="px-4 py-3 text-[#646970]">{inq.quantity || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[inq.status] || "bg-gray-100 text-gray-600"}`}>{inq.status}</span>
                      </td>
                      <td className="px-4 py-3 text-[#646970]">{new Date(inq.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setSelected(inq)} className="flex items-center gap-1 text-[#2271b1] hover:text-[#135e96] text-[12px] font-medium">
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          <button onClick={() => remove(inq._id)} className="flex items-center gap-1 text-[#d63638] hover:text-[#bc0b0d] text-[12px] font-medium">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center gap-2 text-[13px]">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="border border-[#ccd0d4] px-2 py-1 rounded-[3px] disabled:opacity-40 hover:bg-[#f6f7f7]">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[#646970]">Page {page} of {pagination.pages}</span>
              <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="border border-[#ccd0d4] px-2 py-1 rounded-[3px] disabled:opacity-40 hover:bg-[#f6f7f7]">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {selected && (
          <DetailModal
            inquiry={selected}
            onClose={() => setSelected(null)}
            onSaved={(u) => setInquiries((prev) => prev.map((i) => (i._id === u._id ? u : i)))}
          />
        )}
      </AdminPageLayout>
    </RequirePermission>
  );
}
