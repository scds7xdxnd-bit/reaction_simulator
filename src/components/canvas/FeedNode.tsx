import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useSimulatorStore } from '../../store/simulatorStore';

function FeedNode() {
  const params = useSimulatorStore((s) => s.params);

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        width: 70,
        height: 70,
        borderRadius: '50%',
        background: '#ffffff',
        border: '2px dashed #b0bcd4',
      }}
    >
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10,
          height: 10,
          background: '#6b7280',
          border: 'none',
          right: -5,
          top: '50%',
        }}
      />
      <span className="text-[11px] font-medium text-[#0f1730] uppercase tracking-wider">Feed</span>
      <span className="text-[10px] font-mono text-[#374151] mt-0.5">
        Cₐ₀={params.Ca0.toFixed(1)}
      </span>
    </div>
  );
}

export default memo(FeedNode);
