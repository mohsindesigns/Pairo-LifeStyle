"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";
import { Eye, Trash2, Search, ChevronLeft, ChevronRight, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePopup } from "@/context/PopupContext";

const STATUS_COLORS = {
  New: "bg-blue-100 text-blue-700 border-blue-200",
  Contacted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  "In Progress": "bg-purple-100 text-purple-700 border-purple-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200"
};

const ALL_STATUSES = ["New", "Contacted", "In Progress", "Completed", "Cancelled"];

function DetailModal({ inquiry, onClose, onStatusChange }) {
  const [status, setStatus] = useState(inquiry.status);
  const [notes, setNotes] = useState(inquiry.adminNotes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/custom-jacket-inquiries/${inquiry._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes: notes })
      });
      if (res.ok) {
        toast.success("Inquiry updated");
        onStatusChange(inquiry._id, status, notes);
        onClose();
      } else {
        toast.error("Failed to update");
      }
    } catch {
      toast.error("Error saving changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-lg text-[#1d2327]">
              {inquiry.firstName} {inquiry.lastName}
            </h2>
            <p className="text-[13px] text-[#646970]">{inquiry.email}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Personal Info */}
          <div className="grid grid-cols-2 gap-4 text-[13px]">
            {[
              ["Phone", inquiry.phone],
              ["Country", inquiry.country],
              ["City", inquiry.city],
              ["Submitted", new Date(inquiry.createdAt).toLocaleString()]
            ].map(([label, val]) => val ? (
              <div key={label}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#646970]">{label}</p>
                <p className="text-[#1d2327] font-medium mt-0.5">{val}</p>
              </div>
            ) : null)}
          </div>

          <hr className="border-gray-100" />

          {/* Jacket Specs */}
          <div className="grid grid-cols-2 gap-4 text-[13px]">
            {[
              ["Jacket Type", inquiry.jacketType],
              ["Gender", inquiry.gender],
              ["Leather", inquiry.preferredLeather],
              ["Color", inquiry.preferredColor],
              ["Size", inquiry.size],
              ["Budget", inquiry.budget],
              ["Deadline", inquiry.deadline]
            ].map(([label, val]) => val ? (
              <div key={label}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#646970]">{label}</p>
                <p className="text-[#1d2327] font-medium mt-0.5">{val}</p>
              </div>
            ) : null)}
          </div>

          {/* Notes */}
          {inquiry.additionalNotes && (
            <>
              <hr className="border-gray-100" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#646970] mb-2">Additional Notes</p>
                <p className="text-[13px] text-[#1d2327] leading-relaxed bg-gray-50 p-3 rounded-lg">
                  {inquiry.additionalNotes}
                </p>
              </div>
            </>
          )}

          {/* Reference Images */}
          {inquiry.referenceImages?.length > 0 && (
            <>
              <hr className="border-gray-100" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#646970] mb-3">
                  Reference Images ({inquiry.referenceImages.length})
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {inquiry.referenceImages.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden border border-gray-100 group">
                      <img src={url} alt={`Reference ${i + 1}`} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          <hr className="border-gray-100" />

          {/* Status + Notes */}
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-2">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] w-full outline-none focus:border-[#2271b1]"
              >
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-2">Admin Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes (not visible to customer)..."
                className="border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] w-full outline-none focus:border-[#2271b1] resize-none"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="border border-[#8c8f94] text-[#3c434a] px-4 py-1.5 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="bg-[#2271b1] text-white px-4 py-1.5 rounded-[3px] text-[13px] font-medium hover:bg-[#135e96] disabled:opacity-60">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomJacketInquiriesPage() {
  const { showConfirm } = usePopup();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [counts, setCounts] = useState({});
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/custom-jacket-inquiries?${params}`);
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

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const handleStatusChange = (id, newStatus, newNotes) => {
    setInquiries(prev => prev.map(i => i._id === id ? { ...i, status: newStatus, adminNotes: newNotes } : i));
  };

  const handleDelete = async (id) => {
    const ok = await showConfirm("Move this inquiry to trash?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/custom-jacket-inquiries/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Inquiry removed");
        fetchInquiries();
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <AdminPageLayout title="Custom Jacket Inquiries">
      <div className="space-y-4">
        {/* Status Tabs */}
        <ul className="flex flex-wrap items-center gap-2 text-[13px] text-[#2271b1]">
          {[["all", "All"], ...ALL_STATUSES.map(s => [s, s])].map(([val, label]) => (
            <li key={val} className="flex items-center gap-1">
              <button
                onClick={() => { setStatusFilter(val); setPage(1); }}
                className={`hover:text-[#135e96] ${statusFilter === val ? "text-[#1d2327] font-semibold" : ""}`}
              >
                {label} <span className="text-[#646970] font-normal">({counts[val] || 0})</span>
              </button>
              {val !== "Cancelled" && <span className="text-[#c3c4c7]">|</span>}
            </li>
          ))}
        </ul>

        {/* Search */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex items-center gap-2 shadow-sm">
          <input
            type="text"
            placeholder="Search by name, email, jacket type..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="border border-[#8c8f94] outline-none px-3 py-1 text-[13px] w-full max-w-sm bg-white focus:border-[#2271b1] rounded-[3px]"
          />
          <button className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse text-[13px] min-w-[800px]">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                <th className="px-4 py-2 font-bold text-[#1d2327]">Name</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Email</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Jacket Type</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Status</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Date</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center italic text-gray-400">Loading inquiries...</td></tr>
              ) : inquiries.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center italic text-gray-400">No inquiries found.</td></tr>
              ) : (
                inquiries.map(inq => (
                  <tr key={inq._id} className="hover:bg-[#f6f7f7] group transition-colors">
                    <td className="px-4 py-3 font-medium text-[#1d2327]">
                      {inq.firstName} {inq.lastName}
                      {inq.referenceImages?.length > 0 && (
                        <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {inq.referenceImages.length} img
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#646970]">{inq.email}</td>
                    <td className="px-4 py-3 text-[#646970]">{inq.jacketType || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[inq.status] || "bg-gray-100 text-gray-600"}`}>
                        {inq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#646970]">
                      {new Date(inq.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setSelectedInquiry(inq)}
                          className="flex items-center gap-1 text-[#2271b1] hover:text-[#135e96] text-[12px] font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          onClick={() => handleDelete(inq._id)}
                          className="flex items-center gap-1 text-[#d63638] hover:text-[#bc0b0d] text-[12px] font-medium"
                        >
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

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center gap-2 text-[13px]">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border border-[#ccd0d4] px-2 py-1 rounded-[3px] disabled:opacity-40 hover:bg-[#f6f7f7]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[#646970]">Page {page} of {pagination.pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="border border-[#ccd0d4] px-2 py-1 rounded-[3px] disabled:opacity-40 hover:bg-[#f6f7f7]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedInquiry && (
        <DetailModal
          inquiry={selectedInquiry}
          onClose={() => setSelectedInquiry(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </AdminPageLayout>
  );
}
