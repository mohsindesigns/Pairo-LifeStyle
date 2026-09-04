"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Search, Shield, Mail, Key, UserCheck, UserX, MoreVertical, Lock, Eye, EyeOff, Trash2, X } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "react-hot-toast";

export default function StaffManagement() {
  const router = useRouter();
  const { session } = useRBAC();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState({ open: false, id: null, name: "", loading: false });
  const [passwordTarget, setPasswordTarget] = useState({ open: false, id: null, name: "", password: "", showPass: false, loading: false });

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/admin/staff");
      const data = await res.json();
      if (res.ok) setStaff(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchStaff();
    });
  }, []);

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    try {
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setStaff(staff.map(s => s._id === id ? { ...s, status: newStatus } : s));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDeleteStaff = async () => {
    if (!deleteTarget.id) return;
    setDeleteTarget(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/admin/staff/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setStaff(staff.filter(s => s._id !== deleteTarget.id));
        toast.success(`Staff member "${deleteTarget.name}" deleted successfully.`);
        setDeleteTarget({ open: false, id: null, name: "", loading: false });
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to delete staff member.");
        setDeleteTarget(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting staff member.");
      setDeleteTarget(prev => ({ ...prev, loading: false }));
    }
  };

  const submitResetPassword = async (e) => {
    e?.preventDefault();
    if (!passwordTarget.password || passwordTarget.password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setPasswordTarget(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/admin/staff/${passwordTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordTarget.password })
      });
      if (res.ok) {
        toast.success(`Password for "${passwordTarget.name}" updated successfully!`);
        setPasswordTarget({ open: false, id: null, name: "", password: "", showPass: false, loading: false });
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reset password");
        setPasswordTarget(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error(err);
      toast.error("Error resetting password");
      setPasswordTarget(prev => ({ ...prev, loading: false }));
    }
  };

  const filteredStaff = staff.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminPageLayout 
      title="Team Management" 
      addNewLink="/admin/settings/team/new"
      addNewLabel="Invite Staff Member"
      breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Team" }]}
    >
      <div className="space-y-4">
        {/* Statistics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#ccd0d4] p-4 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-[#f0f6fb] text-[#2271b1] rounded-full"><Shield className="w-5 h-5" /></div>
            <div><p className="text-[11px] font-bold text-[#646970] uppercase">Total Admins</p><p className="text-xl font-bold">{staff.length}</p></div>
          </div>
          <div className="bg-white border border-[#ccd0d4] p-4 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-[#f6f7f7] text-[#1d2327] rounded-full"><UserCheck className="w-5 h-5" /></div>
            <div><p className="text-[11px] font-bold text-[#646970] uppercase">Active Sessions</p><p className="text-xl font-bold">{staff.filter(s => s.status === 'Active').length}</p></div>
          </div>
          <div className="bg-white border border-[#ccd0d4] p-4 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-red-50 text-red-600 rounded-full"><UserX className="w-5 h-5" /></div>
            <div><p className="text-[11px] font-bold text-[#646970] uppercase">Suspended</p><p className="text-xl font-bold text-red-600">{staff.filter(s => s.status !== 'Active').length}</p></div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
           <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c8f94]" />
              <input 
                type="text" 
                placeholder="Search staff by name or email..."
                className="w-full pl-10 pr-4 py-1.5 bg-white border border-[#8c8f94] text-[13px] focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="flex items-center gap-2">
              <select className="border border-[#8c8f94] text-[13px] px-3 py-1.5 outline-none focus:border-[#2271b1]">
                 <option>All Roles</option>
                 <option>Super Admin</option>
                 <option>Admin</option>
                 <option>Editor</option>
              </select>
              <button className="bg-white border border-[#2271b1] text-[#2271b1] px-4 py-1.5 font-bold text-[13px] hover:bg-[#f0f6fb]">Filter</button>
           </div>
        </div>

        {/* Staff Table */}
        <div className="bg-white border border-[#ccd0d4] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4] text-[#1d2327]">
                <th className="px-4 py-3 font-bold uppercase text-[11px]">Staff Member</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px]">Role</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px]">Status</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px]">Last Login</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center italic text-gray-400">Loading team members...</td></tr>
              ) : filteredStaff.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center italic text-gray-400">No staff members found.</td></tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr key={s._id} className="hover:bg-[#fbfbfb] group transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-[#f0f6fb] border border-[#2271b1]/10 rounded-full flex items-center justify-center text-[#2271b1] font-bold">
                            {s.name?.charAt(0)}
                         </div>
                         <div className="flex flex-col">
                            <span className="font-bold text-[#1d2327]">{s.name}</span>
                            <div className="flex items-center gap-2 text-[11px] text-[#646970]">
                               <Mail className="w-3 h-3" /> {s.email}
                            </div>
                         </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider ${
                        s.roleId?.slug === 'super-admin' ? 'bg-[#2271b1] text-white' : 'bg-[#d9ebf5] text-[#1a4a6e]'
                      }`}>
                        {s.roleId?.name || "No Role"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                       {s.roleId?.slug === 'super-admin' || s._id === session?.user?.id ? (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 text-gray-400 cursor-default">
                             <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                             {s.status}
                          </div>
                       ) : (
                          <button 
                            onClick={() => toggleStatus(s._id, s.status)}
                            className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded transition-colors ${
                              s.status === 'Active' ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'
                            }`}
                          >
                             <div className={`w-1.5 h-1.5 rounded-full ${s.status === 'Active' ? 'bg-green-600' : 'bg-red-600'}`} />
                             {s.status}
                          </button>
                       )}
                    </td>
                    <td className="px-4 py-4 text-[#646970]">
                       {s.security?.lastLogin ? new Date(s.security.lastLogin).toLocaleString() : "Never"}
                    </td>
                     <td className="px-4 py-4 text-center">
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 justify-end transition-opacity">
                            {s.roleId?.slug !== 'super-admin' && s._id !== session?.user?.id && (
                               <button 
                                 title="Delete Staff Member" 
                                 onClick={() => setDeleteTarget({ open: true, id: s._id, name: s.name, loading: false })}
                                 className="p-1.5 text-[#646970] hover:text-red-600 hover:bg-red-50 rounded"
                               >
                                 <UserX className="w-4 h-4" />
                               </button>
                            )}
                            {s.roleId?.slug === 'super-admin' && (
                               <div title="System Protected" className="p-1.5 text-gray-300">
                                  <Lock className="w-4 h-4" />
                               </div>
                            )}
                            <button 
                              title="Reset Password" 
                              onClick={() => setPasswordTarget({ open: true, id: s._id, name: s.name, password: "", showPass: false, loading: false })}
                              className="p-1.5 text-[#646970] hover:text-[#2271b1] hover:bg-[#f0f6fb] rounded"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button 
                              title="Edit Member" 
                              onClick={() => router.push(`/admin/settings/team/${s._id}`)}
                              className="p-1.5 text-[#646970] hover:text-[#2271b1] hover:bg-[#f0f6fb] rounded"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                         </div>
                      </td>
                   </tr>
                 ))
              )}
            </tbody>
          </table>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteTarget.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
              onClick={() => !deleteTarget.loading && setDeleteTarget({ open: false, id: null, name: "", loading: false })} 
            />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden z-10 animate-in zoom-in-95">
              <div className="h-1 bg-red-500 w-full" />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">Delete Staff Member</h3>
                    <p className="text-xs text-neutral-500">Revoke administrative access</p>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 mb-6">
                  Are you sure you want to delete <span className="font-semibold text-neutral-900">{deleteTarget.name}</span>? This action cannot be undone and will revoke their access immediately.
                </p>
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={deleteTarget.loading}
                    onClick={() => setDeleteTarget({ open: false, id: null, name: "", loading: false })}
                    className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-xs font-semibold hover:bg-neutral-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteTarget.loading}
                    onClick={confirmDeleteStaff}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 active:scale-[0.98] transition-all flex items-center gap-2"
                  >
                    {deleteTarget.loading ? "Deleting..." : "Delete Member"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {passwordTarget.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
              onClick={() => !passwordTarget.loading && setPasswordTarget({ open: false, id: null, name: "", password: "", showPass: false, loading: false })} 
            />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden z-10 animate-in zoom-in-95">
              <div className="h-1 bg-[#2271b1] w-full" />
              <form onSubmit={submitResetPassword} className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#f0f6fb] flex items-center justify-center text-[#2271b1]">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">Update Password</h3>
                    <p className="text-xs text-neutral-500">For {passwordTarget.name}</p>
                  </div>
                </div>
                <div className="space-y-3 mb-6">
                  <label className="block text-xs font-semibold text-neutral-700">
                    New Password <span className="text-neutral-400 font-normal">(min. 6 characters)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={passwordTarget.showPass ? "text" : "password"}
                      autoFocus
                      required
                      minLength={6}
                      placeholder="Enter new password..."
                      value={passwordTarget.password}
                      onChange={(e) => setPasswordTarget(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full pl-3 pr-10 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordTarget(prev => ({ ...prev, showPass: !prev.showPass }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {passwordTarget.showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={passwordTarget.loading}
                    onClick={() => setPasswordTarget({ open: false, id: null, name: "", password: "", showPass: false, loading: false })}
                    className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-xs font-semibold hover:bg-neutral-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordTarget.loading}
                    className="px-4 py-2 rounded-lg bg-[#2271b1] text-white text-xs font-semibold hover:bg-[#135e96] active:scale-[0.98] transition-all flex items-center gap-2"
                  >
                    {passwordTarget.loading ? "Saving..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
