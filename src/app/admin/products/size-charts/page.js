"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Search,
  Plus,
  Copy,
  Trash2,
  Edit,
  Eye,
  Check,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Download,
  Upload,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";

export default function AdminSizeCharts() {
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [sizeCharts, setSizeCharts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All statuses");
  const [selectedAssignment, setSelectedAssignment] = useState("All assignments");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  // Preview Modal
  const [previewChart, setPreviewChart] = useState(null);

  const fetchSizeCharts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/size-charts");
      const data = await res.json();
      if (res.ok) {
        setSizeCharts(Array.isArray(data) ? data : []);
      } else {
        toast.error(data.error || "Failed to load size charts");
      }
    } catch (err) {
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSizeCharts();
  }, [fetchSizeCharts]);

  // Handle Delete
  const handleDelete = async (id) => {
    const ok = await showConfirm("Are you sure you want to delete this size chart?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/size-charts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Size chart deleted");
        fetchSizeCharts();
      } else {
        const data = await res.json();
        toast.error(data.error || "Delete failed");
      }
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  // Handle Duplicate
  const handleDuplicate = async (chart) => {
    try {
      // Find a unique label name
      let newLabel = `${chart.label} (Copy)`;
      let suffix = 2;
      while (sizeCharts.some((c) => c.label.toLowerCase() === newLabel.toLowerCase())) {
        newLabel = `${chart.label} (Copy ${suffix})`;
        suffix++;
      }

      const copyData = {
        label: newLabel,
        publicHeading: chart.publicHeading,
        description: chart.description,
        columns: [...chart.columns],
        rows: chart.rows.map((row) => [...row]),
        status: chart.status,
        assignmentType: "none", // Reset assignment on duplication
        assignmentTargetId: null
      };

      const res = await fetch("/api/admin/size-charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copyData)
      });

      if (res.ok) {
        toast.success("Size chart duplicated successfully");
        fetchSizeCharts();
      } else {
        const data = await res.json();
        toast.error(data.error || "Duplication failed");
      }
    } catch (err) {
      toast.error("Duplication failed");
    }
  };

  // Handle Bulk Actions
  const handleBulkSubmit = async () => {
    if (selectedIds.length === 0) return toast.error("No items selected");
    if (bulkAction === "Bulk actions") return toast.error("Please select a bulk action");

    if (bulkAction === "delete") {
      const ok = await showConfirm(`Are you sure you want to bulk-delete ${selectedIds.length} size charts?`);
      if (!ok) return;
      let successes = 0;
      for (const id of selectedIds) {
        try {
          const res = await fetch(`/api/admin/size-charts/${id}`, { method: "DELETE" });
          if (res.ok) successes++;
        } catch (e) {}
      }
      toast.success(`Deleted ${successes} size charts`);
      setSelectedIds([]);
      fetchSizeCharts();
    } else if (bulkAction === "publish" || bulkAction === "draft") {
      const newStatus = bulkAction === "publish" ? "Published" : "Draft";
      let successes = 0;
      for (const id of selectedIds) {
        try {
          const res = await fetch(`/api/admin/size-charts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
          });
          if (res.ok) successes++;
        } catch (e) {}
      }
      toast.success(`Updated ${successes} size charts to ${newStatus}`);
      setSelectedIds([]);
      fetchSizeCharts();
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredCharts.map((c) => c._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Filter & Search Logic
  const filteredCharts = sizeCharts.filter((chart) => {
    const matchesSearch =
      chart.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chart.publicHeading.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      selectedStatus === "All statuses" || chart.status === selectedStatus;

    let matchesAssignment = true;
    if (selectedAssignment === "Category") {
      matchesAssignment = chart.assignmentType === "category";
    } else if (selectedAssignment === "Product") {
      matchesAssignment = chart.assignmentType === "product";
    } else if (selectedAssignment === "Unassigned") {
      matchesAssignment = chart.assignmentType === "none" || !chart.assignmentType;
    }

    return matchesSearch && matchesStatus && matchesAssignment;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredCharts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCharts = filteredCharts.slice(startIndex, startIndex + itemsPerPage);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <AdminPageLayout
      title="Size Charts"
      subtitle="Manage reusable dynamic size charts and assignments"
      addNewLink="/admin/products/size-charts/new"
      addNewLabel="Add Size Chart"
      breadcrumbs={[{ label: "Products", href: "/admin/products" }, { label: "Size Charts" }]}
    >
      <div className="bg-white border border-[#ccd0d4] rounded-[4px] shadow-sm">
        
        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-[#ccd0d4] flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search size charts..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-4 py-1.5 border border-[#8c8f94] bg-white text-[13px] rounded-[3px] outline-none focus:border-[#2271b1] w-full"
              />
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="px-3 py-1.5 border border-[#8c8f94] bg-white text-[13px] rounded-[3px] outline-none focus:border-[#2271b1] h-[34px] cursor-pointer"
            >
              <option>All statuses</option>
              <option>Published</option>
              <option>Draft</option>
            </select>

            {/* Assignment Filter */}
            <select
              value={selectedAssignment}
              onChange={(e) => { setSelectedAssignment(e.target.value); setCurrentPage(1); }}
              className="px-3 py-1.5 border border-[#8c8f94] bg-white text-[13px] rounded-[3px] outline-none focus:border-[#2271b1] h-[34px] cursor-pointer"
            >
              <option>All assignments</option>
              <option>Category</option>
              <option>Product</option>
              <option>Unassigned</option>
            </select>
          </div>

          <div className="flex gap-2">
            {/* Bulk Actions */}
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="px-3 py-1.5 border border-[#8c8f94] bg-white text-[13px] rounded-[3px] outline-none focus:border-[#2271b1] h-[34px] cursor-pointer"
            >
              <option>Bulk actions</option>
              <option value="publish">Publish</option>
              <option value="draft">Move to Draft</option>
              <option value="delete">Delete</option>
            </select>
            <button
              onClick={handleBulkSubmit}
              className="bg-white border border-[#8c8f94] text-[#2c3338] px-4 py-1.5 rounded-[3px] text-[13px] font-bold hover:bg-[#f6f7f7] transition-all cursor-pointer h-[34px]"
            >
              Apply
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="w-full overflow-x-auto">
          {loading ? (
            <div className="text-center py-12">
              <span className="text-[13px] text-gray-500 font-medium">Loading size charts...</span>
            </div>
          ) : paginatedCharts.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <span className="text-[13px] text-gray-500 font-medium block">No size charts found.</span>
              <Link href="/admin/products/size-charts/new" className="text-[13px] text-[#2271b1] hover:underline mt-1 inline-block">
                Create one now
              </Link>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4] text-[#2c3338] font-bold">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={selectedIds.length > 0 && selectedIds.length === filteredCharts.length}
                    />
                  </th>
                  <th className="p-3 font-semibold">Label</th>
                  <th className="p-3 font-semibold">Assigned To</th>
                  <th className="p-3 font-semibold text-center">Products Using</th>
                  <th className="p-3 font-semibold">Last Updated</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ccd0d4]">
                {paginatedCharts.map((chart) => {
                  const isChecked = selectedIds.includes(chart._id);
                  return (
                    <tr key={chart._id} className="hover:bg-[#f6f7f7]/50 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSelectOne(chart._id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#1d2327]">
                          <Link href={`/admin/products/size-charts/${chart._id}`} className="hover:text-[#2271b1]">
                            {chart.label}
                          </Link>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Heading: "{chart.publicHeading}"
                        </div>
                      </td>
                      <td className="p-3">
                        {chart.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 border border-blue-200 text-blue-700">
                              {chart.assignedTo.type}
                            </span>
                            <span className="font-medium text-[#2c3338]">{chart.assignedTo.name}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-bold text-[#2c3338]">{chart.usageCount}</td>
                      <td className="p-3 text-gray-500">{formatDate(chart.updatedAt)}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[12px] text-[11px] font-medium leading-none ${
                            chart.status === "Published"
                              ? "bg-green-50 border border-green-200 text-green-700"
                              : "bg-gray-50 border border-gray-200 text-gray-600"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${chart.status === "Published" ? "bg-green-500" : "bg-gray-400"}`} />
                          {chart.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewChart(chart)}
                            title="Preview"
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(chart)}
                            title="Duplicate"
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/admin/products/size-charts/${chart._id}`}
                            title="Edit"
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(chart._id)}
                            title="Delete"
                            className="p-1.5 rounded hover:bg-gray-100 text-red-500 hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#ccd0d4] flex items-center justify-between text-[13px] text-gray-500 bg-[#f6f7f7]/30">
            <span>
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredCharts.length)} of{" "}
              {filteredCharts.length} items
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 border border-[#ccd0d4] rounded bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 border border-[#ccd0d4] rounded bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Preview Modal */}
      {previewChart && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewChart(null)}>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-black" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-black shrink-0">
              <span className="text-[13px] font-bold uppercase tracking-widest text-black">
                {previewChart.publicHeading}
              </span>
              <button
                onClick={() => setPreviewChart(null)}
                className="w-8 h-8 flex items-center justify-center border border-black hover:bg-black hover:text-white transition-all text-black"
              >
                ×
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {previewChart.description && (
                <p className="text-xs text-neutral-500 leading-relaxed italic">{previewChart.description}</p>
              )}
              
              <div className="w-full overflow-x-auto border border-black rounded">
                <table className="w-full text-left border-collapse text-[11px] sm:text-[12px]">
                  <thead>
                    <tr className="bg-black/5 border-b border-black font-bold uppercase text-black">
                      {previewChart.columns.map((col, idx) => (
                        <th key={idx} className="px-3 py-2.5 whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10">
                    {previewChart.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-black/[0.02] text-black">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className={`px-3 py-2.5 ${cellIdx === 0 ? "font-bold" : ""}`}>
                            {cell || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
