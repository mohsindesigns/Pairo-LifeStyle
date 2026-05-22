"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Mail, 
  CheckCircle2, 
  Trash2, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  MoreVertical,
  Flag,
  User,
  Clock,
  MessageSquare,
  Send,
  X,
  History,
  Tag,
  AlertCircle
} from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";

export default function AdminContact() {
  // --- State: Data & Pagination ---
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ all: 0, New: 0, Read: 0, Replied: 0, Archived: 0, Spam: 0 });
  const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1, limit: 20 });
  
  // --- State: Filters & Search ---
  const [status, setStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState(""); // Only trigger fetch on search button or enter
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  // --- State: CRM Detail View ---
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [replyMode, setReplyMode] = useState(false);
  const [replyData, setReplyData] = useState({ subject: "", message: "" });
  const [internalNote, setInternalNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isLive, setIsLive] = useState(false); // New: Live mode

  // --- Fetch Logic ---
  const fetchSubmissions = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        status,
        search: searchQuery,
      });
      const res = await fetch(`/api/admin/submissions?${params}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items);
        setPagination(data.pagination);
        setCounts(data.counts);
      }
    } catch (err) {
      if (!isSilent) toast.error("Failed to load submissions");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [pagination.page, pagination.limit, status, searchQuery]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchSubmissions();
    });
  }, [fetchSubmissions]);

  // Live Refresh Polling
  useEffect(() => {
    let interval;
    if (isLive) {
      interval = setInterval(() => {
        fetchSubmissions(true);
      }, 60000); // Poll every 60 seconds
    }
    return () => clearInterval(interval);
  }, [isLive, fetchSubmissions]);

  // --- CRM Actions ---
  const handleAction = async (id, action, payload = {}) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, action })
      });
      if (res.ok) {
        const updated = await res.json();
        setItems(items.map(it => it._id === id ? updated : it));
        if (selectedItem?._id === id) setSelectedItem(updated);
        toast.success(`Action: ${action} successful`);
      }
    } catch (err) {
      toast.error("Action failed");
    }
  };

  const handleBulkAction = async () => {
    if (selectedIds.length === 0 || bulkAction === "Bulk actions") return;
    
    const actionMap = {
      "Mark as read": "markRead",
      "Move to Trash": "trash",
      "Mark as Spam": "markSpam"
    };
    
    const action = actionMap[bulkAction];
    if (!action) return;

    try {
      const res = await fetch("/api/admin/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selectedIds })
      });
      if (res.ok) {
        toast.success("Bulk action completed");
        setSelectedIds([]);
        fetchSubmissions();
      }
    } catch (err) {
      toast.error("Bulk action failed");
    }
  };

  const sendReply = async () => {
    if (!replyData.subject || !replyData.message) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/submissions/${selectedItem._id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyData)
      });
      if (res.ok) {
        toast.success("Reply sent successfully");
        setReplyMode(false);
        setReplyData({ subject: "", message: "" });
        // Refresh detail to show the note
        const updatedRes = await fetch(`/api/admin/submissions/${selectedItem._id}`);
        const updated = await updatedRes.json();
        setSelectedItem(updated);
        setItems(items.map(it => it._id === updated._id ? updated : it));
      }
    } catch (err) {
      toast.error("Failed to send reply");
    } finally {
      setSubmitting(false);
    }
  };

  const addNote = async () => {
    if (!internalNote) return;
    try {
      const res = await fetch(`/api/admin/submissions/${selectedItem._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: internalNote, action: 'ADD_NOTE' })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedItem(updated);
        setInternalNote("");
        toast.success("Note added");
      }
    } catch (err) {
      toast.error("Failed to add note");
    }
  };

  const exportToCSV = () => {
    if (items.length === 0) return;
    const headers = ["Name", "Email", "Subject", "Status", "Priority", "Date"];
    const rows = items.filter(it => it !== null).map(it => [
      it.name,
      it.email,
      it.subject || "N/A",
      it.status,
      it.priority,
      new Date(it.createdAt).toLocaleString()
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `submissions_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Helpers ---
  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) setSelectedIds([]);
    else setSelectedIds(items.filter(i => i !== null).map(i => i._id));
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(x => x !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  return (
    <AdminPageLayout
      title="Submissions"
      breadcrumbs={[{ label: "Submissions" }]}
    >
      <div className="space-y-4">
        {/* --- 1. Filter Links (EXACT UI PRESERVED) --- */}
        <ul className="flex items-center gap-2 text-[13px] text-[#2271b1]">
          <li className={`${status === 'all' ? 'text-[#1d2327] font-bold' : 'cursor-pointer hover:text-[#135e96]'} transition-colors`} onClick={() => setStatus('all')}>
            All <span className="text-[#646970] font-normal">({counts.all})</span>
          </li>
          <span className="text-[#c3c4c7]">|</span>
          <li className={`${status === 'New' ? 'text-[#1d2327] font-bold' : 'cursor-pointer hover:text-[#135e96]'} transition-colors`} onClick={() => setStatus('New')}>
            Pending <span className="text-[#646970] font-normal">({counts.New})</span>
          </li>
          <span className="text-[#c3c4c7]">|</span>
          <li className={`${status === 'Read' ? 'text-[#1d2327] font-bold' : 'cursor-pointer hover:text-[#135e96]'} transition-colors`} onClick={() => setStatus('Read')}>
            Read <span className="text-[#646970] font-normal">({counts.Read})</span>
          </li>
          <span className="text-[#c3c4c7]">|</span>
          <li className={`${status === 'Replied' ? 'text-[#1d2327] font-bold' : 'cursor-pointer hover:text-[#135e96]'} transition-colors`} onClick={() => setStatus('Replied')}>
            Replied <span className="text-[#646970] font-normal">({counts.Replied})</span>
          </li>
          <span className="text-[#c3c4c7]">|</span>
          <li className={`${status === 'Spam' ? 'text-[#1d2327] font-bold' : 'cursor-pointer hover:text-[#135e96]'} transition-colors`} onClick={() => setStatus('Spam')}>
            Spam <span className="text-[#646970] font-normal">({counts.Spam})</span>
          </li>
          <span className="text-[#c3c4c7]">|</span>
          <li className="flex items-center gap-2">
            <button 
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${isLive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              LIVE {isLive ? 'ON' : 'OFF'}
            </button>
          </li>
        </ul>

        {/* --- 2. Action Bar (EXACT UI PRESERVED) --- */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2">
            <select 
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1 rounded-[3px] outline-none"
            >
              <option>Bulk actions</option>
              <option>Mark as read</option>
              <option>Move to Trash</option>
              <option>Mark as Spam</option>
            </select>
            <button 
              onClick={handleBulkAction}
              className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]"
            >
              Apply
            </button>
            <button 
              onClick={exportToCSV}
              className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1] ml-2"
            >
              Export to CSV
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search submissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(searchTerm)}
              className="border border-[#8c8f94] outline-none px-3 py-1 text-[13px] flex-1 md:w-48 bg-white focus:border-[#2271b1] rounded-[3px]"
            />
            <button 
              onClick={() => setSearchQuery(searchTerm)}
              className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]"
            >
              Search
            </button>
          </div>
        </div>

        {/* --- 3. WP List Table (EXACT UI PRESERVED) --- */}
        <div className="bg-white border border-[#ccd0d4] shadow-sm overflow-x-auto rounded-[2px]">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                <th className="px-3 py-2 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.length === items.length && items.length > 0} 
                    onChange={toggleSelectAll} 
                  />
                </th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Author</th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Submission</th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Status / Priority</th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Submitted on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center italic text-gray-400">Loading submissions...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center italic text-gray-400">No submissions found.</td></tr>
              ) : (
                items.filter(s => s !== null).map((s) => (
                  <tr key={s._id} className={`hover:bg-[#f6f7f7] group ${s?.status === 'New' ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-3 py-4 text-center align-top pt-5">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(s._id)} 
                        onChange={() => toggleSelectOne(s._id)}
                      />
                    </td>
                    <td className="px-3 py-4 w-52 align-top">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-[#f0f2f1] border border-gray-200 rounded-[2px] flex items-center justify-center text-[#8c8f94] shrink-0 font-bold text-[11px]">
                          {s.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className={`text-[14px] ${s.status === 'New' ? 'font-black' : 'font-bold'} text-[#1d2327] truncate`}>{s.name}</span>
                          <span className="text-[12px] text-[#2271b1] hover:underline cursor-pointer truncate">{s.email}</span>
                          {s.phone && <span className="text-[11px] text-gray-400">{s.phone}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <div className="flex flex-col">
                        <p className="text-[13px] leading-relaxed mb-2 text-[#3c434a] max-w-xl line-clamp-2">{s.message}</p>
                        
                        {/* Action Links (WP-Style Hover) */}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium text-[#2271b1]">
                          <button onClick={() => { setSelectedItem(s); setIsDetailOpen(true); }} className="hover:text-[#135e96]">View Detail</button>
                          <span className="text-[#c3c4c7]">|</span>
                          {s.status === 'New' ? (
                            <button onClick={() => handleAction(s._id, 'SET_STATUS', { status: 'Read' })} className="hover:text-[#135e96]">Mark as Read</button>
                          ) : (
                            <button onClick={() => { setSelectedItem(s); setIsDetailOpen(true); setReplyMode(true); }} className="hover:text-[#135e96]">Reply</button>
                          )}
                          <span className="text-[#c3c4c7]">|</span>
                          <button onClick={() => handleAction(s._id, 'trash')} className="text-[#d63638] hover:text-[#bc0b0d]">Trash</button>
                          <span className="text-[#c3c4c7]">|</span>
                          <button onClick={() => handleAction(s._id, 'SET_STATUS', { status: 'Spam' })} className="text-orange-600 hover:text-orange-700">Spam</button>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider w-fit ${
                          s.status === 'New' ? 'bg-blue-100 text-blue-700' :
                          s.status === 'Replied' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {s.status}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Flag className={`w-3 h-3 ${
                            s.priority === 'High' ? 'text-red-500' :
                            s.priority === 'Medium' ? 'text-orange-400' :
                            'text-blue-300'
                          }`} />
                          {s.priority} Priority
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-[12px] text-[#646970] align-top font-medium">
                      {new Date(s.createdAt).toLocaleDateString()} at {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* --- 4. Pagination (EXACT UI PRESERVED) --- */}
        <div className="flex items-center justify-between text-[13px] text-[#646970]">
          <div>{pagination.total} items</div>
          <div className="flex items-center gap-1">
            <button 
              disabled={pagination.page <= 1}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              className="p-1 border border-[#ccd0d4] bg-white rounded disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-bold text-[#2c3338]">{pagination.page} of {pagination.pages}</span>
            <button 
              disabled={pagination.page >= pagination.pages}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              className="p-1 border border-[#ccd0d4] bg-white rounded disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* --- 5. CRM Detail Side Panel (Enterprise CRM Feel) --- */}
      {isDetailOpen && selectedItem && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/20 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-[#f6f7f7]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white border border-gray-200 rounded flex items-center justify-center text-[#2271b1] font-bold text-lg shadow-sm">
                  {selectedItem.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-[16px] font-bold text-[#1d2327]">{selectedItem.name}</h2>
                  <p className="text-[12px] text-[#2271b1]">{selectedItem.email}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Status & Actions Bar */}
              <div className="flex flex-wrap items-center gap-3">
                <select 
                  className="text-[12px] border border-gray-300 rounded px-3 py-1.5 outline-none focus:border-[#2271b1]"
                  value={selectedItem.status}
                  onChange={(e) => handleAction(selectedItem._id, 'SET_STATUS', { status: e.target.value })}
                >
                  <option value="New">New</option>
                  <option value="Read">Read</option>
                  <option value="Replied">Replied</option>
                  <option value="Archived">Archived</option>
                  <option value="Spam">Spam</option>
                </select>

                <select 
                  className="text-[12px] border border-gray-300 rounded px-3 py-1.5 outline-none focus:border-[#2271b1]"
                  value={selectedItem.priority}
                  onChange={(e) => handleAction(selectedItem._id, 'SET_PRIORITY', { priority: e.target.value })}
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>

                <button 
                  onClick={() => { setReplyMode(!replyMode); setReplyData({ subject: `Re: ${selectedItem.subject || 'Your Inquiry'}`, message: "" }); }}
                  className="bg-[#2271b1] text-white px-4 py-1.5 rounded-[3px] text-[12px] font-bold hover:bg-[#135e96] flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" /> {replyMode ? "Cancel Reply" : "Reply to Customer"}
                </button>
              </div>

              {/* Message Content */}
              <div className="bg-[#fcfcfc] border border-gray-100 p-6 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-4">
                  <MessageSquare className="w-3.5 h-3.5" /> Submission Content
                </div>
                {selectedItem.subject && <h4 className="text-[15px] font-bold text-gray-800 mb-2">{selectedItem.subject}</h4>}
                <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedItem.message}</p>
                
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-6 text-[11px] text-gray-400">
                  <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Received: {new Date(selectedItem.createdAt).toLocaleString()}</div>
                  {selectedItem.sourcePage && <div className="flex items-center gap-1.5"><Eye className="w-3 h-3" /> Page: {selectedItem.sourcePage}</div>}
                </div>
              </div>

              {/* Reply Interface */}
              {replyMode && (
                <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-lg space-y-4 animate-in fade-in duration-300">
                  <h4 className="text-[13px] font-bold text-blue-900 flex items-center gap-2">
                    <Send className="w-4 h-4" /> Send Email Reply
                  </h4>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Subject"
                      className="w-full border border-blue-200 px-3 py-2 text-[13px] rounded outline-none focus:border-blue-500"
                      value={replyData.subject}
                      onChange={(e) => setReplyData({...replyData, subject: e.target.value})}
                    />
                    <textarea 
                      rows={6}
                      placeholder="Type your response here..."
                      className="w-full border border-blue-200 px-3 py-2 text-[13px] rounded outline-none focus:border-blue-500 resize-none"
                      value={replyData.message}
                      onChange={(e) => setReplyData({...replyData, message: e.target.value})}
                    />
                    <div className="flex justify-end gap-3">
                       <button onClick={() => setReplyMode(false)} className="text-[12px] font-bold text-gray-500 px-4 py-2 hover:bg-gray-100 rounded">Cancel</button>
                       <button 
                        onClick={sendReply}
                        disabled={submitting}
                        className="bg-blue-600 text-white px-6 py-2 rounded font-bold text-[12px] hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                       >
                         {submitting ? "Sending..." : "Dispatch Reply"}
                       </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Internal Notes & History (Timeline) */}
              <div className="space-y-4">
                <h4 className="text-[13px] font-bold text-gray-700 flex items-center gap-2">
                  <History className="w-4 h-4" /> Activity & Internal Notes
                </h4>
                
                {/* Note Input */}
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Add an internal note..."
                    className="flex-1 border border-gray-200 px-3 py-2 text-[13px] rounded outline-none focus:border-[#2271b1]"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addNote()}
                  />
                  <button onClick={addNote} className="bg-gray-100 text-gray-600 px-4 py-2 rounded text-[12px] font-bold hover:bg-gray-200 transition-colors">Add</button>
                </div>

                {/* Timeline */}
                <div className="space-y-4 pt-4">
                  {(selectedItem.internalNotes || []).length === 0 && (
                    <p className="text-[12px] text-gray-400 italic">No internal activity recorded yet.</p>
                  )}
                  {selectedItem.internalNotes?.map((note, i) => (
                    <div key={i} className="flex gap-3 relative">
                      <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 z-10">
                        <User className="w-3 h-3 text-gray-400" />
                      </div>
                      <div className="flex-1 bg-[#f9f9f9] border border-gray-100 p-3 rounded text-[12px] relative">
                         <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-700">{note.author?.name || 'Staff'}</span>
                            <span className="text-[10px] text-gray-400">{new Date(note.createdAt).toLocaleString()}</span>
                         </div>
                         <p className="text-gray-600 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadata Table */}
              <div className="pt-8 border-t border-gray-100 grid grid-cols-2 gap-y-4 text-[12px]">
                <div>
                   <span className="text-gray-400 block mb-1">Source Page</span>
                   <span className="font-medium text-gray-700">{selectedItem.sourcePage || 'N/A'}</span>
                </div>
                <div>
                   <span className="text-gray-400 block mb-1">IP Address</span>
                   <span className="font-medium text-gray-700">{selectedItem.ipAddress || '127.0.0.1'}</span>
                </div>
                <div>
                   <span className="text-gray-400 block mb-1">Last Viewed</span>
                   <span className="font-medium text-gray-700">{selectedItem.lastViewedAt ? new Date(selectedItem.lastViewedAt).toLocaleString() : 'Never'}</span>
                </div>
                <div>
                   <span className="text-gray-400 block mb-1">System ID</span>
                   <span className="font-mono text-[10px] text-gray-400">{selectedItem._id}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
