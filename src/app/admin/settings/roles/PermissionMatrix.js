"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ALL_PERMISSIONS } from "@/lib/rbac";

export const prettifyPermission = (key) => String(key).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function countPermissions(permissions) {
  return Object.values(permissions || {}).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
}

export const TOTAL_PERMISSIONS = countPermissions(ALL_PERMISSIONS);

/**
 * Module-by-module permission checkboxes. Each module is a block with a header row
 * (name, granted/total, "All" toggle, collapse) and its actions in a grid that wraps to
 * two columns on a phone, so it stays usable at 390px.
 */
export default function PermissionMatrix({ permissions = {}, onChange, disabled = false, idPrefix = "perm" }) {
  const [collapsed, setCollapsed] = useState({});

  const setModule = (module, actions) => onChange({ ...permissions, [module]: actions });

  const toggle = (module, action) => {
    const current = permissions[module] || [];
    setModule(module, current.includes(action) ? current.filter((a) => a !== action) : [...current, action]);
  };

  const toggleAll = (module, actions) => {
    const current = permissions[module] || [];
    setModule(module, actions.every((a) => current.includes(a)) ? [] : [...actions]);
  };

  return (
    <div style={{ border: "1px solid #dcdcde" }}>
      {Object.entries(ALL_PERMISSIONS).map(([module, actions], i) => {
        const current = permissions[module] || [];
        const granted = actions.filter((a) => current.includes(a)).length;
        const allOn = granted === actions.length;
        const isOpen = !collapsed[module];
        const groupId = `${idPrefix}-${module}`;
        return (
          <fieldset
            key={module}
            disabled={disabled}
            style={{
              margin: 0,
              padding: "6px 12px 8px",
              border: 0,
              borderTop: i === 0 ? 0 : "1px solid #dcdcde",
              background: i % 2 ? "#f6f7f7" : "#fff",
              minWidth: 0,
            }}
          >
            <legend className="sr-only">{prettifyPermission(module)} permissions</legend>
            <div className="flex items-center gap-3" style={{ minHeight: 36, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [module]: !prev[module] }))}
                aria-expanded={isOpen}
                aria-controls={groupId}
                className="flex items-center gap-2"
                style={{ background: "none", border: 0, padding: 0, cursor: "pointer", minHeight: 36, color: "inherit", textAlign: "left" }}
              >
                <span className="wp-strong">{prettifyPermission(module)}</span>
                <span className="wp-muted wp-small">{granted}/{actions.length}</span>
                {isOpen ? <ChevronUp className="w-4 h-4 wp-muted" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 wp-muted" aria-hidden="true" />}
              </button>
              <span style={{ flex: 1 }} />
              <label className="wp-check wp-small" style={{ minHeight: 36 }}>
                <input
                  type="checkbox"
                  checked={allOn}
                  ref={(el) => { if (el) el.indeterminate = granted > 0 && !allOn; }}
                  onChange={() => toggleAll(module, actions)}
                  aria-label={`Grant all ${prettifyPermission(module)} permissions`}
                />
                <span>All</span>
              </label>
            </div>
            {isOpen && (
              <div
                id={groupId}
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", columnGap: 16 }}
              >
                {actions.map((action) => (
                  <label key={action} className="wp-check" style={{ minHeight: 36 }}>
                    <input
                      type="checkbox"
                      checked={current.includes(action)}
                      onChange={() => toggle(module, action)}
                    />
                    <span>{prettifyPermission(action)}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
