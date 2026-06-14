import { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import type { ReactorNodeData } from '../../types/reactor';
import { useReactorNode } from '../../hooks/useReactorNode';
import { useNodeIssues } from '../../context/ValidationContext';

type FixedBedNodeProps = NodeProps & { data: ReactorNodeData & { W_cat?: number; rho_bulk?: number; epsilon_bed?: number } };

const ACCENT = '#7c2d12';
const HEADER_BG = '#fef3e2';
const BADGE_BG = '#fed7aa';
const BADGE_TEXT = '#7c2d12';
const PILL_BG = '#fed7aa';

function FixedBedNode({ id, data, selected }: FixedBedNodeProps) {
  const { updateNodeData } = useReactFlow();
  const d = useReactorNode(id, data);
  const { segment, conversionColor, params } = d;

  const [isEditing, setIsEditing] = useState(false);
  const [labelStr, setLabelStr] = useState(data.label);
  const [wStr, setWStr] = useState(String((data as { W_cat?: number }).W_cat ?? 5.0));

  useEffect(() => { setLabelStr(data.label); }, [data.label]);

  const W_cat       = (data as { W_cat?: number }).W_cat       ?? 5.0;
  const rho_bulk    = (data as { rho_bulk?: number }).rho_bulk    ?? 1200;
  const epsilon_bed = (data as { epsilon_bed?: number }).epsilon_bed ?? 0.4;
  const V_bed       = W_cat / (rho_bulk * (1 - epsilon_bed));

  const FA0 = params.Ca0 * params.Q_feed; // mol/s
  const wOverFA0 = FA0 > 0 ? (W_cat / FA0).toFixed(1) : '—';

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
        boxShadow: selected ? `0 0 0 3px ${ACCENT}40` : 'none',
      }}
    >
      <Handle
        type="target" position={Position.Left} id="in"
        style={{ width: 10, height: 10, background: ACCENT, border: 'none', left: -5, top: '50%' }}
      />
      <Handle
        type="source" position={Position.Right} id="out"
        style={{ width: 10, height: 10, background: ACCENT, border: 'none', right: -5, top: '50%' }}
      />

      {/* Stacked-layer icon overlaid at top-right */}
      <div style={{ position: 'absolute', right: 6, top: 8, opacity: 0.4 }}>
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
          <rect x="1" y="0" width="12" height="3" rx="1" fill={ACCENT} />
          <rect x="1" y="4.5" width="12" height="3" rx="1" fill={ACCENT} />
          <rect x="1" y="9" width="12" height="3" rx="1" fill={ACCENT} />
        </svg>
      </div>

      <div style={{ height: 34, background: HEADER_BG, borderRadius: '6px 6px 0 0',
                    display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                       textTransform: 'uppercase', letterSpacing: '0.05em',
                       background: BADGE_BG, color: BADGE_TEXT, flexShrink: 0 }}>
          FB
        </span>

        {isEditing ? (
          <input
            autoFocus type="text" value={labelStr}
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
          {`W/F:${wOverFA0}`}
        </span>
      </div>

      {/* W_cat input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 28 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>W =</span>
        <input
          type="number" min="0.01" max="10000" step="0.5"
          value={wStr}
          onChange={(e) => setWStr(e.target.value)}
          onBlur={() => {
            const parsed = parseFloat(wStr);
            if (!isNaN(parsed) && parsed > 0) {
              const clamped = Math.max(0.01, Math.min(10000, parsed));
              updateNodeData(id, { ...data, W_cat: clamped });
              setWStr(String(clamped));
            } else {
              setWStr(String(W_cat));
            }
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); e.stopPropagation(); }}
          style={{ width: 52, fontSize: 11, fontFamily: 'monospace', textAlign: 'right',
                   background: PILL_BG, border: 'none', borderRadius: 6,
                   padding: '2px 5px', outline: 'none', color: '#0f1730' }}
        />
        <span style={{ fontSize: 10, color: '#94a3b8' }}>kg</span>
      </div>

      {/* Bed params: rho_bulk, epsilon_bed */}
      <div style={{ display: 'flex', gap: 6, padding: '0 10px', height: 26, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#94a3b8' }}>ρ</span>
        <input
          type="number" min="100" max="5000" step="50"
          value={rho_bulk}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0) updateNodeData(id, { ...data, rho_bulk: v });
          }}
          style={{ width: 42, fontSize: 10, fontFamily: 'monospace', background: PILL_BG,
                   border: 'none', borderRadius: 5, padding: '2px 3px', outline: 'none', color: '#0f1730' }}
        />
        <span style={{ fontSize: 9, color: '#94a3b8' }}>ε</span>
        <input
          type="number" min="0.01" max="0.99" step="0.01"
          value={epsilon_bed}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0 && v < 1) updateNodeData(id, { ...data, epsilon_bed: v });
          }}
          style={{ width: 36, fontSize: 10, fontFamily: 'monospace', background: PILL_BG,
                   border: 'none', borderRadius: 5, padding: '2px 3px', outline: 'none', color: '#0f1730' }}
        />
      </div>

      {/* Derived V_bed display */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px', height: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#94a3b8' }}>V_bed</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#7c2d12' }}>
          {V_bed.toFixed(3)} L
        </span>
      </div>

      {/* Conversion bar */}
      <div style={{ padding: '4px 10px 6px' }}>
        <div style={{ height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: segment ? `${segment.Xa_out * 100}%` : '0%',
            background: conversionColor, borderRadius: 4, transition: 'width 0.2s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 9, color: '#94a3b8' }}>Xₐ</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: conversionColor }}>
            {segment ? `${segment.Xa_in.toFixed(2)} → ${segment.Xa_out.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(FixedBedNode);
