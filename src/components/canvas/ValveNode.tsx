import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { ValveNodeData } from '../../types/reactor';
import { useNodeIssues } from '../../context/ValidationContext';

function ValveNode({ id, data, selected }: { id: string; data: ValveNodeData; selected?: boolean }) {
  const { updateNodeData } = useReactFlow();
  const { isOffPath } = useNodeIssues(id);

  return (
    <div
      title={isOffPath ? 'Not in active flow path' : undefined}
      style={{
        width: 120,
        minHeight: 72,
        borderRadius: 8,
        background: '#ffffff',
        borderTop:    isOffPath ? '2px dashed #f97316' : '3px solid #b45309',
        borderRight:  isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderBottom: isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderLeft:   isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        boxShadow: selected ? '0 0 0 3px #b4530940' : 'none',
        padding: '6px 8px',
      }}
    >
      <Handle type="target" position={Position.Left} id="in"
        style={{ width: 10, height: 10, background: '#b45309', border: 'none', left: -5 }} />
      <Handle type="source" position={Position.Right} id="out"
        style={{ width: 10, height: 10, background: '#b45309', border: 'none', right: -5 }} />

      <div className="text-[10px] font-medium text-[#b45309] uppercase tracking-wider text-center mb-1">
        Valve
      </div>
      <div className="text-[9px] font-mono text-[#374151] text-center mb-1">{data.label}</div>

      <div className="flex items-center justify-between gap-1">
        <span className="text-[8px] text-[#6b7280]">P_out</span>
        <input
          type="number"
          value={data.P_out ?? 101325}
          step={5000}
          min={0}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) updateNodeData(id, { ...data, P_out: v });
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-16 text-[8px] font-mono bg-[#fffbeb] border border-[#fde68a] rounded px-1 py-0.5 text-[#0f1730] outline-none focus:border-[#b45309]"
        />
        <span className="text-[7px] text-[#9ca3af]">Pa</span>
      </div>
      <div className="text-[7.5px] text-[#9ca3af] text-center mt-1">isenthalpic</div>
    </div>
  );
}

export default memo(ValveNode);
