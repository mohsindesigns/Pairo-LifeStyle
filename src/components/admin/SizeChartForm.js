"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Download,
  Upload,
  Eye,
  Sliders,
  HelpCircle
} from "lucide-react";
import { toast } from "react-hot-toast";

const inputClass =
  "border border-[#8c8f94] bg-white text-[13px] px-3 py-2 rounded-[3px] outline-none focus:border-[#2271b1] w-full";

export default function SizeChartForm({ initialId = null }) {
  const router = useRouter();
  const isNew = !initialId;

  // Form states
  const [label, setLabel] = useState("");
  const [publicHeading, setPublicHeading] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Published");
  const [assignmentType, setAssignmentType] = useState("none");
  const [assignmentTargetId, setAssignmentTargetId] = useState("");
  
  // Table state (columns and rows)
  const [columns, setColumns] = useState(["Size", "Chest", "Waist", "Sleeve"]);
  const [rows, setRows] = useState([
    ["XS", "", "", ""],
    ["S", "", "", ""],
    ["M", "", "", ""],
    ["L", "", "", ""]
  ]);

  // Dropdown list states
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTarget, setSearchTarget] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Fetch initial data (if editing) & categories/products
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch categories & products in parallel
        const [catsRes, prodsRes] = await Promise.all([
          fetch("/api/admin/categories"),
          fetch("/api/admin/products")
        ]);
        
        const catsData = await catsRes.json();
        const prodsData = await prodsRes.json();

        setCategories(Array.isArray(catsData) ? catsData : []);
        // Only load published products for clean assignment list
        setProducts(Array.isArray(prodsData) ? prodsData.filter(p => p.status === "Published" && !p.isDeleted) : []);

        // Load specific size chart if editing
        if (!isNew) {
          const res = await fetch(`/api/admin/size-charts/${initialId}`);
          if (res.ok) {
            const chart = await res.json();
            setLabel(chart.label || "");
            setPublicHeading(chart.publicHeading || "");
            setDescription(chart.description || "");
            setStatus(chart.status || "Published");
            setAssignmentType(chart.assignmentType || "none");
            setAssignmentTargetId(chart.assignmentTargetId || "");
            if (chart.columns && chart.columns.length > 0) {
              setColumns(chart.columns);
            }
            if (chart.rows && chart.rows.length > 0) {
              setRows(chart.rows);
            }
          } else {
            toast.error("Size chart not found");
            router.push("/admin/products/size-charts");
          }
        }
      } catch (err) {
        toast.error("Failed to load initial data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [initialId, isNew, router]);

  // Reset target ID when type changes
  const handleAssignmentTypeChange = (newType) => {
    setAssignmentType(newType);
    setAssignmentTargetId("");
    setSearchTarget("");
  };

  // Dynamic Spreadsheet Actions
  const handleAddColumn = () => {
    const colName = prompt("Enter column header name:");
    if (!colName || !colName.trim()) return;

    if (columns.some(col => col.toLowerCase() === colName.trim().toLowerCase())) {
      return toast.error("Column header must be unique");
    }

    setColumns(prev => [...prev, colName.trim()]);
    setRows(prev => prev.map(row => [...row, ""]));
    toast.success("Column added");
  };

  const handleDeleteColumn = (index) => {
    if (columns.length <= 1) {
      return toast.error("You must keep at least one column.");
    }
    if (!confirm(`Delete column "${columns[index]}"? all data in this column will be lost.`)) return;

    setColumns(prev => prev.filter((_, i) => i !== index));
    setRows(prev => prev.map(row => row.filter((_, i) => i !== index)));
  };

  const handleRenameColumn = (index, currentName) => {
    const newName = prompt("Rename column header:", currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;

    if (columns.some((col, i) => i !== index && col.toLowerCase() === newName.trim().toLowerCase())) {
      return toast.error("Column header must be unique");
    }

    setColumns(prev => {
      const updated = [...prev];
      updated[index] = newName.trim();
      return updated;
    });
  };

  const handleMoveColumn = (index, direction) => {
    const newIndex = direction === "left" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= columns.length) return;

    setColumns(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      return updated;
    });

    setRows(prev =>
      prev.map(row => {
        const updatedRow = [...row];
        const tempCell = updatedRow[index];
        updatedRow[index] = updatedRow[newIndex];
        updatedRow[newIndex] = tempCell;
        return updatedRow;
      })
    );
  };

  const handleAddRow = () => {
    setRows(prev => [...prev, Array(columns.length).fill("")]);
  };

  const handleDeleteRow = (index) => {
    if (rows.length <= 1) {
      return toast.error("You must keep at least one row.");
    }
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveRow = (index, direction) => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rows.length) return;

    setRows(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      return updated;
    });
  };

  const handleCellChange = (rowIndex, colIndex, value) => {
    setRows(prev =>
      prev.map((row, rIdx) => {
        if (rIdx !== rowIndex) return row;
        const updatedRow = [...row];
        updatedRow[colIndex] = value;
        return updatedRow;
      })
    );
  };

  // CSV Import/Export
  const handleExportCSV = () => {
    const headers = columns.join(",");
    const csvRows = rows.map(row =>
      row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...csvRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${toSlug(label || "size_chart")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length === 0) return toast.error("The CSV file is empty");

      // Parse headers
      const csvCols = lines[0].split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
      
      // Parse rows
      const csvRows = lines.slice(1).map(line => {
        // Regex to split CSV columns handles quotes properly
        const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^["']|["']$/g, "").replace(/""/g, '"'));
        // Pad row cells if they are shorter than column count
        while (cells.length < csvCols.length) {
          cells.push("");
        }
        return cells.slice(0, csvCols.length);
      });

      setColumns(csvCols);
      setRows(csvRows);
      toast.success("CSV Imported successfully!");
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input file
  };

  // Save/Publish
  const handleSave = async () => {
    if (!label.trim()) return toast.error("Size Chart Label is required");
    if (!publicHeading.trim()) return toast.error("Public Heading is required");
    if (columns.some(col => !col.trim())) return toast.error("Column headers cannot be empty");
    
    // Filter out rows that are entirely empty
    const cleanedRows = rows.filter(row => row.some(cell => cell.trim() !== ""));
    if (cleanedRows.length === 0) return toast.error("Spreadsheet must contain at least one row of measurements");

    if (assignmentType !== "none" && !assignmentTargetId) {
      return toast.error(`Please select a target ${assignmentType} for assignment`);
    }

    setSaving(true);
    try {
      const payload = {
        label: label.trim(),
        publicHeading: publicHeading.trim(),
        description: description.trim(),
        columns,
        rows: cleanedRows,
        status,
        assignmentType,
        assignmentTargetId: assignmentTargetId || null
      };

      const url = isNew ? "/api/admin/size-charts" : `/api/admin/size-charts/${initialId}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Save failed");

      toast.success(isNew ? "Size chart created!" : "Size chart updated!");
      router.push("/admin/products/size-charts");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Helper Slugifier
  const toSlug = (str) => {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "_")
      .replace(/^-+|-+$/g, "");
  };

  // Filtered dropdown lists for assignment target selection
  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchTarget.toLowerCase())
  );
  
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTarget.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 font-medium">
        Loading editor data...
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">

      {/* Editor Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 sm:p-4 border border-[#ccd0d4] rounded-[4px] shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* CSV Import */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 border border-[#8c8f94] hover:bg-neutral-50 text-[13px] font-bold rounded-[3px] cursor-pointer text-gray-700">
            <Upload className="w-4 h-4 text-gray-500" />
            Import CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>

          {/* CSV Export */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#8c8f94] hover:bg-neutral-50 text-[13px] font-bold rounded-[3px] cursor-pointer text-gray-700"
          >
            <Download className="w-4 h-4 text-gray-500" />
            Export CSV
          </button>

          {/* Preview Size Chart */}
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#8c8f94] hover:bg-neutral-50 text-[13px] font-bold rounded-[3px] cursor-pointer text-gray-700"
          >
            <Eye className="w-4 h-4 text-gray-500" />
            Preview Chart
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin/products/size-charts")}
            className="px-4 py-1.5 border border-[#8c8f94] text-black text-[13px] font-bold hover:bg-[#f6f7f7] rounded-[3px] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-[#2271b1] hover:bg-[#135e96] border border-[#135e96] text-white text-[13px] font-bold rounded-[3px] cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Chart"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 items-start">
        
        {/* Left Column: Spreadsheet Table Builder */}
        <div className="lg:col-span-2 min-w-0 bg-white border border-[#ccd0d4] rounded-[4px] p-3 sm:p-4 md:p-6 shadow-sm space-y-4 md:space-y-6">
          <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 border-b border-[#ccd0d4] pb-3.5">
            <h2 className="text-[14px] font-bold text-[#1d2327] min-w-0 break-words">Size Measurements Spreadsheet</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAddColumn}
                className="flex items-center gap-1 px-3 py-1 border border-[#2271b1] hover:bg-blue-50 text-[#2271b1] text-[12px] font-bold rounded-[3px] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Column
              </button>
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1 px-3 py-1 border border-[#2271b1] hover:bg-blue-50 text-[#2271b1] text-[12px] font-bold rounded-[3px] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Row
              </button>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div className="w-full max-w-full overflow-x-auto border border-[#ccd0d4] rounded bg-gray-50">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-neutral-100 border-b border-[#ccd0d4]">
                  {columns.map((col, idx) => (
                    <th key={idx} className="p-2 border-r border-[#ccd0d4] group min-w-[120px] relative">
                      <div className="flex items-center justify-between gap-1.5 px-1 py-1">
                        <button
                          type="button"
                          onClick={() => handleRenameColumn(idx, col)}
                          title="Click to rename"
                          className="font-bold text-[12px] text-gray-700 hover:text-[#2271b1] truncate block text-left"
                        >
                          {col}
                        </button>
                        
                        {/* Column actions */}
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMoveColumn(idx, "left")}
                              className="p-1.5 md:p-0.5 hover:bg-gray-200 rounded text-gray-500"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                          {idx < columns.length - 1 && (
                            <button
                              type="button"
                              onClick={() => handleMoveColumn(idx, "right")}
                              className="p-1.5 md:p-0.5 hover:bg-gray-200 rounded text-gray-500"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteColumn(idx)}
                            className="p-1.5 md:p-0.5 hover:bg-red-100 rounded text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="p-2 w-20 text-center text-[11px] font-bold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ccd0d4]">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="bg-white hover:bg-gray-50/50">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-1 border-r border-[#ccd0d4]">
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                          placeholder="—"
                          className="w-full text-[13px] px-2 py-1.5 border-0 focus:ring-1 focus:ring-[#2271b1] outline-none rounded bg-transparent focus:bg-white text-gray-800"
                        />
                      </td>
                    ))}
                    <td className="p-1.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-0.5">
                        {rIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveRow(rIdx, "up")}
                            className="p-1.5 md:p-1 hover:bg-gray-100 rounded text-gray-500"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                        )}
                        {rIdx < rows.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMoveRow(rIdx, "down")}
                            className="p-1.5 md:p-1 hover:bg-gray-100 rounded text-gray-500"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(rIdx)}
                          className="p-1.5 md:p-1 hover:bg-red-50 rounded text-red-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-gray-400 flex items-start gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
            <span>
              Tip: Click on a column header name to rename it. Use the arrows to reorder rows and columns. Empty rows will be filtered out on save.
            </span>
          </div>
        </div>

        {/* Right Column: Size Chart Details & Assignments */}
        <div className="min-w-0 space-y-4 md:space-y-6">
          
          {/* General Configuration */}
          <div className="bg-white border border-[#ccd0d4] rounded-[4px] p-3 sm:p-5 shadow-sm space-y-4">
            <h2 className="text-[14px] font-bold text-[#1d2327] border-b border-[#ccd0d4] pb-2.5 mb-2">General Settings</h2>
            
            {/* Label (Admin Name) */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">
                Size Chart Label (Admin Name) *
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Men's Shearling Jacket"
                className={inputClass}
              />
            </div>

            {/* Public Heading */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">
                Public Heading *
              </label>
              <input
                type="text"
                value={publicHeading}
                onChange={(e) => setPublicHeading(e.target.value)}
                placeholder="e.g. Shearling Jacket Size Guide"
                className={inputClass}
              />
            </div>

            {/* Short Description */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">
                Short Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Instructions on fitting or measurements..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 border border-[#8c8f94] bg-white text-[13px] rounded-[3px] outline-none focus:border-[#2271b1] w-full cursor-pointer h-[38px]"
              >
                <option>Published</option>
                <option>Draft</option>
              </select>
            </div>
          </div>

          {/* Assignment Rules */}
          <div className="bg-white border border-[#ccd0d4] rounded-[4px] p-3 sm:p-5 shadow-sm space-y-4">
            <h2 className="text-[14px] font-bold text-[#1d2327] border-b border-[#ccd0d4] pb-2.5 mb-2">Assignment Rules</h2>
            
            {/* Apply Size Chart To */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">
                Apply Size Chart To
              </label>
              <select
                value={assignmentType}
                onChange={(e) => handleAssignmentTypeChange(e.target.value)}
                className="px-3 py-2 border border-[#8c8f94] bg-white text-[13px] rounded-[3px] outline-none focus:border-[#2271b1] w-full cursor-pointer h-[38px]"
              >
                <option value="none">Unassigned (None)</option>
                <option value="category">Category</option>
                <option value="product">Product</option>
              </select>
            </div>

            {/* If Category is chosen */}
            {assignmentType === "category" && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1">
                  Select Category *
                </label>
                <input
                  type="text"
                  placeholder="Filter categories..."
                  value={searchTarget}
                  onChange={(e) => setSearchTarget(e.target.value)}
                  className={`${inputClass} mb-2`}
                />
                <div className="max-h-40 overflow-y-auto border border-[#ccd0d4] rounded bg-white divide-y divide-[#ccd0d4]">
                  {filteredCategories.length === 0 ? (
                    <div className="p-3 text-[12px] text-gray-500 italic">No matching categories</div>
                  ) : (
                    filteredCategories.map(cat => (
                      <button
                        key={cat._id}
                        type="button"
                        onClick={() => { setAssignmentTargetId(cat._id); setSearchTarget(cat.name); }}
                        className={`w-full text-left break-words px-3 py-2 text-[13px] hover:bg-neutral-50 ${assignmentTargetId === cat._id ? "bg-blue-50 font-bold text-[#2271b1]" : "text-gray-700"}`}
                      >
                        {cat.name}
                      </button>
                    ))
                  )}
                </div>
                {assignmentTargetId && (
                  <div className="text-[11px] text-green-700 font-bold flex items-center gap-1 mt-1 bg-green-50 px-2 py-1.5 border border-green-200 rounded">
                    Selected category: {categories.find(c => c._id === assignmentTargetId)?.name}
                  </div>
                )}
              </div>
            )}

            {/* If Product is chosen */}
            {assignmentType === "product" && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1">
                  Select Product *
                </label>
                <input
                  type="text"
                  placeholder="Filter products..."
                  value={searchTarget}
                  onChange={(e) => setSearchTarget(e.target.value)}
                  className={`${inputClass} mb-2`}
                />
                <div className="max-h-40 overflow-y-auto border border-[#ccd0d4] rounded bg-white divide-y divide-[#ccd0d4]">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-[12px] text-gray-500 italic">No matching products</div>
                  ) : (
                    filteredProducts.map(prod => (
                      <button
                        key={prod._id}
                        type="button"
                        onClick={() => { setAssignmentTargetId(prod._id); setSearchTarget(prod.name); }}
                        className={`w-full text-left break-words px-3 py-2 text-[13px] hover:bg-neutral-50 ${assignmentTargetId === prod._id ? "bg-blue-50 font-bold text-[#2271b1]" : "text-gray-700"}`}
                      >
                        {prod.name}
                      </button>
                    ))
                  )}
                </div>
                {assignmentTargetId && (
                  <div className="text-[11px] text-green-700 font-bold flex items-center gap-1 mt-1 bg-green-50 px-2 py-1.5 border border-green-200 rounded">
                    Selected product: {products.find(p => p._id === assignmentTargetId)?.name}
                  </div>
                )}
              </div>
            )}
          </div>
          
        </div>
      </div>

      {/* Preview Modal Component */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto" onClick={() => setShowPreview(false)}>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] flex flex-col overflow-hidden border border-black animate-sg-in" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-3 sm:py-4 border-b border-black shrink-0">
              <span className="text-[13px] font-bold uppercase tracking-widest text-black min-w-0 break-words">
                {publicHeading || "Preview Size Guide"}
              </span>
              <button
                onClick={() => setShowPreview(false)}
                className="w-8 h-8 shrink-0 flex items-center justify-center border border-black hover:bg-black hover:text-white transition-all text-black font-medium"
              >
                ×
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6">
              {description && (
                <p className="text-xs text-neutral-500 leading-relaxed italic">{description}</p>
              )}
              
              <div className="w-full max-w-full overflow-x-auto border border-black rounded">
                <table className="w-full text-left border-collapse text-[11px] sm:text-[12px]">
                  <thead>
                    <tr className="bg-black/5 border-b border-black font-bold uppercase text-black">
                      {columns.map((col, idx) => (
                        <th key={idx} className="px-3 py-2.5 whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10">
                    {rows.filter(row => row.some(cell => cell.trim() !== "")).map((row, rowIdx) => (
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

      <style>{`
        @keyframes sgIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-sg-in { animation: sgIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
}
