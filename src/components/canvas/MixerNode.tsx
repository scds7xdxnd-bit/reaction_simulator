import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { MixerNodeData } from '../../types/reactor';

function MixerNode({ data }: { data: MixerNodeData }) {
  return (
    <div
      style={{
        width: 90,
        height: 75,
        borderRadius: 8,
        background: '#ffffff',
        border: '2px solid #059669',
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
