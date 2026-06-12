import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { CompNodeData } from '../../types/reactor';
import { useNodeIssues } from '../../context/ValidationContext';

function CompNode({ id, data, selected }: { id: string; data: CompNodeData; selected?: boolean }) {
  const { updateNodeData } = useReactFlow();
  const { isOffPath } = useNodeIssues(id);

  return (
    <div
      title={isOffPath ? 'Not in active flow path' : undefined}
      style={{
        width: 124,
        minHeight: 96,
        borderRadius: 8,
        background: '#ffffff',
        borderTop:    isOffPath ? '2px dashed #f97316' : '3px solid #7c3aed',
        borderRight:  isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderBottom: isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderLeft:   isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        boxShadow: selected ? '0 0 0 3px #7c3aed40' : 'none',
        padding: '6px 8px',
      }}
    >
      <Handle type="target" position={Position.Left} id="in"
        style={{ width: 10, height: 10, background: '#7c3aed', border: 'none', left: -5 }} />
      <Handle type="source" position={Position.Right} id="out"
        style={{ width: 10, height: 10, background: '#7c3aed', border: 'none', right: -5 }} />

      <div className="text-[10px] font-medium text-[#7c3aed] uppercase tracking-wider text-center mb-1">
        Comp
      </div>
      <div className="text-[9px] font-mono text-[#374151] text-center mb-1">{data.label}</div>

      {(['P_out', 'eta', 'gamma'] as const).map((key) => (
        <div key={key} className="flex items-center justify-between gap-1 mb-0.5">
          <span className="text-[8px] text-[#6b7280] w-8">{key === 'gamma' ? 'γ' : key}</span>
          <input
            type="number"
            value={data[key] ?? (key === 'P_out' ? 3e5 : key === 'eta' ? 0.8 : 1.4)}
            step={key === 'P_out' ? 10000 : 0.01}
            min={key === 'eta' ? 0.01 : key === 'gamma' ? 1.0 : 0}
            max={key === 'eta' ? 1 : undefined}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) updateNodeData(id, { ...data, [key]: v });
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-16 text-[8px] font-mono bg-[#f5f3ff] border border-[#ddd6fe] rounded px-1 py-0.5 text-[#0f1730] outline-none focus:border-[#7c3aed]"
          />
          <span className="text-[7px] text-[#9ca3af]">{key === 'P_out' ? 'Pa' : ''}</span>
        </div>
      ))}
    </div>
  );
}

export default memo(CompNode);
