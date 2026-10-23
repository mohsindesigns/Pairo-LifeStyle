"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import { Postbox } from "@/components/admin/ui";

// Compact button used inside the spreadsheet header/rows
const miniBtn = { minHeight: 26, padding: "0 6px", lineHeight: 1 };

export default function SizeChartForm({ initialId = null }) {
  const router = useRouter();
  const { showPrompt, showConfirm } = usePopup();
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
  const handleAddColumn = async () => {
    const colName = await showPrompt("Enter column header name:", "", "Add column");
    if (!colName || !colName.trim()) return;

    if (columns.some(col => col.toLowerCase() === colName.trim().toLowerCase())) {
      return toast.error("Column header must be unique");
    }

    setColumns(prev => [...prev, colName.trim()]);
    setRows(prev => prev.map(row => [...row, ""]));
    toast.success("Column added");
  };

  const handleDeleteColumn = async (index) => {
    if (columns.length <= 1) {
      return toast.error("You must keep at least one column.");
    }
    if (!(await showConfirm(`Delete column "${columns[index]}"? All data in this column will be lost.`, "Delete column", { confirmText: "Delete", danger: true }))) return;

    setColumns(prev => prev.filter((_, i) => i !== index));
    setRows(prev => prev.map(row => row.filter((_, i) => i !== index)));
  };

  const handleRenameColumn = async (index, currentName) => {
    const newName = await showPrompt("Rename column header:", currentName, "Rename column");
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
      <p className="wp-muted">Loading editor data…</p>
    );
  }

  const selectedCategoryName = categories.find(c => c._id === assignmentTargetId)?.name;
  const selectedProductName = products.find(p => p._id === assignmentTargetId)?.name;

  return (
    <div className="wp-cols">
      {/* Main column */}
      <div className="wp-col-main">
        <div className="wp-field">
          <label htmlFor="sc-label" className="sr-only">Size chart label (admin name)</label>
          <input
            id="sc-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Size chart label, e.g. Men's Shearling Jacket"
            className="wp-title-input"
          />
          <p className="wp-desc">Admin name, required. Shoppers see the public heading instead.</p>
        </div>

        <Postbox title="Size chart details" id="sc-details">
          <div className="wp-frow">
            <label htmlFor="sc-heading" className="wp-flabel">Public heading <span style={{ color: "#d63638" }}>*</span></label>
            <input
              id="sc-heading"
              type="text"
              value={publicHeading}
              onChange={(e) => setPublicHeading(e.target.value)}
              placeholder="e.g. Shearling Jacket Size Guide"
              className="wp-input"
            />
          </div>
          <div className="wp-frow" style={{ alignItems: "flex-start" }}>
            <label htmlFor="sc-description" className="wp-flabel">Short description</label>
            <textarea
              id="sc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Instructions on fitting or measurements..."
              className="wp-textarea"
              style={{ flex: "1 1 320px", minWidth: 0 }}
            />
            <span className="wp-hint">Optional.</span>
          </div>
        </Postbox>

        <Postbox
          title="Measurements"
          id="sc-sheet"
          aside={
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
              <button type="button" onClick={handleAddColumn} className="wp-btn">Add column</button>
              <button type="button" onClick={handleAddRow} className="wp-btn">Add row</button>
            </span>
          }
        >
          <div className="wp-table-box">
            <table className="wp-list-table" style={{ minWidth: Math.max(480, columns.length * 130 + 120) }}>
              <thead>
                <tr>
                  {columns.map((col, idx) => (
                    <th key={idx} scope="col" style={{ minWidth: 120, verticalAlign: "top" }}>
                      <button
                        type="button"
                        onClick={() => handleRenameColumn(idx, col)}
                        title="Click to rename"
                        aria-label={`Rename column ${col}`}
                        className="wp-link wp-strong"
                        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", wordBreak: "break-word" }}
                      >
                        {col}
                      </button>
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveColumn(idx, "left")}
                            className="wp-btn"
                            style={miniBtn}
                            aria-label={`Move column ${col} left`}
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                        )}
                        {idx < columns.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMoveColumn(idx, "right")}
                            className="wp-btn"
                            style={miniBtn}
                            aria-label={`Move column ${col} right`}
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteColumn(idx)}
                          className="wp-btn"
                          style={{ ...miniBtn, color: "#d63638" }}
                          aria-label={`Delete column ${col}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th scope="col" style={{ width: 110 }}><span className="sr-only">Row actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={{ padding: 4 }}>
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                          placeholder="—"
                          aria-label={`${columns[cIdx] || `Column ${cIdx + 1}`}, row ${rIdx + 1}`}
                          className="wp-input"
                          style={{ width: "100%", minWidth: 80, fontWeight: cIdx === 0 ? 600 : undefined }}
                        />
                      </td>
                    ))}
                    <td style={{ whiteSpace: "nowrap", padding: 4 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {rIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveRow(rIdx, "up")}
                            className="wp-btn"
                            style={miniBtn}
                            aria-label={`Move row ${rIdx + 1} up`}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                        )}
                        {rIdx < rows.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMoveRow(rIdx, "down")}
                            className="wp-btn"
                            style={miniBtn}
                            aria-label={`Move row ${rIdx + 1} down`}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(rIdx)}
                          className="wp-btn"
                          style={{ ...miniBtn, color: "#d63638" }}
                          aria-label={`Delete row ${rIdx + 1}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="wp-desc">
            Click a column header to rename it. Use the arrow buttons to reorder rows and columns. Empty rows are removed on save.
          </p>
        </Postbox>

        <Postbox title="Assignment" id="sc-assign">
          <div className="wp-frow">
            <label htmlFor="sc-assign-type" className="wp-flabel">Apply size chart to</label>
            <select
              id="sc-assign-type"
              value={assignmentType}
              onChange={(e) => handleAssignmentTypeChange(e.target.value)}
              className="wp-select"
            >
              <option value="none">Unassigned (None)</option>
              <option value="category">Category</option>
              <option value="product">Product</option>
            </select>
          </div>

          {assignmentType === "category" && (
            <div className="wp-frow" style={{ alignItems: "flex-start" }}>
              <label htmlFor="sc-target-filter" className="wp-flabel">Category <span style={{ color: "#d63638" }}>*</span></label>
              <div style={{ flex: "1 1 320px", minWidth: 0, maxWidth: 420 }}>
                <input
                  id="sc-target-filter"
                  type="search"
                  placeholder="Filter categories..."
                  value={searchTarget}
                  onChange={(e) => setSearchTarget(e.target.value)}
                  className="wp-input wp-full"
                />
                <div role="listbox" aria-label="Categories" style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #dcdcde", marginTop: 6, background: "#fff" }}>
                  {filteredCategories.length === 0 ? (
                    <div className="wp-muted" style={{ padding: 8 }}>No matching categories</div>
                  ) : (
                    filteredCategories.map(cat => (
                      <button
                        key={cat._id}
                        type="button"
                        role="option"
                        aria-selected={assignmentTargetId === cat._id}
                        onClick={() => { setAssignmentTargetId(cat._id); setSearchTarget(cat.name); }}
                        style={{
                          display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: 0,
                          borderBottom: "1px solid #f0f0f1", cursor: "pointer", wordBreak: "break-word",
                          background: assignmentTargetId === cat._id ? "#f0f6fc" : "#fff",
                          color: assignmentTargetId === cat._id ? "#2271b1" : "#1d2327",
                          fontWeight: assignmentTargetId === cat._id ? 600 : 400,
                        }}
                      >
                        {cat.name}
                      </button>
                    ))
                  )}
                </div>
                {assignmentTargetId && (
                  <p className="wp-desc">Selected category: <span className="wp-strong">{selectedCategoryName}</span></p>
                )}
              </div>
            </div>
          )}

          {assignmentType === "product" && (
            <div className="wp-frow" style={{ alignItems: "flex-start" }}>
              <label htmlFor="sc-target-filter" className="wp-flabel">Product <span style={{ color: "#d63638" }}>*</span></label>
              <div style={{ flex: "1 1 320px", minWidth: 0, maxWidth: 420 }}>
                <input
                  id="sc-target-filter"
                  type="search"
                  placeholder="Filter products..."
                  value={searchTarget}
                  onChange={(e) => setSearchTarget(e.target.value)}
                  className="wp-input wp-full"
                />
                <div role="listbox" aria-label="Products" style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #dcdcde", marginTop: 6, background: "#fff" }}>
                  {filteredProducts.length === 0 ? (
                    <div className="wp-muted" style={{ padding: 8 }}>No matching products</div>
                  ) : (
                    filteredProducts.map(prod => (
                      <button
                        key={prod._id}
                        type="button"
                        role="option"
                        aria-selected={assignmentTargetId === prod._id}
                        onClick={() => { setAssignmentTargetId(prod._id); setSearchTarget(prod.name); }}
                        style={{
                          display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: 0,
                          borderBottom: "1px solid #f0f0f1", cursor: "pointer", wordBreak: "break-word",
                          background: assignmentTargetId === prod._id ? "#f0f6fc" : "#fff",
                          color: assignmentTargetId === prod._id ? "#2271b1" : "#1d2327",
                          fontWeight: assignmentTargetId === prod._id ? 600 : 400,
                        }}
                      >
                        {prod.name}
                      </button>
                    ))
                  )}
                </div>
                {assignmentTargetId && (
                  <p className="wp-desc">Selected product: <span className="wp-strong">{selectedProductName}</span></p>
                )}
              </div>
            </div>
          )}
        </Postbox>
      </div>

      {/* Side column */}
      <div className="wp-col-side">
        <Postbox
          title="Publish"
          id="sc-publish"
          footer={
            <>
              <button
                type="button"
                onClick={() => router.push("/admin/products/size-charts")}
                className="wp-btn"
              >
                Cancel
              </button>
              <span className="wp-spacer" />
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="wp-btn wp-btn-primary"
              >
                {saving ? "Saving..." : "Save Chart"}
              </button>
            </>
          }
        >
          <div className="wp-field">
            <label htmlFor="sc-status" className="wp-label">Status</label>
            <select
              id="sc-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="wp-select wp-full"
            >
              <option>Published</option>
              <option>Draft</option>
            </select>
          </div>
          <button type="button" onClick={() => setShowPreview(true)} className="wp-btn">
            Preview chart
          </button>
        </Postbox>

        <Postbox title="Import / Export" id="sc-csv">
          <p className="wp-desc" style={{ marginTop: 0, marginBottom: 10 }}>Importing a CSV replaces the current columns and rows.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <label className="wp-btn" style={{ cursor: "pointer" }}>
              Import CSV
              <input type="file" accept=".csv" onChange={handleImportCSV} className="sr-only" />
            </label>
            <button type="button" onClick={handleExportCSV} className="wp-btn">
              Export CSV
            </button>
          </div>
        </Postbox>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="wp-modal-backdrop" onClick={() => setShowPreview(false)}>
          <div
            className="wp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sc-form-preview-title"
            style={{ maxWidth: 720 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wp-modal-head">
              <h2 id="sc-form-preview-title" style={{ minWidth: 0, wordBreak: "break-word" }}>
                {publicHeading || "Preview Size Guide"}
              </h2>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="wp-notice-dismiss"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="wp-modal-body">
              {description && (
                <p className="wp-desc" style={{ marginTop: 0, marginBottom: 12 }}>{description}</p>
              )}
              <div className="wp-table-box">
                <table className="wp-list-table">
                  <thead>
                    <tr>
                      {columns.map((col, idx) => (
                        <th key={idx} scope="col" style={{ whiteSpace: "nowrap" }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.filter(row => row.some(cell => cell.trim() !== "")).map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className={cellIdx === 0 ? "wp-strong" : undefined}>
                            {cell || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="wp-modal-foot">
              <button type="button" className="wp-btn" onClick={() => setShowPreview(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
