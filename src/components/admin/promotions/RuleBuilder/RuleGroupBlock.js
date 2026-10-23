import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import ConditionRow from './ConditionRow';
import { childRulePath, joinPath, parentOfGroupPath } from '../promotionEditorUtils';
import ThemedSelect from "@/components/ui/ThemedSelect";

const OPERATOR_HINT = {
  AND: 'all of the following',
  OR: 'any of the following',
  NOT: 'none of the following',
};

export default function RuleGroupBlock({ group, path = "", index = 0, onUpdate, onAdd, onRemove, depth = 0, catalogData }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getConnectorColor = () => {
    if (group.operator === 'OR') return '#dba617';
    if (group.operator === 'NOT') return '#d63638';
    return '#2271b1';
  };

  const operatorId = `rule-group-op-${path ? path.replace(/\./g, '-') : 'root'}`;

  return (
    <div
      className="min-w-0"
      style={{
        marginTop: depth > 0 ? 8 : 0,
        border: '1px solid var(--wp-border-2)',
        borderLeft: `4px solid ${getConnectorColor()}`,
        background: depth % 2 === 0 ? 'var(--wp-alt)' : '#fff',
        padding: 10,
      }}
    >
      {/* Group Header */}
      <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: isCollapsed ? 0 : 8 }}>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="wp-btn"
          style={{ padding: 0, minWidth: 40 }}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
        </button>

        <label htmlFor={operatorId} className="wp-strong">Match</label>
        <ThemedSelect
          id={operatorId}
          value={group.operator || 'AND'}
          onChange={(e) => onUpdate(joinPath(path, 'operator'), e.target.value)}
          className="wp-select"
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
          <option value="NOT">NOT</option>
        </ThemedSelect>
        <span className="wp-muted">{OPERATOR_HINT[group.operator || 'AND']}</span>

        <span className="flex-1" />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onAdd(path, 'rule')} className="wp-btn">
            Add rule
          </button>
          <button type="button" onClick={() => onAdd(path, 'group')} className="wp-btn">
            Add group
          </button>
          {depth > 0 && (
            <button
              type="button"
              onClick={() => {
                const parent = parentOfGroupPath(path);
                if (parent) onRemove(parent.parentPath, index);
              }}
              className="wp-btn"
              style={{ borderColor: 'var(--wp-danger)', color: 'var(--wp-danger)', padding: 0, minWidth: 40 }}
              aria-label="Remove group"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Group Content */}
      {!isCollapsed && (
        <div className="flex flex-col gap-2">
          {group.rules?.map((rule, idx) => {
            const currentPath = childRulePath(path, idx);
            if (rule.rules) {
              // It's a nested group
              return (
                <RuleGroupBlock
                  key={currentPath}
                  group={rule}
                  path={currentPath}
                  index={idx}
                  onUpdate={onUpdate}
                  onAdd={onAdd}
                  onRemove={onRemove}
                  depth={depth + 1}
                  catalogData={catalogData}
                />
              );
            } else {
              // It's a single rule
              return (
                <ConditionRow
                  key={currentPath}
                  rule={rule}
                  path={path}
                  index={idx}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  catalogData={catalogData}
                />
              );
            }
          })}

          {(!group.rules || group.rules.length === 0) && (
            <p className="wp-muted" style={{ margin: 0, padding: '10px 12px', border: '1px dashed var(--wp-border)', background: '#fff' }}>
              No rules in this group. Click &quot;Add rule&quot; to begin.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
