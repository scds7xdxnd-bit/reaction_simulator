import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { FlashNodeData } from '../../types/reactor';
import { useNodeIssues } from '../../context/ValidationContext';

function FlashNode({ id, data, selected }: { id: string; data: FlashNodeData; selected?: boolean }) {
  const { updateNodeData } = useReactFlow();
  const { isOffPath } = useNodeIssues(id);

  return (
    <div
      title={isOffPath ? 'Not in active flow path' : undefined}
      style={{
        width: 120,
        minHeight: 90,
        borderRadius: 8,
        background: '#ffffff',
        borderTop:    isOffPath ? '2px dashed #f97316' : '3px solid #0d9488',
        borderRight:  isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderBottom: isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderLeft:   isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        boxShadow: selected ? '0 0 0 3px #0d948840' : 'none',
        padding: '6px 8px',
      }}
    >
      <Handle type="target" position={Position.Left} id="in"
        style={{ width: 10, height: 10, background: '#0d9488', border: 'none', left: -5 }} />
      <Handle type="source" position={Position.Right} id="out-vapor"
        style={{ width: 8, height: 8, background: '#0d9488', border: 'none', right: -4, top: '28%' }} />
      <Handle type="source" position={Position.Right} id="out-liquid"
        style={{ width: 8, height: 8, background: '#0d9488', border: 'none', right: -4, top: '72%' }} />

      <div className="text-[10px] font-medium text-[#0d9488] uppercase tracking-wider text-center mb-1">
        Flash
      </div>
      <div className="text-[9px] font-mono text-[#374151] text-center mb-1">{data.label}</div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[8.5px] text-[#6b7280]">T</span>
          <input
            type="number" min="200" max="800" step="5"
            value={data.T_flash ?? 365}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) updateNodeData(id, { ...data, T_flash: v });
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-16 text-[8.5px] font-mono bg-[#f0fdfa] border border-[#99f6e4] rounded px-1 py-0.5 text-[#0f1730] outline-none focus:border-[#0d9488]"
          />
          <span className="text-[7px] text-[#9ca3af]">K</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[8.5px] text-[#6b7280]">P</span>
          <input
            type="number" min="10000" max="2000000" step="5000"
            value={data.P_flash ?? 101325}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) updateNodeData(id, { ...data, P_flash: v });
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-16 text-[8.5px] font-mono bg-[#f0fdfa] border border-[#99f6e4] rounded px-1 py-0.5 text-[#0f1730] outline-none focus:border-[#0d9488]"
          />
          <span className="text-[7px] text-[#9ca3af]">Pa</span>
        </div>
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[7px] text-[#0d9488]">V↑</span>
        <span className="text-[7px] text-[#0d9488]">VLE</span>
        <span className="text-[7px] text-[#0d9488]">L↓</span>
      </div>
    </div>
  );
}

export default memo(FlashNode);
