import { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { useSimulatorStore } from '../../store/simulatorStore';

interface FeedData {
  Ca0?: number;
  T_feed?: number;
  flowrate?: number;
  label?: string;
  speciesLabel?: string;
}

type FeedNodeProps = NodeProps & { data: FeedData };

function FeedNode({ id, data, selected }: FeedNodeProps) {
  const params = useSimulatorStore((s) => s.params);
  const { updateNodeData } = useReactFlow();

  const [ca0Str,  setCa0Str]  = useState(data.Ca0      !== undefined ? String(data.Ca0)      : '');
  const [tStr,    setTStr]    = useState(data.T_feed   !== undefined ? String(data.T_feed)   : '');
  const [flowStr, setFlowStr] = useState(data.flowrate !== undefined ? String(data.flowrate) : '');

  useEffect(() => { setCa0Str(data.Ca0      !== undefined ? String(data.Ca0)      : ''); }, [data.Ca0]);
  useEffect(() => { setTStr(data.T_feed     !== undefined ? String(data.T_feed)   : ''); }, [data.T_feed]);
  useEffect(() => { setFlowStr(data.flowrate !== undefined ? String(data.flowrate) : ''); }, [data.flowrate]);

  const hasOverride  = data.Ca0 !== undefined || data.T_feed !== undefined || data.flowrate !== undefined;
  const displayLabel = data.label ?? 'Feed';
  const displayCa0   = data.Ca0 ?? params.Ca0;

  return (
    <div className="relative">
      <div
        style={{
          width: 70, height: 70,
          borderRadius: '50%',
          background: '#ffffff',
          border: selected ? '2px solid #2563eb' : '2px dashed #b0bcd4',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Handle
          type="source" position={Position.Right} id="out"
          style={{ width: 10, height: 10, background: '#6b7280', border: 'none', right: -5, top: '50%' }}
        />
        <span style={{ fontSize: 11, fontWeight: 500, color: '#0f1730', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {displayLabel}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#374151', marginTop: 2 }}>
          Cₐ₀={displayCa0.toFixed(1)}
        </span>
        {hasOverride && (
          <span style={{ position: 'absolute', top: 4, right: 8, width: 6, height: 6, borderRadius: '50%', background: '#2563eb' }} />
        )}
      </div>

      {selected && (
        <div
          className="nodrag nowheel"
          style={{
            position: 'absolute', top: 76, left: -25,
            width: 120,
            background: '#ffffff',
            border: '1px solid #dde3f0',
            borderRadius: 6,
            padding: '6px 8px',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Feed Overrides
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: '#6b7280', width: 28 }}>Ca₀:</span>
            <input
              type="number" min="0.01" step="0.1"
              value={ca0Str}
              placeholder={params.Ca0.toFixed(1)}
              onChange={(e) => setCa0Str(e.target.value)}
              onBlur={() => {
                const v = parseFloat(ca0Str);
                updateNodeData(id, { ...data, Ca0: isNaN(v) || v <= 0 ? undefined : v });
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); e.stopPropagation(); }}
              style={{ width: 52, fontSize: 10, border: '1px solid #dde3f0', borderRadius: 3, padding: '1px 3px', fontFamily: 'monospace' }}
            />
            {data.Ca0 !== undefined && (
              <button
                onClick={() => { setCa0Str(''); updateNodeData(id, { ...data, Ca0: undefined }); }}
                style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >×</button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: '#6b7280', width: 28 }}>T:</span>
            <input
              type="number" min="200" max="900" step="1"
              value={tStr}
              placeholder={String(params.T_feed)}
              onChange={(e) => setTStr(e.target.value)}
              onBlur={() => {
                const v = parseFloat(tStr);
                updateNodeData(id, { ...data, T_feed: isNaN(v) ? undefined : Math.max(200, Math.min(900, v)) });
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); e.stopPropagation(); }}
              style={{ width: 52, fontSize: 10, border: '1px solid #dde3f0', borderRadius: 3, padding: '1px 3px', fontFamily: 'monospace' }}
            />
            {data.T_feed !== undefined && (
              <button
                onClick={() => { setTStr(''); updateNodeData(id, { ...data, T_feed: undefined }); }}
                style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >×</button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 9, color: '#6b7280', width: 28 }}>Flow:</span>
            <input
              type="number" min="0.01" step="0.1"
              value={flowStr}
              placeholder="1.0"
              onChange={(e) => setFlowStr(e.target.value)}
              onBlur={() => {
                const v = parseFloat(flowStr);
                updateNodeData(id, { ...data, flowrate: isNaN(v) || v <= 0 ? undefined : v });
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); e.stopPropagation(); }}
              style={{ width: 52, fontSize: 10, border: '1px solid #dde3f0', borderRadius: 3, padding: '1px 3px', fontFamily: 'monospace' }}
            />
            {data.flowrate !== undefined && (
              <button
                onClick={() => { setFlowStr(''); updateNodeData(id, { ...data, flowrate: undefined }); }}
                style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >×</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(FeedNode);
