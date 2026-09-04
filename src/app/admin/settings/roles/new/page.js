"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { ALL_PERMISSIONS } from "@/lib/rbac";
import { toast } from "react-hot-toast";

export default function CreateRole() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: {}
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success("Role created successfully!");
        router.push("/admin/settings/roles");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create role");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminPageLayout 
      title="Create New Role" 
      breadcrumbs={[{ label: "Roles", href: "/admin/settings/roles" }, { label: "New Role" }]}
    >
      <div className="max-w-2xl mx-auto space-y-6">
         <Link href="/admin/settings/roles" className="text-[#2271b1] hover:text-[#135e96] flex items-center gap-1 text-[13px] font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Roles
         </Link>

         <div className="bg-white border border-[#ccd0d4] shadow-sm">
            <div className="p-6 border-b border-[#ccd0d4] bg-[#f6f7f7]">
               <h3 className="text-[14px] font-bold text-[#1d2327] uppercase flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Role Definition
               </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
               <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Role Name</label>
                  <input 
                     type="text" 
                     required
                     placeholder="e.g. Marketing Manager"
                     className="w-full border border-[#8c8f94] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                     value={formData.name}
                     onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
               </div>

               <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Description</label>
                  <textarea 
                     rows={3}
                     className="w-full border border-[#8c8f94] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                     placeholder="What can users with this role do?"
                     value={formData.description}
                     onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
               </div>

               <div className="p-4 bg-[#f0f6fb] border border-[#2271b1]/10 rounded">
                  <p className="text-[13px] text-[#135e96] font-medium italic">
                    Note: You will be able to configure granular permissions using the matrix after the role is created.
                  </p>
               </div>

               <div className="pt-4 border-t border-[#f0f0f1] flex justify-end">
                  <button 
                     type="submit" 
                     disabled={loading}
                     className="bg-[#2271b1] text-white px-6 py-2 rounded font-bold text-[13px] hover:bg-[#135e96] flex items-center gap-2 transition-all"
                  >
                     <Save className="w-4 h-4" /> {loading ? "Creating..." : "Create Role"}
                  </button>
               </div>
            </form>
         </div>
      </div>
    </AdminPageLayout>
  );
}
