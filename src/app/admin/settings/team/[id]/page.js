"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { UserCog, Shield, Mail, Key, ArrowLeft, Save, Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";

export default function EditStaff() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    roleId: "",
    status: "Active",
    password: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesRes, staffRes] = await Promise.all([
          fetch("/api/admin/roles"),
          fetch(`/api/admin/staff/${id}`),
        ]);

        if (!rolesRes.ok || !staffRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const rolesData = await rolesRes.json();
        const staffData = await staffRes.json();

        setRoles(rolesData);
        setFormData({
          name: staffData.name || "",
          email: staffData.email || "",
          roleId: staffData.roleId?._id || staffData.roleId || "",
          status: staffData.status || "Active",
          password: "",
        });
      } catch (err) {
        toast.error("Error loading staff details");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success("Staff member updated successfully");
        router.push("/admin/settings/team");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update staff member");
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageLayout
      title="Edit Staff Member"
      breadcrumbs={[{ label: "Team", href: "/admin/settings/team" }, { label: "Edit Member" }]}
    >
      <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
        <Link
          href="/admin/settings/team"
          className="text-[#2271b1] hover:text-[#135e96] flex items-center gap-1 text-[13px] font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Team
        </Link>

        <div className="bg-white border border-[#ccd0d4] shadow-sm">
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-[#ccd0d4] bg-[#f6f7f7]">
            <h3 className="text-[14px] font-bold text-[#1d2327] uppercase flex items-center gap-2">
              <UserCog className="w-4 h-4" /> Edit Account Details
            </h3>
          </div>

          {loading ? (
            <div className="p-6 md:p-12 flex justify-center items-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Full Name</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-[#8c8f94] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Email Address</label>
                  <input
                    type="email"
                    required
                    className="w-full border border-[#8c8f94] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Administrative Role</label>
                  <select
                    required
                    className="w-full border border-[#8c8f94] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                  >
                    <option value="">Select a role...</option>
                    {roles.map((role) => (
                      <option key={role._id} value={role._id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Account Status</label>
                  <select
                    className="w-full border border-[#8c8f94] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Locked">Locked</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d2327]">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Leave blank to keep current password"
                    className="w-full border border-[#8c8f94] pl-3 pr-10 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#646970]">
                  Only fill this in if you want to change the password.
                </p>
              </div>

              <div className="pt-4 border-t border-[#f0f0f1] flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full xs:w-auto justify-center bg-[#2271b1] text-white px-6 py-2 rounded font-bold text-[13px] hover:bg-[#135e96] flex items-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AdminPageLayout>
  );
}
