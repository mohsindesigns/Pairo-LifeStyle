"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Shield, Mail, Key, ArrowLeft, Save, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

export default function InviteStaff() {
  const router = useRouter();
  const [roles, setRoles] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    roleId: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRoles = async () => {
      const res = await fetch("/api/admin/roles");
      const data = await res.json();
      if (res.ok) setRoles(data);
    };
    fetchRoles();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        router.push("/admin/settings/team");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create staff member");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminPageLayout 
      title="Invite Staff Member" 
      breadcrumbs={[{ label: "Team", href: "/admin/settings/team" }, { label: "New Member" }]}
    >
      <div className="max-w-2xl mx-auto space-y-6">
         <Link href="/admin/settings/team" className="text-[#2271b1] hover:text-[#135e96] flex items-center gap-1 text-[13px] font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Team
         </Link>

         <div className="bg-white border border-[#ccd0d4] shadow-sm">
            <div className="p-6 border-b border-[#ccd0d4] bg-[#f6f7f7]">
               <h3 className="text-[14px] font-bold text-[#1d2327] uppercase flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Account Details
               </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-[13px] font-bold text-[#1d2327]">Full Name</label>
                     <input 
                        type="text" 
                        required
                        className="w-full border border-[#8c8f94] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[13px] font-bold text-[#1d2327]">Email Address</label>
                     <input 
                        type="email" 
                        required
                        className="w-full border border-[#8c8f94] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                     />
                  </div>
               </div>

               <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Initial Password</label>
                  <div className="relative">
                     <input 
                        type={showPassword ? "text" : "password"} 
                        required
                        className="w-full border border-[#8c8f94] pl-3 pr-10 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                     />
                     <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                     >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                     </button>
                  </div>
                  <p className="text-[11px] text-[#646970]">The user will be prompted to change this on their first login.</p>
               </div>

               <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Administrative Role</label>
                  <select 
                     required
                     className="w-full border border-[#8c8f94] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                     value={formData.roleId}
                     onChange={(e) => setFormData({...formData, roleId: e.target.value})}
                  >
                     <option value="">Select a role...</option>
                     {roles.map((role) => (
                        <option key={role._id} value={role._id}>{role.name}</option>
                     ))}
                  </select>
               </div>

               <div className="pt-4 border-t border-[#f0f0f1] flex justify-end">
                  <button 
                     type="submit" 
                     disabled={loading}
                     className="bg-[#2271b1] text-white px-6 py-2 rounded font-bold text-[13px] hover:bg-[#135e96] flex items-center gap-2 transition-all"
                  >
                     <Save className="w-4 h-4" /> {loading ? "Inviting..." : "Create Staff Member"}
                  </button>
               </div>
            </form>
         </div>
      </div>
    </AdminPageLayout>
  );
}
