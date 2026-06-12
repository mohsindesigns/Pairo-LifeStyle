"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Palette, 
  Check, 
  Settings2, 
  Plus, 
  Copy,
  Trash2,
  ExternalLink,
  Eye,
  Type,
  Layout,
  X
} from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";

// WordPress-Style Meta Box (Shared Pattern)
function MetaBox({ title, children, className = "" }) {
  return (
    <div className={`bg-white border border-[#c3c4c7] shadow-sm mb-5 ${className}`}>
      {title && (
        <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2">
          <h2 className="text-[14px] font-bold text-[#1d2327]">{title}</h2>
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export default function AppearanceManagement() {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTheme, setEditingTheme] = useState(null);

  const SUPPORTED_FONTS = [
    "Inter",
    "Space Grotesk",
    "Manrope",
    "Outfit",
    "Playfair Display",
    "Roboto",
    "Lora",
    "Poppins",
    "Montserrat",
    "Open Sans",
    "Lato",
    "Oswald",
    "Raleway",
    "Nunito",
    "Ubuntu"
  ];

  const fetchThemes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/themes");
      const data = await res.json();
      if (res.ok) setThemes(data);
    } catch (err) {
      toast.error("Failed to load themes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchThemes();
    });
  }, [fetchThemes]);

  const activateTheme = async (id) => {
    try {
      const res = await fetch("/api/admin/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACTIVATE", id })
      });
      if (res.ok) {
        toast.success("Theme activated successfully");
        fetchThemes();
      }
    } catch (err) {
      toast.error("Activation failed");
    }
  };

  const duplicateTheme = async (theme) => {
    try {
      const { _id, isActive, isSystem, createdAt, updatedAt, ...configOnly } = theme;
      const res = await fetch("/api/admin/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...configOnly, 
          name: `${theme.name} (Copy)`, 
          slug: `${theme.slug}-copy-${Date.now()}`,
          isActive: false,
          isSystem: false
        })
      });
      if (res.ok) {
        toast.success("Theme duplicated");
        fetchThemes();
      }
    } catch (err) {
      toast.error("Duplication failed");
    }
  };

  const saveThemeChanges = async () => {
    if (editingTheme.isSystem) {
      toast.error("System themes cannot be modified. Please duplicate it first.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/themes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTheme._id, config: editingTheme.config })
      });
      if (res.ok) {
        toast.success("Theme updated successfully");
        fetchThemes();
        setEditingTheme(null);
      } else {
        toast.error("Update failed");
      }
    } catch (err) {
      toast.error("Failed to save changes");
    }
  };

  if (loading) return <div className="p-10 text-center font-sans text-gray-400 italic">Loading Appearance Settings...</div>;

  return (
    <AdminPageLayout 
      title="Appearance" 
      subtitle="Manage your site's visual identity"
      breadcrumbs={[{ label: "Appearance" }]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Content: Theme List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {themes.map((theme) => (
              <div 
                key={theme._id}
                className={`bg-white border ${theme.isActive ? 'border-[#2271b1] ring-1 ring-[#2271b1]' : 'border-[#ccd0d4]'} shadow-sm rounded-[2px] overflow-hidden flex flex-col`}
              >
                {/* Visual Preview Area */}
                <div className="aspect-[16/10] bg-[#f0f2f1] relative group border-b border-[#ccd0d4]">
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div 
                      className="w-12 h-12 rounded-full border-2 border-white shadow-md mb-3"
                      style={{ background: `linear-gradient(45deg, ${theme.config.colors.background} 50%, ${theme.config.colors.primary} 50%)` }}
                    />
                    <h3 className="text-[14px] font-bold text-[#1d2327]">{theme.name}</h3>
                    <p className="text-[11px] text-[#646970] mt-1 uppercase tracking-wider">{theme.config.typography.headingFont}</p>
                  </div>

                  {/* WP-Style Hover Actions */}
                  <div className="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                     {!theme.isActive && (
                        <button 
                          onClick={() => activateTheme(theme._id)}
                          className="bg-[#2271b1] text-white px-4 py-1.5 rounded-[3px] text-[13px] font-bold hover:bg-[#135e96] shadow-sm"
                        >
                          Activate
                        </button>
                     )}
                     <button 
                      onClick={() => setEditingTheme(theme)}
                      className="bg-white border border-[#2271b1] text-[#2271b1] px-4 py-1.5 rounded-[3px] text-[13px] font-bold hover:bg-[#f0f6fb] shadow-sm"
                     >
                       Customize
                     </button>
                  </div>

                  {theme.isActive && (
                    <div className="absolute top-2 left-2 bg-[#2271b1] text-white text-[10px] font-bold uppercase px-2 py-1 rounded-[2px]">
                      Active
                    </div>
                  )}
                </div>

                {/* Info Bar */}
                <div className="px-3 py-2 flex items-center justify-between bg-white">
                  <span className="text-[12px] font-bold text-[#1d2327]">{theme.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => duplicateTheme(theme)} className="text-[#2271b1] hover:text-[#135e96]" title="Duplicate">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {!theme.isSystem && !theme.isActive && (
                      <button className="text-[#d63638] hover:text-[#bc0b0d]" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Add New Placeholder */}
            <div className="border-2 border-dashed border-[#ccd0d4] rounded-[2px] aspect-[16/10] flex flex-col items-center justify-center text-[#646970] hover:border-[#2271b1] hover:text-[#2271b1] transition-all cursor-pointer group">
               <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
               <span className="text-[13px] font-bold">Add New Theme</span>
            </div>
          </div>
        </div>

        {/* Sidebar: Help & Info */}
        <div className="space-y-5">
          <MetaBox title="About Appearance">
             <p className="text-[13px] text-[#3c434a] leading-relaxed mb-3">
               This screen allows you to manage the visual themes for your public storefront. 
               <strong> Note:</strong> Changes made here only affect the public website, not the admin dashboard.
             </p>
             <ul className="text-[13px] text-[#2271b1] space-y-2">
                <li className="flex items-center gap-2 cursor-pointer hover:underline">
                  <Eye className="w-3.5 h-3.5" /> Preview your site
                </li>
                <li className="flex items-center gap-2 cursor-pointer hover:underline">
                   <ExternalLink className="w-3.5 h-3.5" /> Visit site
                </li>
             </ul>
          </MetaBox>

          <MetaBox title="Site Identity">
             <div className="space-y-4">
                <div className="flex items-center justify-between text-[13px]">
                   <span className="text-[#646970]">Active Theme:</span>
                   <span className="font-bold text-[#1d2327]">{themes.find(t => t.isActive)?.name || 'Default'}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                   <span className="text-[#646970]">Version:</span>
                   <span className="text-gray-400">1.0.0</span>
                </div>
             </div>
          </MetaBox>
        </div>
      </div>

      {/* WordPress-Style Theme Customizer Modal */}
      {editingTheme && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="w-full max-w-4xl bg-[#f0f2f1] rounded-[2px] shadow-2xl flex flex-col h-[90vh] overflow-hidden border border-[#ccd0d4]">
              
              {/* Modal Header */}
              <div className="bg-[#1d2327] text-white px-6 py-3 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Palette className="w-4 h-4 text-[#72aee6]" />
                    <span className="text-[14px] font-bold">Customizing: {editingTheme.name}</span>
                 </div>
                 <button onClick={() => setEditingTheme(null)} className="text-gray-400 hover:text-white transition-colors" title="Close">
                    <X className="w-5 h-5" />
                 </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                 {/* Left Sidebar: Controls */}
                 <div className="w-[300px] bg-white border-r border-[#ccd0d4] overflow-y-auto p-5 space-y-8">
                    
                    {/* Colors */}
                    <div className="space-y-4">
                       <h3 className="text-[12px] font-bold text-[#1d2327] uppercase tracking-wider border-b border-[#f0f0f1] pb-2 flex items-center gap-2">
                          <Palette className="w-3.5 h-3.5 text-gray-400" /> Colors
                       </h3>
                       <div className="space-y-3">
                          {Object.entries(editingTheme.config.colors).map(([key, value]) => (
                             <div key={key} className="flex items-center justify-between gap-4">
                                <label className="text-[12px] text-[#646970] capitalize">{key}</label>
                                 <div className="flex items-center gap-2">
                                    <input 
                                       type="text" 
                                       value={value} 
                                       onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, colors: {...editingTheme.config.colors, [key]: e.target.value}}})}
                                       className="w-20 text-[11px] border border-[#ccd0d4] px-1 py-1 font-mono text-center bg-white rounded-sm focus:outline-none focus:border-[#2271b1] uppercase" 
                                    />
                                    <div className="relative w-6 h-6 rounded-sm border border-[#ccd0d4] shadow-sm cursor-pointer overflow-hidden" style={{ backgroundColor: value }}>
                                       <input 
                                          type="color" 
                                          value={value} 
                                          onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, colors: {...editingTheme.config.colors, [key]: e.target.value}}})}
                                          className="opacity-0 absolute inset-[-10px] w-10 h-10 cursor-pointer" 
                                       />
                                    </div>
                                 </div>
                             </div>
                          ))}
                       </div>
                    </div>

                    {/* Typography */}
                    <div className="space-y-4">
                       <h3 className="text-[12px] font-bold text-[#1d2327] uppercase tracking-wider border-b border-[#f0f0f1] pb-2 flex items-center gap-2">
                          <Type className="w-3.5 h-3.5 text-gray-400" /> Typography
                       </h3>
                       <div className="space-y-4">
                          <div className="space-y-1">
                             <label className="text-[11px] text-[#646970]">Heading Font</label>
                             <select 
                               value={editingTheme.config.typography.headingFont}
                               onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, typography: {...editingTheme.config.typography, headingFont: e.target.value}}})}
                               className="w-full text-[13px] font-bold text-[#1d2327] bg-[#f6f7f7] border border-[#ccd0d4] px-3 py-1.5 rounded-sm outline-none focus:border-[#2271b1]"
                             >
                               {SUPPORTED_FONTS.map(font => (
                                 <option key={font} value={font}>{font}</option>
                               ))}
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[11px] text-[#646970]">Body Font</label>
                             <select 
                               value={editingTheme.config.typography.bodyFont}
                               onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, typography: {...editingTheme.config.typography, bodyFont: e.target.value}}})}
                               className="w-full text-[13px] font-bold text-[#1d2327] bg-[#f6f7f7] border border-[#ccd0d4] px-3 py-1.5 rounded-sm outline-none focus:border-[#2271b1]"
                             >
                               {SUPPORTED_FONTS.map(font => (
                                 <option key={font} value={font}>{font}</option>
                               ))}
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[11px] text-[#646970]">Scale Level</label>
                             <select 
                               value={editingTheme.config.typography.headingScale}
                               onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, typography: {...editingTheme.config.typography, headingScale: parseFloat(e.target.value)}}})}
                               className="w-full text-[13px] font-bold text-[#1d2327] bg-[#f6f7f7] border border-[#ccd0d4] px-3 py-1.5 rounded-sm outline-none focus:border-[#2271b1]"
                             >
                               <option value="1.125">1.125x (Subtle)</option>
                               <option value="1.200">1.200x (Minor Third)</option>
                               <option value="1.250">1.250x (Major Third)</option>
                               <option value="1.333">1.333x (Perfect Fourth)</option>
                               <option value="1.414">1.414x (Augmented Fourth)</option>
                             </select>
                          </div>
                       </div>
                    </div>

                    <div className="pt-4 border-t border-[#f0f0f1]">
                       <button 
                        onClick={saveThemeChanges}
                        className="w-full bg-[#2271b1] text-white py-2 rounded-[3px] text-[13px] font-bold hover:bg-[#135e96] shadow-sm transition-all"
                       >
                         Publish Changes
                       </button>
                    </div>

                 </div>

                 {/* Right: Live Preview Frame */}
                 <div className="flex-1 bg-[#dcdcde] p-8 flex items-center justify-center">
                    <div className="w-full h-full bg-white shadow-xl rounded-sm overflow-hidden flex flex-col border border-[#ccd0d4]">
                       <div className="bg-white border-b border-[#ccd0d4] px-4 py-2 flex items-center justify-between">
                          <div className="flex gap-1.5">
                             <div className="w-2.5 h-2.5 rounded-full bg-[#ccd0d4]" />
                             <div className="w-2.5 h-2.5 rounded-full bg-[#ccd0d4]" />
                             <div className="w-2.5 h-2.5 rounded-full bg-[#ccd0d4]" />
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono tracking-tighter">PREVIEW_MODE_ACTIVE</div>
                       </div>
                       
                       <div className="flex-1 overflow-y-auto relative" style={{ backgroundColor: editingTheme.config.colors.background }}>
                          {/* Inject Dynamic Google Fonts Link for Preview */}
                          <link 
                            rel="stylesheet" 
                            href={`https://fonts.googleapis.com/css2?family=${editingTheme.config.typography.headingFont.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900&family=${editingTheme.config.typography.bodyFont.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900&display=swap`} 
                          />
                          
                          {/* Mini Header */}
                          <div className="sticky top-0 z-10 border-b shadow-sm flex items-center justify-between px-8 py-4" style={{ backgroundColor: editingTheme.config.colors.card || editingTheme.config.colors.background, borderColor: editingTheme.config.colors.border }}>
                             <div style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.headingFont, fontSize: '18px', fontWeight: '900', letterSpacing: '-0.5px' }}>STOREFRONT</div>
                             <div className="flex gap-6">
                                <span style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.bodyFont, fontSize: '13px', opacity: 0.8, cursor: 'pointer' }}>Home</span>
                                <span style={{ color: editingTheme.config.colors.primary, fontFamily: editingTheme.config.typography.bodyFont, fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>Shop</span>
                                <span style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.bodyFont, fontSize: '13px', opacity: 0.8, cursor: 'pointer' }}>About</span>
                             </div>
                          </div>

                          <div className="p-12 max-w-2xl mx-auto space-y-16">
                             {/* Hero Section */}
                             <div className="space-y-6 text-center">
                                <span style={{ color: editingTheme.config.colors.primary, fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', tracking: 'widest', fontFamily: editingTheme.config.typography.bodyFont }}>New Collection</span>
                                <h1 style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.headingFont, fontSize: '48px', lineHeight: '1.1', fontWeight: '800', letterSpacing: '-1px' }}>
                                  Experience Pure Luxury
                                </h1>
                                <p style={{ color: editingTheme.config.colors.foreground, opacity: 0.7, fontSize: '16px', lineHeight: '1.6', fontFamily: editingTheme.config.typography.bodyFont, maxWidth: '400px', margin: '0 auto' }}>
                                  This is a live simulation of your public storefront using the selected typography, colors, and borders.
                                </p>
                                <div className="pt-4 flex items-center justify-center gap-4">
                                   <div className="h-11 px-8 rounded flex items-center justify-center font-bold text-[14px] cursor-pointer shadow-lg hover:opacity-90 transition-opacity" 
                                        style={{ backgroundColor: editingTheme.config.colors.primary, color: editingTheme.config.colors.background, fontFamily: editingTheme.config.typography.bodyFont }}>
                                      Shop Now
                                   </div>
                                   <div className="h-11 px-8 rounded flex items-center justify-center font-bold text-[14px] cursor-pointer border" 
                                        style={{ borderColor: editingTheme.config.colors.border, color: editingTheme.config.colors.foreground, backgroundColor: 'transparent', fontFamily: editingTheme.config.typography.bodyFont }}>
                                      Learn More
                                   </div>
                                </div>
                             </div>

                             {/* Product Grid Simulation */}
                             <div className="space-y-6">
                                <h2 style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.headingFont, fontSize: '24px', fontWeight: 'bold' }}>Featured Products</h2>
                                <div className="grid grid-cols-2 gap-6">
                                   {[1, 2].map((i) => (
                                     <div key={i} className="rounded-lg overflow-hidden border transition-transform hover:-translate-y-1" style={{ backgroundColor: editingTheme.config.colors.card || editingTheme.config.colors.background, borderColor: editingTheme.config.colors.border }}>
                                        <div className="aspect-[4/3] w-full" style={{ backgroundColor: editingTheme.config.colors.muted }}></div>
                                        <div className="p-5 space-y-3">
                                           <h3 style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.headingFont, fontSize: '16px', fontWeight: 'bold' }}>Sample Product {i}</h3>
                                           <div className="flex items-center justify-between">
                                              <span style={{ color: editingTheme.config.colors.foreground, opacity: 0.7, fontFamily: editingTheme.config.typography.bodyFont, fontSize: '15px' }}>$199.00</span>
                                              <div className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer" style={{ backgroundColor: editingTheme.config.colors.secondary, color: editingTheme.config.colors.primary }}>
                                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                                              </div>
                                           </div>
                                        </div>
                                     </div>
                                   ))}
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

           </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
