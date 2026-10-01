"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { ChevronLeft, ChevronRight, Trash2, Mail, Phone, MapPin, Clock } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";
import { useSession } from "next-auth/react";
import { usePopup } from "@/context/PopupContext";
import { BADGE_COLORS, DEFAULT_BADGE_COLOR } from "@/lib/statusBadgeColors";
import { can } from "@/lib/rbac";

export default function AbandonedCartsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { showConfirm } = usePopup();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [pagination, setPagination] = useState({ total: 0, pages: 1, currentPage: 1 });
  const [expanded, setExpanded] = useState(null);

  const fetchItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/abandoned-carts?page=${page}&status=${statusFilter}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
        setPagination(data.pagination);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => fetchItems(1), 400);
    return () => clearTimeout(t);
  }, [fetchItems]);

  const handleDelete = async (id) => {
    const ok = await showConfirm("Delete this abandoned cart record permanently?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/abandoned-carts?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted");
        fetchItems(pagination.currentPage);
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const getStatusBadge = (status) => {
    const styles = { active: BADGE_COLORS.amber, recovered: BADGE_COLORS.green };
    return styles[status] || DEFAULT_BADGE_COLOR;
  };

  if (sessionStatus === "loading") return null;

  if (!can(session?.user, "orders.view")) {
    return (
      <AdminPageLayout title="Abandoned Carts" breadcrumbs={[{ label: "Commerce", href: "/admin/orders" }, { label: "Abandoned Carts" }]}>
        <div className="bg-white border border-[#ccd0d4] p-6 text-[13px] text-[#646970]">
          You don&apos;t have permission to view this page.
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Abandoned Carts"
      breadcrumbs={[{ label: "Commerce", href: "/admin/orders" }, { label: "Abandoned Carts" }]}
      subtitle="Checkout sessions where a shopper started entering their details but hasn't completed (or has completed) an order."
    >
      <div className="space-y-4">
        <div className="bg-white border border-[#ccd0d4] p-2 sm:p-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4 shadow-sm font-sans">
          <div className="flex items-center gap-1.5">
            <select
              className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1.5 rounded-[3px] outline-none cursor-pointer focus:border-[#2271b1]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="active">Not Yet Completed</option>
              <option value="recovered">Completed (Recovered)</option>
              <option value="all">All</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-[#8c8f94] outline-none px-3 py-1.5 text-[13px] bg-white focus:border-[#2271b1] rounded-[3px] w-full md:w-64"
          />
        </div>

        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse text-[13px] min-w-[700px] font-sans">
            <thead>
              <tr className="border-b border-[#ccd0d4] bg-[#f6f7f7] text-[#2c3539]">
                <th className="px-3 py-2.5 font-bold text-[#1d2327]">Customer</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327]">Location</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327]">Cart</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327]">Status</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327]">Last Activity</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1] text-[#2c3539]">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center italic text-gray-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center italic text-gray-400">No abandoned carts found.</td></tr>
              ) : (
                items.map((item) => (
                  <Fragment key={item._id}>
                    <tr
                      className="hover:bg-[#f6f7f7] cursor-pointer transition-colors"
                      onClick={() => setExpanded(expanded === item._id ? null : item._id)}
                    >
                      <td className="px-3 py-3 align-top">
                        <p className="font-bold text-black">
                          {item.shippingAddress?.fullName || `${item.contact?.firstName || ""} ${item.contact?.lastName || ""}`.trim() || "Unknown"}
                        </p>
                        {item.contact?.email && (
                          <p className="text-[11px] text-[#2271b1] flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{item.contact.email}</p>
                        )}
                        {item.contact?.phone && (
                          <p className="text-[11px] text-[#646970] flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{item.contact.phone}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-[#646970]">
                        <p className="flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />
                          {[item.shippingAddress?.city, item.shippingAddress?.state, item.shippingAddress?.country].filter(Boolean).join(", ") || "—"}
                        </p>
                        <p className="text-[11px] mt-0.5">IP: {item.ipAddress || "—"}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-semibold text-black">{item.items?.length || 0} item(s)</p>
                        <p className="text-[11px] text-[#646970]">${(item.cartTotal || item.cartSubtotal || 0).toLocaleString()}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={`inline-block px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(item.status)}`}>
                          {item.status === "recovered" ? "Completed" : "In Progress"}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-[#646970]">
                        <p className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(item.updatedAt).toLocaleString()}</p>
                        <p className="text-[11px] mt-0.5">Started: {new Date(item.createdAt).toLocaleString()}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
                          className="text-[#bc0b0d] hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    {expanded === item._id && (
                      <tr>
                        <td colSpan={6} className="px-3 py-3 bg-[#fbfbfb] border-t border-[#f0f0f1]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px]">
                            <div>
                              <p className="font-bold text-[#1d2327] mb-1.5 uppercase tracking-wide text-[10px]">Shipping Address Entered</p>
                              <p>{item.shippingAddress?.fullName || "—"}</p>
                              <p>{item.shippingAddress?.street || "—"}</p>
                              <p>{[item.shippingAddress?.city, item.shippingAddress?.state, item.shippingAddress?.zip].filter(Boolean).join(", ") || "—"}</p>
                              <p>{item.shippingAddress?.country || "—"}</p>
                              <p>{item.shippingAddress?.phone || "—"}</p>
                            </div>
                            <div>
                              <p className="font-bold text-[#1d2327] mb-1.5 uppercase tracking-wide text-[10px]">Cart Items</p>
                              {(item.items || []).length === 0 ? <p className="text-[#646970] italic">No items</p> : (
                                <ul className="space-y-1">
                                  {item.items.map((it, idx) => (
                                    <li key={idx} className="flex items-center gap-2">
                                      {it.image && <img src={it.image} alt="" className="w-6 h-6 object-cover rounded-[2px] border border-[#e0e0e0]" />}
                                      <span>{it.name} × {it.quantity} — ${((it.price || 0) * (it.quantity || 1)).toLocaleString()}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-[13px] text-[#646970] font-sans">
          <p>{pagination.total} items</p>
          <div className="flex items-center gap-1">
            <button disabled={pagination.currentPage === 1} onClick={() => fetchItems(pagination.currentPage - 1)} className="p-1 border border-[#ccd0d4] bg-[#f6f7f7] hover:bg-[#f0f0f1] rounded disabled:opacity-50 cursor-pointer">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="px-2">{pagination.currentPage} of {pagination.pages}</span>
            <button disabled={pagination.currentPage === pagination.pages} onClick={() => fetchItems(pagination.currentPage + 1)} className="p-1 border border-[#ccd0d4] bg-[#f6f7f7] hover:bg-[#f0f0f1] rounded disabled:opacity-50 cursor-pointer">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
