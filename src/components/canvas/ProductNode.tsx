import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useSimulatorStore } from '../../store/simulatorStore';

function ProductNode() {
  const result = useSimulatorStore((s) => s.result);

  const finalXa = result?.finalConversion ?? null;
  const color = finalXa !== null
    ? finalXa > 0.7 ? '#16a34a' : finalXa > 0.4 ? '#d97706' : '#dc2626'
    : '#6b7280';

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
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: '#6b7280',
          border: 'none',
          left: -5,
          top: '50%',
        }}
      />
      <span className="text-[11px] font-medium text-[#0f1730] uppercase tracking-wider">
        Product
      </span>
      <span className="text-[11px] font-mono font-bold mt-0.5" style={{ color }}>
        {finalXa !== null ? `Xₐ=${(finalXa * 100).toFixed(1)}%` : '—'}
      </span>
    </div>
  );
}

export default memo(ProductNode);
