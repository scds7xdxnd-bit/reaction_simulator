import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { MixerNodeData } from '../../types/reactor';
import { useNodeIssues } from '../../context/ValidationContext';

function MixerNode({ id, data }: { id: string; data: MixerNodeData }) {
  const { isOffPath } = useNodeIssues(id);

  return (
    <div
      title={isOffPath ? 'Not in active flow path' : undefined}
      style={{
        width: 90,
        height: 75,
        borderRadius: 8,
        background: '#ffffff',
        borderTop:    isOffPath ? '2px dashed #f97316' : '3px solid #059669',
        borderRight:  isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderBottom: isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
        borderLeft:   isOffPath ? '2px dashed #f97316' : '1px solid #e0e6f0',
      }}
      className="flex flex-col items-center justify-center"
    >
      <Handle type="target" position={Position.Top} id="in1"
        style={{ width: 8, height: 8, background: '#059669', border: 'none', top: -4 }} />
      <Handle type="target" position={Position.Bottom} id="in2"
        style={{ width: 8, height: 8, background: '#059669', border: 'none', bottom: -4 }} />
      <Handle type="source" position={Position.Right} id="out"
        style={{ width: 10, height: 10, background: '#059669', border: 'none', right: -5 }} />
      <span className="text-[11px] font-medium text-[#059669] uppercase tracking-wider">
        Mixer
      </span>
      <span className="text-[10px] font-mono text-[#374151] mt-0.5">
        {data.label}
      </span>
    </div>
  );
}

export default memo(MixerNode);
