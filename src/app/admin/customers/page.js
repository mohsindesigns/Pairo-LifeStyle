"use client";

import { useEffect, useState } from "react";
import { Search, User as UserIcon, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/admin/customers");
      const data = await res.json();
      if (res.ok) setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCustomers();
    });
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminPageLayout 
      title="Customers" 
      addNewLink="/admin/customers/new"
      addNewLabel="Add New"
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Customers" }]}
    >
      <div className="space-y-4">
        {/* Filter Links */}
        <ul className="flex items-center gap-2 text-[13px] text-[#2271b1]">
           <li className="text-[#1d2327] font-bold">All <span className="text-[#646970] font-normal">({customers.length})</span></li>
           <span className="text-[#c3c4c7]">|</span>
           <li className="cursor-pointer hover:text-[#135e96]">Active Customers</li>
        </ul>

        {/* Action Bar */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
           <div className="flex items-center gap-2">
              <select className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1 rounded-[3px] outline-none">
                 <option>Bulk actions</option>
                 <option>Delete</option>
              </select>
              <button className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Apply</button>
           </div>

           <div className="flex items-center gap-2 w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Search customers..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-[#8c8f94] outline-none px-3 py-1 text-[13px] flex-1 md:w-48 bg-white focus:border-[#2271b1] rounded-[3px]"
              />
              <button className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Search Customers</button>
           </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#ccd0d4] shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                <th className="px-3 py-2 w-10 text-center"><input type="checkbox" /></th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Username</th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Name</th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Email</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] text-right">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center italic text-gray-400">Loading customers...</td></tr>
              ) : filteredCustomers.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center italic text-gray-400">No customers found.</td></tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c._id} className="hover:bg-[#f6f7f7] group">
                    <td className="px-3 py-4 text-center"><input type="checkbox" /></td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-gray-50 border border-gray-200 rounded-[2px] flex items-center justify-center text-[#8c8f94]">
                            <UserIcon className="w-4 h-4" />
                         </div>
                          <div className="flex flex-col">
                             <Link href={`/admin/customers/${c._id}`} className="font-bold text-[#2271b1] hover:underline cursor-pointer">
                                {c.email?.split('@')[0]}
                             </Link>
                             <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#2271b1] mt-1 font-medium">
                                <Link href={`/admin/customers/${c._id}`} className="hover:text-[#135e96]">View History</Link>
                                <span className="text-[#c3c4c7]">|</span>
                                <button className="text-[#d63638] hover:text-[#bc0b0d]">Delete</button>
                             </div>
                          </div>
                       </div>
                    </td>
                    <td className="px-3 py-4 text-[#3c434a]">{c.name || "—"}</td>
                    <td className="px-3 py-4 text-[#2271b1] hover:underline cursor-pointer">
                       <Link href={`/admin/customers/${c._id}`}>{c.email}</Link>
                    </td>
                    <td className="px-3 py-4 text-right font-bold text-[#1d2327]">{c.orderCount || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-[13px] text-[#646970]">
           <div>{filteredCustomers.length} items</div>
           <div className="flex items-center gap-1">
              <button className="p-1 border border-[#ccd0d4] bg-white rounded disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-3">1 of 1</span>
              <button className="p-1 border border-[#ccd0d4] bg-white rounded disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
           </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
