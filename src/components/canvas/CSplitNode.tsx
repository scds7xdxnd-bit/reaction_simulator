import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { CSplitNodeData } from '../../types/reactor';
import { useNodeIssues } from '../../context/ValidationContext';

function CSplitNode({ id, data, selected }: { id: string; data: CSplitNodeData; selected?: boolean }) {
  const { updateNodeData } = useReactFlow();
  const { isOffPath } = useNodeIssues(id);

  const fracs = data.splitFractions ?? {};
  const speciesKeys = Object.keys(fracs);

  return (
    <div
      title={isOffPath ? 'Not in active flow path' : undefined}
      style={{
        width: 120,
        minHeight: 80,
        borderRadius: 8,
        background: '#ffffff',
        borderTop:    isOffPath ? '2px dashed #f97316' : '3px solid #0891b2',
        borderRight:  isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderBottom: isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderLeft:   isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        boxShadow: selected ? '0 0 0 3px #0891b240' : 'none',
        padding: '6px 8px',
      }}
    >
      <Handle type="target" position={Position.Left} id="in"
        style={{ width: 10, height: 10, background: '#0891b2', border: 'none', left: -5 }} />
      <Handle type="source" position={Position.Right} id="out-top"
        style={{ width: 8, height: 8, background: '#0891b2', border: 'none', right: -4, top: '28%' }} />
      <Handle type="source" position={Position.Right} id="out-bot"
        style={{ width: 8, height: 8, background: '#0891b2', border: 'none', right: -4, top: '72%' }} />

      <div className="text-[10px] font-medium text-[#0891b2] uppercase tracking-wider text-center mb-1">
        CSplit
      </div>
      <div className="text-[9px] font-mono text-[#374151] text-center mb-1">{data.label}</div>

      {speciesKeys.length === 0 ? (
        <div className="text-[8.5px] text-[#6b7280] text-center">ξ = 0.50 (all)</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {speciesKeys.slice(0, 4).map((sp) => (
            <div key={sp} className="flex items-center justify-between gap-1">
              <span className="text-[8.5px] text-[#374151]">ξ<sub>{sp}</sub></span>
              <input
                type="number"
                min="0" max="1" step="0.05"
                value={fracs[sp] ?? 0.5}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) {
                    updateNodeData(id, {
                      ...data,
                      splitFractions: { ...fracs, [sp]: Math.max(0, Math.min(1, v)) },
                    });
                  }
                }}
                onKeyDown={(e) => e.stopPropagation()}
                className="w-10 text-[8.5px] font-mono bg-[#f0f9ff] border border-[#bae6fd] rounded px-1 py-0.5 text-[#0f1730] outline-none focus:border-[#0891b2]"
              />
            </div>
          ))}
          {speciesKeys.length > 4 && (
            <div className="text-[8px] text-[#6b7280] text-center">+{speciesKeys.length - 4} more</div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(CSplitNode);
