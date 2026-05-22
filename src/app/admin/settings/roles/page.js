"use client";

import { useEffect, useState } from "react";
import { Shield, Save, Plus, Trash2, Copy, ChevronDown, ChevronUp, Lock } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { ALL_PERMISSIONS, ACTIONS } from "@/lib/rbac";

export default function RoleManagement() {
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
        alert("Permissions saved successfully!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async () => {
    const name = prompt("Enter new role name (e.g., Marketing Manager):");
    if (!name) return;
    const description = prompt("Enter role description:");
    
    try {
      const res = await fetch("/api/admin/roles", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, permissions: {} })
      });
      const data = await res.json();
      if (res.ok) {
        setRoles([...roles, data]);
        setSelectedRole(data);
        alert(`Role "${name}" created successfully!`);
      } else {
        alert(data.error || "Failed to create role");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating role");
    }
  };

  const deleteRole = async (role) => {
    if (role.isSystem) return alert("System roles cannot be deleted.");
    if (!confirm(`Are you sure you want to delete the "${role.name}" role?`)) return;

    try {
      const res = await fetch(`/api/admin/roles/${role._id}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = roles.filter(r => r._id !== role._id);
        setRoles(remaining);
        if (selectedRole?._id === role._id) setSelectedRole(remaining[0] || null);
        alert("Role deleted successfully.");
      }
    } catch (err) {
      console.error(err);
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Role List Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-[#ccd0d4] shadow-sm">
            <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center justify-between">
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
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-[#1d2327]">{role.name}</span>
                    {role.isSystem && <Lock className="w-3 h-3 text-[#8c8f94]" />}
                  </div>
                  <p className="text-[12px] text-[#646970] mt-1 line-clamp-1">{role.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Permission Matrix Main */}
        <div className="lg:col-span-3 space-y-6">
          {selectedRole ? (
            <div className="bg-white border border-[#ccd0d4] shadow-sm">
              <div className="p-6 border-b border-[#ccd0d4] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#2271b1]" />
                    <h2 className="text-xl font-bold text-[#1d2327]">{selectedRole.name}</h2>
                    {selectedRole.isSystem && (
                      <span className="text-[10px] bg-[#f0f0f1] text-[#646970] px-2 py-0.5 rounded font-bold uppercase tracking-wider">System Role</span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#646970] mt-1">{selectedRole.description}</p>
                </div>
                 <div className="flex items-center gap-2">
                    {!selectedRole.isSystem && (
                      <button 
                        onClick={() => deleteRole(selectedRole)}
                        className="flex items-center gap-2 px-4 py-2 rounded font-bold text-[13px] border border-red-200 text-red-600 hover:bg-red-50 transition-all mr-2"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Role
                      </button>
                    )}
                    <button 
                      onClick={handleSave}
                      disabled={saving || selectedRole.slug === 'super-admin'}
                      className={`flex items-center gap-2 px-4 py-2 rounded font-bold text-[13px] transition-all ${
                        selectedRole.slug === 'super-admin' ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-[#2271b1] text-white hover:bg-[#135e96]"
                      }`}
                    >
                      <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
                    </button>
                 </div>
              </div>

              {selectedRole.slug === 'super-admin' ? (
                <div className="p-12 text-center">
                  <div className="bg-[#f0f6fb] inline-flex p-4 rounded-full mb-4">
                    <Shield className="w-10 h-10 text-[#2271b1]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1d2327]">Full Access Enabled</h3>
                  <p className="text-[14px] text-[#646970] max-w-md mx-auto mt-2">
                    The Super Admin role bypasses all permission checks and has full access to every module by default. Individual permissions cannot be toggled for this role.
                  </p>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {Object.entries(ALL_PERMISSIONS).map(([module, actions]) => (
                    <div key={module} className="border border-[#f0f0f1] rounded-[4px] overflow-hidden">
                      <button 
                        onClick={() => toggleModule(module)}
                        className="w-full flex items-center justify-between p-4 bg-[#fbfbfb] hover:bg-[#f6f7f7] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                           <span className="font-bold text-[13px] text-[#1d2327] uppercase tracking-wide">{module}</span>
                           <span className="text-[11px] text-[#646970]">
                             ({selectedRole.permissions[module]?.length || 0} / {actions.length} permissions)
                           </span>
                        </div>
                        {expandedModules[module] ? <ChevronUp className="w-4 h-4 text-[#8c8f94]" /> : <ChevronDown className="w-4 h-4 text-[#8c8f94]" />}
                      </button>
                      
                      {(expandedModules[module] || true) && (
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                          {actions.map((action) => {
                            const isChecked = selectedRole.permissions[module]?.includes(action);
                            return (
                              <label 
                                key={action} 
                                className={`flex items-center justify-between p-3 border rounded-[4px] cursor-pointer transition-all ${
                                  isChecked ? "bg-[#f0f6fb] border-[#2271b1]/30 text-[#135e96]" : "bg-white border-[#ccd0d4] hover:bg-gray-50"
                                }`}
                              >
                                <span className="text-[12px] font-bold uppercase tracking-wider">{action}</span>
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 accent-[#2271b1]"
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
            <div className="p-20 text-center text-gray-400 italic">Select a role to manage permissions.</div>
          )}
        </div>
      </div>
    </AdminPageLayout>
  );
}
