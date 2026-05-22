import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, FolderPlus, FilePlus } from 'lucide-react';
import ConditionRow from './ConditionRow';

export default function RuleGroupBlock({ group, path = "", index = 0, onUpdate, onAdd, onRemove, depth = 0 }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getConnectorColor = () => {
    if (group.operator === 'OR') return 'border-amber-400 text-amber-600 bg-amber-50';
    if (group.operator === 'NOT') return 'border-rose-400 text-rose-600 bg-rose-50';
    return 'border-[#2271b1] text-[#2271b1] bg-[#f0f6fa]';
  };

  return (
    <div className={`mt-2 ml-${depth > 0 ? '6' : '0'} border-l-2 pl-4 py-2 relative`} style={{ borderLeftColor: group.operator === 'OR' ? '#fbbf24' : '#2271b1' }}>
      {/* Group Header */}
      <div className="flex items-center gap-2 mb-2">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-0.5 hover:bg-gray-100 rounded-sm"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <div className={`flex items-center border rounded-sm px-2 py-0.5 text-[11px] font-bold uppercase tracking-tight ${getConnectorColor()}`}>
          <select 
            value={group.operator || 'AND'} 
            onChange={(e) => onUpdate(`${path}${path ? '.' : ''}operator`, e.target.value)}
            className="bg-transparent outline-none cursor-pointer"
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
            <option value="NOT">NOT</option>
          </select>
        </div>

        <div className="flex-1 h-[1px] bg-gray-100"></div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <button 
             onClick={() => onAdd(path, 'rule')}
             className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#2271b1] hover:bg-[#f0f6fa] rounded-sm transition-colors border border-transparent hover:border-[#2271b1]"
           >
             <FilePlus className="w-3 h-3" /> Add Rule
           </button>
           <button 
             onClick={() => onAdd(path, 'group')}
             className="flex items-center gap-1 px-2 py-1 text-[11px] text-emerald-600 hover:bg-emerald-50 rounded-sm transition-colors border border-transparent hover:border-emerald-500"
           >
             <FolderPlus className="w-3 h-3" /> Add Group
           </button>
           {depth > 0 && (
             <button 
               onClick={() => onRemove(path.split('.').slice(0, -1).join('.'), index)}
               className="p-1 text-gray-400 hover:text-rose-600 rounded-sm"
             >
               <Trash2 className="w-3 h-3" />
             </button>
           )}
        </div>
      </div>

      {/* Group Content */}
      {!isCollapsed && (
        <div className="space-y-2 group">
          {group.rules?.map((rule, idx) => {
            const currentPath = `${path}${path ? '.' : ''}rules.${idx}`;
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
                />
              );
            }
          })}

          {(!group.rules || group.rules.length === 0) && (
            <div className="text-[12px] text-gray-400 italic py-2 pl-2 border border-dashed border-gray-200 rounded-sm bg-gray-50">
              No rules in this group. Click &quot;Add Rule&quot; to begin.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
