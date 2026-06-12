import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { PurgeNodeData } from '../../types/reactor';
import { useNodeIssues } from '../../context/ValidationContext';

function PurgeNode({ id, data, selected }: { id: string; data: PurgeNodeData; selected?: boolean }) {
  const { updateNodeData } = useReactFlow();
  const { isOffPath } = useNodeIssues(id);

  const beta = data.beta ?? 0.05;

  return (
    <div
      title={isOffPath ? 'Not in active flow path' : undefined}
      style={{
        width: 120,
        minHeight: 80,
        borderRadius: 8,
        background: '#ffffff',
        borderTop:    isOffPath ? '2px dashed #f97316' : '3px solid #ea580c',
        borderRight:  isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderBottom: isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderLeft:   isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        boxShadow: selected ? '0 0 0 3px #ea580c40' : 'none',
        padding: '6px 8px',
      }}
    >
      <Handle type="target" position={Position.Left} id="in"
        style={{ width: 10, height: 10, background: '#ea580c', border: 'none', left: -5 }} />
      <Handle type="source" position={Position.Right} id="out-vent"
        style={{ width: 8, height: 8, background: '#ea580c', border: 'none', right: -4, top: '28%' }} />
      <Handle type="source" position={Position.Right} id="out-process"
        style={{ width: 8, height: 8, background: '#ea580c', border: 'none', right: -4, top: '72%' }} />

      <div className="text-[10px] font-medium text-[#ea580c] uppercase tracking-wider text-center mb-1">
        Purge
      </div>
      <div className="text-[9px] font-mono text-[#374151] text-center mb-1">{data.label}</div>

      <div className="flex items-center justify-between gap-1">
        <span className="text-[8.5px] text-[#374151]">β</span>
        <input
          type="number" min="0" max="1" step="0.01"
          value={beta}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) updateNodeData(id, { ...data, beta: Math.max(0, Math.min(1, v)) });
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-14 text-[8.5px] font-mono bg-[#fff7ed] border border-[#fed7aa] rounded px-1 py-0.5 text-[#0f1730] outline-none focus:border-[#ea580c]"
        />
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[7px] text-[#ea580c]">vent↑</span>
        <span className="text-[7px] text-[#9ca3af]">{(beta * 100).toFixed(0)}%</span>
        <span className="text-[7px] text-[#ea580c]">proc↓</span>
      </div>
    </div>
  );
}

export default memo(PurgeNode);
