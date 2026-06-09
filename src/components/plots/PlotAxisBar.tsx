import { useState, useEffect } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { PlotId } from '../../store/slices/plotConfigSlice';

interface PlotAxisBarProps {
  plotId: PlotId;
  showYLog?: boolean;
}

const INPUT_STYLE: React.CSSProperties = {
  width: 46,
  fontSize: 10,
  fontFamily: 'monospace',
  border: '1px solid #dde3f0',
  borderRadius: 3,
  padding: '1px 4px',
  background: '#ffffff',
  color: '#374151',
  MozAppearance: 'textfield',
  appearance: 'textfield',
} as React.CSSProperties;

export default function PlotAxisBar({ plotId, showYLog = false }: PlotAxisBarProps) {
  const cfg               = useSimulatorStore((s) => s.plotConfig[plotId]);
  const setPlotAxisConfig  = useSimulatorStore((s) => s.setPlotAxisConfig);
  const resetPlotAxisConfig = useSimulatorStore((s) => s.resetPlotAxisConfig);

  const [xMinStr, setXMinStr] = useState(cfg.xMin !== undefined ? String(cfg.xMin) : '');
  const [xMaxStr, setXMaxStr] = useState(cfg.xMax !== undefined ? String(cfg.xMax) : '');
  const [yMinStr, setYMinStr] = useState(cfg.yMin !== undefined ? String(cfg.yMin) : '');
  const [yMaxStr, setYMaxStr] = useState(cfg.yMax !== undefined ? String(cfg.yMax) : '');

  useEffect(() => { setXMinStr(cfg.xMin !== undefined ? String(cfg.xMin) : ''); }, [cfg.xMin]);
  useEffect(() => { setXMaxStr(cfg.xMax !== undefined ? String(cfg.xMax) : ''); }, [cfg.xMax]);
  useEffect(() => { setYMinStr(cfg.yMin !== undefined ? String(cfg.yMin) : ''); }, [cfg.yMin]);
  useEffect(() => { setYMaxStr(cfg.yMax !== undefined ? String(cfg.yMax) : ''); }, [cfg.yMax]);

  const hasAny =
    cfg.xMin !== undefined || cfg.xMax !== undefined ||
    cfg.yMin !== undefined || cfg.yMax !== undefined ||
    cfg.yLog === true;

  const commit = (key: 'xMin' | 'xMax' | 'yMin' | 'yMax', str: string) => {
    const v = parseFloat(str);
    setPlotAxisConfig(plotId, { [key]: isNaN(v) ? undefined : v });
  };

  const kd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    e.stopPropagation();
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', flexShrink: 0,
        background: '#f8faff', borderBottom: '1px solid #dde3f0',
        minHeight: 28,
      }}
    >
      <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.05em' }}>X</span>
      <input
        type="number" style={INPUT_STYLE}
        value={xMinStr} placeholder="min"
        onChange={(e) => setXMinStr(e.target.value)}
        onBlur={() => commit('xMin', xMinStr)}
        onKeyDown={kd}
      />
      <span style={{ fontSize: 9, color: '#94a3b8' }}>–</span>
      <input
        type="number" style={INPUT_STYLE}
        value={xMaxStr} placeholder="max"
        onChange={(e) => setXMaxStr(e.target.value)}
        onBlur={() => commit('xMax', xMaxStr)}
        onKeyDown={kd}
      />

      <div style={{ width: 1, height: 12, background: '#dde3f0', margin: '0 2px', flexShrink: 0 }} />

      <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.05em' }}>Y</span>
      <input
        type="number" style={INPUT_STYLE}
        value={yMinStr} placeholder="min"
        onChange={(e) => setYMinStr(e.target.value)}
        onBlur={() => commit('yMin', yMinStr)}
        onKeyDown={kd}
      />
      <span style={{ fontSize: 9, color: '#94a3b8' }}>–</span>
      <input
        type="number" style={INPUT_STYLE}
        value={yMaxStr} placeholder="max"
        onChange={(e) => setYMaxStr(e.target.value)}
        onBlur={() => commit('yMax', yMaxStr)}
        onKeyDown={kd}
      />

      {showYLog && (
        <>
          <div style={{ width: 1, height: 12, background: '#dde3f0', margin: '0 2px', flexShrink: 0 }} />
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none' }}
          >
            <input
              type="checkbox"
              checked={!!cfg.yLog}
              onChange={(e) =>
                setPlotAxisConfig(plotId, { yLog: e.target.checked ? true : undefined })
              }
              style={{ width: 11, height: 11, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 9, color: '#6b7280' }}>log Y</span>
          </label>
        </>
      )}

      {hasAny && (
        <button
          onClick={() => resetPlotAxisConfig(plotId)}
          title="Reset to auto ranges"
          style={{
            marginLeft: 'auto',
            fontSize: 13, lineHeight: 1,
            color: '#9ca3af',
            background: 'none', border: 'none',
            cursor: 'pointer', padding: '0 2px',
          }}
        >
          ↺
        </button>
      )}
    </div>
  );
}
