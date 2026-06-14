import { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import type { ReactorNodeData } from '../../types/reactor';
import type { ThermalMode } from '../../types/simulation';
import { useSimulatorStore } from '../../store/simulatorStore';
import { useReactorNode } from '../../hooks/useReactorNode';
import { useNodeIssues } from '../../context/ValidationContext';

type BatchNodeProps = NodeProps & { data: ReactorNodeData };

const ACCENT = '#be123c';
const HEADER_BG = '#fff1f2';
const BADGE_BG = '#ffe4e6';
const BADGE_TEXT = '#9f1239';
const PILL_BG = '#ffe4e6';

function BatchNode({ id, data, selected }: BatchNodeProps) {
  const { updateNodeData } = useReactFlow();
  const updateNodeThermal = useSimulatorStore((s) => s.updateNodeThermal);
  const d = useReactorNode(id, data);
  const { segment, Da, params, isSingle, thermalMode, simulationMode, conversionColor } = d;

  const [isEditing, setIsEditing] = useState(false);
  const [labelStr, setLabelStr] = useState(data.label);
  const [tauStr, setTauStr] = useState(String(data.tau));

  useEffect(() => { setLabelStr(data.label); }, [data.label]);
  useEffect(() => { setTauStr(String(data.tau)); }, [data.tau]);

  const { isOffPath } = useNodeIssues(id);

  return (
    <div
      className="relative"
      title={isOffPath ? 'Not in active flow path' : undefined}
      style={{
        width: 160,
        height: 'auto',
        borderRadius: 8,
        background: '#ffffff',
        borderTop:    isOffPath ? '2px dashed #f97316' : selected ? `2px solid ${ACCENT}` : `3px solid ${ACCENT}`,
        borderRight:  isOffPath ? '2px dashed #f97316' : selected ? `2px solid ${ACCENT}` : '1px solid #e0e6f0',
        borderBottom: isOffPath ? '2px dashed #f97316' : selected ? `2px solid ${ACCENT}` : '1px solid #e0e6f0',
        borderLeft:   isOffPath ? '2px dashed #f97316' : selected ? `2px solid ${ACCENT}` : '1px solid #e0e6f0',
        boxShadow: selected ? '0 0 0 3px #be123c40' : 'none',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{
          width: 10,
          height: 10,
          background: ACCENT,
          border: 'none',
          left: -5,
          top: '50%',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{
          width: 10,
          height: 10,
          background: ACCENT,
          border: 'none',
          right: -5,
          top: '50%',
        }}
      />

      <div style={{ height: 34, background: HEADER_BG, borderRadius: '6px 6px 0 0',
                    display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                       textTransform: 'uppercase', letterSpacing: '0.05em',
                       background: BADGE_BG, color: BADGE_TEXT, flexShrink: 0 }}>
          BATCH
        </span>

        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={labelStr}
            className="flex-1 min-w-0 text-[12px] font-medium bg-transparent outline-none text-center text-[#0f1730]"
            style={{ borderBottom: `1px solid ${ACCENT}` }}
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
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-[12px] font-medium text-[#0f1730] text-center truncate cursor-text"
            title="Double-click to rename"
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          >
            {data.label}
          </span>
        )}

        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#94a3b8', flexShrink: 0 }}>
          {`Da:${Da.toFixed(2)}`}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 28 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>t =</span>
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
          style={{ width: 52, fontSize: 11, fontFamily: 'monospace', textAlign: 'right',
                   background: PILL_BG, border: 'none', borderRadius: 6,
                   padding: '2px 5px', outline: 'none', color: '#0f1730' }}
        />
        <span style={{ fontSize: 10, color: '#94a3b8' }}>s</span>
      </div>

      {isSingle && (
        <div style={{ padding: '0 10px', height: 26 }}>
          <select
            value={thermalMode}
            onChange={(e) => updateNodeThermal(id, { thermalMode: e.target.value as ThermalMode })}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ width: '100%', fontSize: 11, padding: '2px 4px',
                     border: `1px solid ${ACCENT}33`, borderRadius: 5,
                     background: '#ffffff', color: '#374151', outline: 'none', cursor: 'pointer' }}>
            <option value="isothermal">Isothermal</option>
            <option value="adiabatic">Adiabatic</option>
            <option value="cooled">Cooled / Heated</option>
          </select>
        </div>
      )}

      {isSingle && thermalMode === 'cooled' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', height: 26 }}>
          <span style={{ fontSize: 9, color: '#6b7280' }}>Tc:</span>
          <input
            type="number"
            min="200"
            max="600"
            step="1"
            value={data.Tc ?? 300}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) updateNodeThermal(id, { Tc: Math.max(200, Math.min(600, v)) });
            }}
            style={{ width: 44, fontSize: 10, fontFamily: 'monospace', background: PILL_BG,
                     border: 'none', borderRadius: 5, padding: '2px 4px', outline: 'none', color: '#0f1730' }}
          />
          <span style={{ fontSize: 9, color: '#6b7280' }}>K  κ:</span>
          <input
            type="number"
            min="0.01"
            max="5"
            step="0.01"
            value={data.kappa_v ?? 0.5}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) updateNodeThermal(id, { kappa_v: Math.max(0.01, Math.min(5, v)) });
            }}
            style={{ width: 40, fontSize: 10, fontFamily: 'monospace', background: PILL_BG,
                     border: 'none', borderRadius: 5, padding: '2px 4px', outline: 'none', color: '#0f1730' }}
          />
        </div>
      )}

      {isSingle && thermalMode !== 'isothermal' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0 10px', height: 20 }}>
          <span style={{ fontSize: 9, color: '#94a3b8' }}>T_out</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#d97706' }}>
            {segment?.T_out !== undefined ? `${segment.T_out.toFixed(0)} K` : '—'}
          </span>
        </div>
      )}

      <div style={{ padding: '4px 10px 0' }}>
        <div style={{ height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: segment ? `${segment.Xa_out * 100}%` : '0%',
            background: conversionColor, borderRadius: 4,
            transition: 'width 0.2s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 9, color: '#94a3b8' }}>Xₐ</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: conversionColor }}>
            {segment ? `${segment.Xa_in.toFixed(2)} → ${segment.Xa_out.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>

      {simulationMode === 'dynamic' && (
        <div style={{ margin: '4px 10px 0', paddingTop: 4, borderTop: '1px solid #e0e6f0' }}>
          <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase',
                      letterSpacing: '0.05em', margin: '0 0 2px' }}>
            Init. Conditions
          </p>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#6b7280' }}>Cₐ₀:</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={data.ic_Ca ?? params.Ca0}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) updateNodeData(id, { ...data, ic_Ca: Math.max(0, Math.min(100, v)) });
              }}
              style={{ width: 44, fontSize: 10, fontFamily: 'monospace', background: PILL_BG,
                       border: 'none', borderRadius: 5, padding: '2px 4px', outline: 'none', color: '#0f1730' }}
            />
            <span style={{ fontSize: 9, color: '#6b7280' }}>T₀:</span>
            <input
              type="number"
              min={200}
              max={800}
              step={1}
              value={data.ic_T ?? params.T_feed}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) updateNodeData(id, { ...data, ic_T: Math.max(200, Math.min(800, v)) });
              }}
              style={{ width: 44, fontSize: 10, fontFamily: 'monospace', background: PILL_BG,
                       border: 'none', borderRadius: 5, padding: '2px 4px', outline: 'none', color: '#0f1730' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(BatchNode);
