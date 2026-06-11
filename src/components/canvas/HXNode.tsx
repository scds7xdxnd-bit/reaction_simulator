import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { HXNodeData } from '../../types/reactor';
import { useNodeIssues } from '../../context/ValidationContext';

function HXNode({ id, data, selected }: { id: string; data: HXNodeData; selected?: boolean }) {
  const { isOffPath } = useNodeIssues(id);

  const setPoint = data.T_out !== undefined
    ? `${data.T_out} K`
    : data.Q_duty !== undefined
      ? `Q=${data.Q_duty > 0 ? '+' : ''}${data.Q_duty} kW`
      : 'pass-through';

  return (
    <div
      title={isOffPath ? 'Not in active flow path' : `Heat exchanger — ${setPoint}`}
      style={{
        width: 90,
        height: 60,
        borderRadius: 8,
        background: '#fff7ed',
        borderTop:    isOffPath ? '2px dashed #f97316' : '2px solid #dc2626',
        borderRight:  isOffPath ? '2px dashed #f97316' : '1px solid #fecaca',
        borderBottom: isOffPath ? '2px dashed #f97316' : '1px solid #fecaca',
        borderLeft:   isOffPath ? '2px dashed #f97316' : '1px solid #fecaca',
        boxShadow: selected ? '0 0 0 3px #dc262640' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <Handle type="target" position={Position.Left} id="in"
        style={{ width: 8, height: 8, background: '#dc2626', border: 'none', left: -4 }} />
      <Handle type="source" position={Position.Right} id="out"
        style={{ width: 10, height: 10, background: '#dc2626', border: 'none', right: -5 }} />

      <span style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', letterSpacing: '0.05em' }}>
        HX
      </span>
      <span style={{ fontSize: 9, fontWeight: 500, color: '#374151' }}>
        {data.label}
      </span>
      <span style={{ fontSize: 9, color: '#6b7280', fontFamily: 'monospace' }}>
        {setPoint}
      </span>
    </div>
  );
}

export default memo(HXNode);
