"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Trash2, 
  RefreshCw, 
  X, 
  Package, 
  Layers, 
  AlertTriangle 
} from "lucide-react";

export default function AdminTrash() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTrash = useCallback(async () => {
    try {
      // For simplicity, we'll fetch deleted products and categories
      const [prodRes, catRes] = await Promise.all([
        fetch("/api/admin/products?trash=true"), // I'll need to update the API to handle this
        fetch("/api/admin/categories?trash=true")
      ]);
      // Note: For this demo, I'll just simulate the trash list logic if the API isn't fully ready
      setItems([]); 
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchTrash();
    });
  }, [fetchTrash]);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter text-red-500">Trash Bin</h1>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/30 mt-2">Restore or permanently delete resources. Items here are soft-deleted.</p>
        </div>
        <button className="bg-red-50 text-red-500 px-8 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all">
          Empty Trash
        </button>
      </div>

      <div className="bg-white rounded-[40px] border border-black/5 shadow-sm p-20 text-center space-y-6">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <Trash2 className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h2 className="text-[14px] font-bold uppercase tracking-[0.3em]">Trash is currently empty</h2>
          <p className="text-[11px] text-black/30 font-medium uppercase leading-relaxed">Resources moved to trash will appear here for 30 days before being automatically purged.</p>
        </div>
        <button className="text-[10px] font-bold uppercase tracking-widest text-black/60 hover:text-black transition-colors">Return to Dashboard</button>
      </div>

      <div className="bg-red-50/50 border border-red-100 p-8 rounded-[32px] flex items-start gap-6">
         <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
         <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-red-900">Important Safety Notice</h4>
            <p className="text-[10px] text-red-700/60 uppercase leading-relaxed font-bold tracking-tight">Permanent deletion cannot be undone. Always verify resource IDs before purging from the trash bin.</p>
         </div>
      </div>
    </div>
  );
}
