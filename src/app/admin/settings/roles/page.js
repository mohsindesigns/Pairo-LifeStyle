"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Save, Plus, Trash2, Copy, ChevronDown, ChevronUp, Lock } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { ALL_PERMISSIONS, ACTIONS } from "@/lib/rbac";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";

export default function RoleManagement() {
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/admin/roles");
      const data = await res.json();
      if (res.ok) {
        setRoles(data);
        if (data.length > 0 && !selectedRole) setSelectedRole(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchRoles();
    });
  }, []);

  const togglePermission = (module, action) => {
    if (selectedRole?.slug === 'super-admin') return; // Super admin permissions are handled by bypass logic

    const currentPerms = { ...selectedRole.permissions };
    const modulePerms = [...(currentPerms[module] || [])];

    if (modulePerms.includes(action)) {
      currentPerms[module] = modulePerms.filter(a => a !== action);
    } else {
      currentPerms[module] = [...modulePerms, action];
    }

    setSelectedRole({ ...selectedRole, permissions: currentPerms });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/roles/${selectedRole._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedRole)
      });
      if (res.ok) {
        setRoles(roles.map(r => r._id === selectedRole._id ? selectedRole : r));
        toast.success("Permissions saved successfully!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = () => {
    router.push("/admin/settings/roles/new");
  };

  const deleteRole = async (role) => {
    if (role.isSystem) return toast.error("System roles cannot be deleted.");
    const confirmed = await showConfirm(
      `Are you sure you want to delete the "${role.name}" role?`,
      "Delete Role"
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/roles/${role._id}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = roles.filter(r => r._id !== role._id);
        setRoles(remaining);
        if (selectedRole?._id === role._id) setSelectedRole(remaining[0] || null);
        toast.success("Role deleted successfully.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete role");
    }
  };

  const toggleModule = (module) => {
    setExpandedModules(prev => ({ ...prev, [module]: !prev[module] }));
  };

  if (loading) return <AdminPageLayout title="Loading Roles..."><div className="p-10 text-center italic text-gray-400">Loading system roles...</div></AdminPageLayout>;

  return (
    <AdminPageLayout 
      title="Role & Permission Management" 
      breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Roles" }]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6">
        {/* Role List Sidebar */}
        <div className="lg:col-span-1 min-w-0 space-y-4">
          <div className="bg-white border border-[#ccd0d4] shadow-sm">
            <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7] flex flex-wrap items-center justify-between gap-2">
               <h3 className="text-[13px] font-bold text-[#1d2327] uppercase">System Roles</h3>
               <button 
                 onClick={handleCreateRole}
                 className="text-[#2271b1] hover:text-[#135e96] flex items-center gap-1 text-[11px] font-bold uppercase"
               >
                 <Plus className="w-4 h-4" /> New Role
               </button>
            </div>
            <div className="divide-y divide-[#f0f0f1]">
              {roles.map((role) => (
                <button
                  key={role._id}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full text-left p-4 hover:bg-[#fbfbfb] transition-colors ${
                    selectedRole?._id === role._id ? "bg-[#f0f6fb] border-l-[3px] border-[#2271b1]" : "border-l-[3px] border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-bold text-[#1d2327] min-w-0 break-words">{role.name}</span>
                    {role.isSystem && <Lock className="w-3 h-3 shrink-0 text-[#8c8f94]" />}
                  </div>
                  <p className="text-[12px] text-[#646970] mt-1 line-clamp-1">{role.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Permission Matrix Main */}
        <div className="lg:col-span-3 min-w-0 space-y-4 md:space-y-6">
          {selectedRole ? (
            <div className="bg-white border border-[#ccd0d4] shadow-sm">
              <div className="p-3 sm:p-4 md:p-6 border-b border-[#ccd0d4] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Shield className="w-5 h-5 shrink-0 text-[#2271b1]" />
                    <h2 className="text-xl font-bold text-[#1d2327] min-w-0 break-words">{selectedRole.name}</h2>
                    {selectedRole.isSystem && (
                      <span className="text-[10px] bg-[#f0f0f1] text-[#646970] px-2 py-0.5 rounded font-bold uppercase tracking-wider">System Role</span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#646970] mt-1">{selectedRole.description}</p>
                </div>
                 <div className="flex flex-wrap items-center gap-2 md:shrink-0">
                    {!selectedRole.isSystem && (
                      <button
                        onClick={() => deleteRole(selectedRole)}
                        className="w-full xs:w-auto justify-center flex items-center gap-2 px-4 py-2 rounded font-bold text-[13px] border border-red-200 text-red-600 hover:bg-red-50 transition-all xs:mr-2"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Role
                      </button>
                    )}
                    <button 
                      onClick={handleSave}
                      disabled={saving || selectedRole.slug === 'super-admin'}
                      className={`w-full xs:w-auto justify-center flex items-center gap-2 px-4 py-2 rounded font-bold text-[13px] transition-all ${
                        selectedRole.slug === 'super-admin' ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-[#2271b1] text-white hover:bg-[#135e96]"
                      }`}
                    >
                      <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
                    </button>
                 </div>
              </div>

              {selectedRole.slug === 'super-admin' ? (
                <div className="p-6 md:p-12 text-center">
                  <div className="bg-[#f0f6fb] inline-flex p-4 rounded-full mb-4">
                    <Shield className="w-10 h-10 text-[#2271b1]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1d2327]">Full Access Enabled</h3>
                  <p className="text-[14px] text-[#646970] max-w-md mx-auto mt-2">
                    The Super Admin role bypasses all permission checks and has full access to every module by default. Individual permissions cannot be toggled for this role.
                  </p>
                </div>
              ) : (
                <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
                  {Object.entries(ALL_PERMISSIONS).map(([module, actions]) => (
                    <div key={module} className="border border-[#f0f0f1] rounded-[4px] overflow-hidden">
                      <button
                        onClick={() => toggleModule(module)}
                        className="w-full flex items-center justify-between gap-2 text-left p-4 bg-[#fbfbfb] hover:bg-[#f6f7f7] transition-colors"
                      >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                           <span className="font-bold text-[13px] text-[#1d2327] uppercase tracking-wide">{module}</span>
                           <span className="text-[11px] text-[#646970]">
                             ({selectedRole.permissions[module]?.length || 0} / {actions.length} permissions)
                           </span>
                        </div>
                        {expandedModules[module] ? <ChevronUp className="w-4 h-4 shrink-0 text-[#8c8f94]" /> : <ChevronDown className="w-4 h-4 shrink-0 text-[#8c8f94]" />}
                      </button>

                      {(expandedModules[module] || true) && (
                        <div className="p-3 sm:p-4 grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                          {actions.map((action) => {
                            const isChecked = selectedRole.permissions[module]?.includes(action);
                            return (
                              <label 
                                key={action} 
                                className={`flex items-center justify-between gap-2 p-3 border rounded-[4px] cursor-pointer transition-all ${
                                  isChecked ? "bg-[#f0f6fb] border-[#2271b1]/30 text-[#135e96]" : "bg-white border-[#ccd0d4] hover:bg-gray-50"
                                }`}
                              >
                                <span className="text-[12px] font-bold uppercase tracking-wider min-w-0 break-words">{action}</span>
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 shrink-0 accent-[#2271b1]"
                                  checked={isChecked}
                                  onChange={() => togglePermission(module, action)}
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 md:p-20 text-center text-gray-400 italic">Select a role to manage permissions.</div>
          )}
        </div>
      </div>
    </AdminPageLayout>
  );
}
