import { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import type { ReactorNodeData } from '../../types/reactor';
import { useReactorNode } from '../../hooks/useReactorNode';
import { useNodeIssues } from '../../context/ValidationContext';

type SemibatchNodeProps = NodeProps & { data: ReactorNodeData & { FB0?: number; CB_feed?: number } };

const ACCENT = '#0369a1';
const HEADER_BG = '#e0f2fe';
const BADGE_BG = '#bae6fd';
const BADGE_TEXT = '#0c4a6e';
const PILL_BG = '#bae6fd';

function SemibatchNode({ id, data, selected }: SemibatchNodeProps) {
  const { updateNodeData } = useReactFlow();
  const d = useReactorNode(id, data);
  const { segment, Da, conversionColor } = d;

  const [isEditing, setIsEditing] = useState(false);
  const [labelStr, setLabelStr] = useState(data.label);
  const [tauStr, setTauStr] = useState(String(data.tau));

  useEffect(() => { setLabelStr(data.label); }, [data.label]);
  useEffect(() => { setTauStr(String(data.tau)); }, [data.tau]);

  const { isOffPath } = useNodeIssues(id);
  const fb0 = (data as { FB0?: number }).FB0 ?? 0.1;
  const cbFeed = (data as { CB_feed?: number }).CB_feed ?? 1.0;

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
      {/* B feed nozzle on the right side */}
      <div style={{
        position: 'absolute', right: -14, top: '40%',
        display: 'flex', alignItems: 'center', gap: 2,
      }}>
        <svg width="10" height="8" viewBox="0 0 10 8">
          <line x1="0" y1="4" x2="10" y2="4" stroke={ACCENT} strokeWidth="1.5" />
          <polygon points="6,0 10,4 6,8" fill={ACCENT} />
        </svg>
        <span style={{ fontSize: 7, color: ACCENT, fontWeight: 700, fontFamily: 'monospace' }}>B</span>
      </div>

      <Handle
        type="target" position={Position.Left} id="in"
        style={{ width: 10, height: 10, background: ACCENT, border: 'none', left: -5, top: '50%' }}
      />
      <Handle
        type="source" position={Position.Right} id="out"
        style={{ width: 10, height: 10, background: ACCENT, border: 'none', right: -5, top: '80%' }}
      />

      <div style={{ height: 34, background: HEADER_BG, borderRadius: '6px 6px 0 0',
                    display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                       textTransform: 'uppercase', letterSpacing: '0.05em',
                       background: BADGE_BG, color: BADGE_TEXT, flexShrink: 0 }}>
          SB
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
          {`Da:${Da.toFixed(2)}`}
        </span>
      </div>

      {/* Batch time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 28 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>t =</span>
        <input
          type="number" min="0.01" max="1000" step="1"
          value={tauStr}
          onChange={(e) => setTauStr(e.target.value)}
          onBlur={() => {
            const parsed = parseFloat(tauStr);
            if (!isNaN(parsed) && parsed > 0) {
              const clamped = Math.max(0.01, Math.min(1000, parsed));
              updateNodeData(id, { ...data, tau: clamped });
              setTauStr(String(clamped));
            } else {
              setTauStr(String(data.tau));
            }
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); e.stopPropagation(); }}
          style={{ width: 52, fontSize: 11, fontFamily: 'monospace', textAlign: 'right',
                   background: PILL_BG, border: 'none', borderRadius: 6,
                   padding: '2px 5px', outline: 'none', color: '#0f1730' }}
        />
        <span style={{ fontSize: 10, color: '#94a3b8' }}>s</span>
      </div>

      {/* FB0 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', height: 26 }}>
        <span style={{ fontSize: 9, color: '#6b7280', width: 26 }}>F_B₀</span>
        <input
          type="number" min="0.001" max="100" step="0.01"
          value={fb0}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0) updateNodeData(id, { ...data, FB0: v });
          }}
          style={{ width: 52, fontSize: 10, fontFamily: 'monospace', background: PILL_BG,
                   border: 'none', borderRadius: 5, padding: '2px 4px', outline: 'none', color: '#0f1730' }}
        />
        <span style={{ fontSize: 9, color: '#94a3b8' }}>mol/s</span>
      </div>

      {/* CB_feed */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', height: 26 }}>
        <span style={{ fontSize: 9, color: '#6b7280', width: 26 }}>C_B,f</span>
        <input
          type="number" min="0.01" max="100" step="0.1"
          value={cbFeed}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0) updateNodeData(id, { ...data, CB_feed: v });
          }}
          style={{ width: 52, fontSize: 10, fontFamily: 'monospace', background: PILL_BG,
                   border: 'none', borderRadius: 5, padding: '2px 4px', outline: 'none', color: '#0f1730' }}
        />
        <span style={{ fontSize: 9, color: '#94a3b8' }}>mol/L</span>
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

export default memo(SemibatchNode);
