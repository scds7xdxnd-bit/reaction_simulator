import { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import type { ReactorNodeData, ThermalMode } from '../../types/reactor';
import { useSimulatorStore } from '../../store/simulatorStore';
import { getPreset } from '../../math/reactionRegistry';

type BatchNodeProps = NodeProps & { data: ReactorNodeData };

function BatchNode({ id, data, selected }: BatchNodeProps) {
  const { updateNodeData } = useReactFlow();
  const updateNodeThermal = useSimulatorStore((s) => s.updateNodeThermal);
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
    : getPreset(params).computeDa(params.k, data.tau, params.Ca0);

  const isSingle = params.reactionMode === 'single';
  const thermalMode = data.thermalMode ?? 'isothermal';
  const nodeHeight = isSingle ? 140 : 90;

  const conversionColor = segment
    ? segment.Xa_out > 0.7 ? '#16a34a' : segment.Xa_out > 0.4 ? '#d97706' : '#dc2626'
    : '#6b7280';

  const BATCH_COLOR = '#be123c';

  return (
    <div
      className="relative"
      style={{
        width: 160,
        height: nodeHeight,
        borderRadius: 8,
        background: '#ffffff',
        borderTop:    selected ? `2px solid ${BATCH_COLOR}` : '1px solid #dde3f0',
        borderRight:  selected ? `2px solid ${BATCH_COLOR}` : '1px solid #dde3f0',
        borderBottom: selected ? `2px solid ${BATCH_COLOR}` : '1px solid #dde3f0',
        borderLeft: `3px solid ${BATCH_COLOR}`,
      }}
    >
      <Handle type="target" position={Position.Left} id="in"
        style={{ width: 10, height: 10, background: BATCH_COLOR, border: 'none', left: -5, top: '50%' }} />
      <Handle type="source" position={Position.Right} id="out"
        style={{ width: 10, height: 10, background: BATCH_COLOR, border: 'none', right: -5, top: '50%' }} />

      <div className="flex items-center justify-between px-2 pt-1.5" style={{ height: 40 }}>
        {isEditing ? (
          <input
            autoFocus type="text" value={labelStr}
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
            className="w-20 text-[13px] font-medium bg-transparent outline-none text-[#0f1730]"
            style={{ borderBottom: `1px solid ${BATCH_COLOR}` }}
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
        <span className="text-[9px] font-bold uppercase tracking-widest"
          style={{ color: BATCH_COLOR }}>
          BATCH
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-2">
        <span className="text-[11px] text-[#374151]">t =</span>
        <input
          type="number" min="0.01" max="100" step="0.1"
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
          className="w-16 text-[11px] font-mono rounded px-1 py-0.5 text-[#0f1730] outline-none"
          style={{ background: '#fff5f7', border: '1px solid #fecdd3', boxShadow: 'none' }}
        />
        <span className="text-[10px] text-[#6b7280]">s</span>
      </div>

      {isSingle && (
        <div className="px-2 mt-1">
          <select
            value={thermalMode}
            onChange={(e) => updateNodeThermal(id, { thermalMode: e.target.value as ThermalMode })}
            className="w-full text-xs border rounded px-1.5 py-1 bg-white text-gray-700 focus:outline-none cursor-pointer"
            style={{ borderColor: '#fca5a5' }}
          >
            <option value="isothermal">Isothermal</option>
            <option value="adiabatic">Adiabatic</option>
            <option value="cooled">Cooled / Heated</option>
          </select>
        </div>
      )}

      {isSingle && thermalMode === 'cooled' && (
        <div className="flex items-center gap-1 px-2 mt-0.5">
          <span className="text-[9px] text-[#6b7280]">Tc:</span>
          <input type="number" min="200" max="600" step="1"
            value={data.Tc ?? 300}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateNodeThermal(id, { Tc: Math.max(200, Math.min(600, v)) }); }}
            className="w-12 text-[10px] font-mono rounded px-1 py-0.5 outline-none"
            style={{ background: '#fff5f7', border: '1px solid #fecdd3' }}
          />
          <span className="text-[9px] text-[#6b7280]">κ:</span>
          <input type="number" min="0.01" max="5" step="0.01"
            value={data.kappa_v ?? 0.5}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateNodeThermal(id, { kappa_v: Math.max(0.01, Math.min(5, v)) }); }}
            className="w-12 text-[10px] font-mono rounded px-1 py-0.5 outline-none"
            style={{ background: '#fff5f7', border: '1px solid #fecdd3' }}
          />
        </div>
      )}

      <div className="flex items-center gap-1 px-2 mt-1">
        <span className="text-[10px] text-[#374151]">Xₐ:</span>
        {segment ? (
          <span className="text-[11px] font-mono" style={{ color: conversionColor }}>
            0.00 → {segment.Xa_out.toFixed(2)}
          </span>
        ) : (
          <span className="text-[11px] font-mono text-[#6b7280]">—</span>
        )}
        {isSingle && segment?.T_out !== undefined && (
          <span className="text-[10px] font-mono ml-auto" style={{ color: BATCH_COLOR }}>
            {segment.T_out.toFixed(0)} K
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(BatchNode);
