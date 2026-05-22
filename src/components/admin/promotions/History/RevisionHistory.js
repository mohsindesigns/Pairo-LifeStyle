import React, { useEffect, useState, useCallback } from 'react';
import { History, RotateCcw, Clock, User, ChevronDown, ChevronUp } from 'lucide-react';

export default function RevisionHistory({ promotionId, onRollback }) {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchRevisions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/promotions/${promotionId}/revisions`);
      const data = await res.json();
      if (res.ok) setRevisions(data);
    } catch (err) {
      console.error("Failed to fetch revisions:", err);
    } finally {
      setLoading(false);
    }
  }, [promotionId]);

  useEffect(() => {
    if (promotionId) {
      Promise.resolve().then(() => {
        fetchRevisions();
      });
    }
  }, [promotionId, fetchRevisions]);

  const handleRestore = async (version) => {
    if (!confirm(`Are you sure you want to rollback to Version ${version}? Current unsaved changes will be lost.`)) return;
    try {
        const res = await fetch(`/api/admin/promotions/${promotionId}/revisions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version })
        });
        if (res.ok) {
            const updated = await res.json();
            onRollback(updated);
            fetchRevisions();
        }
    } catch (err) {
        console.error("Rollback failed:", err);
    }
  };

  return (
    <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-sm overflow-hidden">
      <div className="bg-[#f6f7f7] border-b border-[#ccd0d4] px-4 py-2 flex items-center gap-2">
        <History className="w-4 h-4 text-[#1d2327]" />
        <span className="text-[12px] font-bold text-[#1d2327]">Revision History</span>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
            <div className="p-4 text-center text-gray-400 text-[12px] italic">Loading history...</div>
        ) : revisions.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-[12px] italic">No historical records found.</div>
        ) : (
            <div className="divide-y divide-gray-100">
                {revisions.map((rev, idx) => (
                    <div key={rev._id} className="p-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">V{rev.version}</span>
                                <span className="text-[12px] font-bold text-[#1d2327]">
                                    {idx === 0 ? 'Current Version' : `Version ${rev.version}`}
                                </span>
                            </div>
                            <button 
                                onClick={() => handleRestore(rev.version)}
                                className="text-[10px] text-[#2271b1] hover:underline flex items-center gap-1 font-bold"
                            >
                                <RotateCcw className="w-3 h-3" /> RESTORE
                            </button>
                        </div>
                        
                        <div className="flex flex-col gap-1 text-[11px] text-gray-500">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(rev.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <User className="w-3 h-3" />
                                <span>{rev.createdBy || 'System'}</span>
                            </div>
                        </div>

                        {rev.changeSummary && (
                            <div className="mt-2 p-2 bg-blue-50 text-blue-700 rounded-sm text-[11px] border border-blue-100">
                                {rev.changeSummary}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
