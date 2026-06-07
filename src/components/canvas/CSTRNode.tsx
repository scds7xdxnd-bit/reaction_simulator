import { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import type { ReactorNodeData } from '../../types/reactor';
import { useSimulatorStore } from '../../store/simulatorStore';

type CSTRNodeProps = NodeProps & { data: ReactorNodeData };

function CSTRNode({ id, data, selected }: CSTRNodeProps) {
  const { updateNodeData } = useReactFlow();
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);

  const [isEditing, setIsEditing] = useState(false);
  const [labelStr, setLabelStr] = useState(data.label);
  const [tauStr, setTauStr] = useState(String(data.tau));

  useEffect(() => { setLabelStr(data.label); }, [data.label]);
  useEffect(() => { setTauStr(String(data.tau)); }, [data.tau]);

  const segment = result?.segments.find((s) => s.reactorId === id);

  const Da = segment
    ? segment.Da
    : data.tau * params.k * (params.kinetics !== 'first-order' ? params.Ca0 : 1);

  const isSingle = params.reactionMode === 'single';

  const conversionColor = segment
    ? segment.Xa_out > 0.7
      ? '#16a34a'
      : segment.Xa_out > 0.4
        ? '#d97706'
        : '#dc2626'
    : '#6b7280';

  return (
    <div
      className="relative"
      style={{
        width: 150,
        height: 90,
        borderRadius: 8,
        background: '#ffffff',
        borderTop: selected ? '2px solid #2563eb' : '1px solid #dde3f0',
        borderRight: selected ? '2px solid #2563eb' : '1px solid #dde3f0',
        borderBottom: selected ? '2px solid #2563eb' : '1px solid #dde3f0',
        borderLeft: '3px solid #2563eb',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: '#2563eb',
          border: 'none',
          left: -5,
          top: '50%',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10,
          height: 10,
          background: '#2563eb',
          border: 'none',
          right: -5,
          top: '50%',
        }}
      />

      <div className="flex items-center justify-between px-2 pt-1.5" style={{ height: 40 }}>
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={labelStr}
            onChange={(e) => setLabelStr(e.target.value)}
            onBlur={() => {
              if (labelStr.trim()) updateNodeData(id, { ...data, label: labelStr.trim() });
              else setLabelStr(data.label);
              setIsEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { setLabelStr(data.label); setIsEditing(false); }
              e.stopPropagation();
            }}
            className="w-24 text-[13px] font-medium bg-transparent border-b border-[#2563eb] outline-none text-[#0f1730]"
          />
        ) : (
          <span
            className="text-[13px] font-medium text-[#0f1730] cursor-text"
            title="Double-click to rename"
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          >
            {data.label}
          </span>
        )}
        <span className="text-[11px] font-mono text-[#6b7280]">
          Da: {Da.toFixed(2)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-2">
        <span className="text-[11px] text-[#374151]">τ =</span>
        <input
          type="number"
          min="0.01"
          max="100"
          step="0.1"
          value={tauStr}
          onChange={(e) => setTauStr(e.target.value)}
          onBlur={() => {
            const parsed = parseFloat(tauStr);
            if (!isNaN(parsed) && parsed > 0) {
              const clamped = Math.max(0.01, Math.min(100, parsed));
              updateNodeData(id, { ...data, tau: clamped });
              setTauStr(String(clamped));
            } else {
              setTauStr(String(data.tau));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            e.stopPropagation();
          }}
          className="w-16 text-[11px] font-mono bg-[#f8faff] border border-[#dde3f0] rounded px-1 py-0.5 text-[#0f1730] outline-none focus:border-[#2563eb]"
        />
        <span className="text-[10px] text-[#6b7280]">s</span>
      </div>

      <div className="flex items-center gap-1 px-2 mt-1">
        <span className="text-[10px] text-[#374151]">Xₐ:</span>
        {segment ? (
          <span className="text-[11px] font-mono" style={{ color: conversionColor }}>
            {segment.Xa_in.toFixed(2)} → {segment.Xa_out.toFixed(2)}
          </span>
        ) : (
          <span className="text-[11px] font-mono text-[#6b7280]">—</span>
        )}
      </div>
    </div>
  );
}

export default memo(CSTRNode);
