import { useState } from 'react';
import { useSimulatorStore } from '../store/simulatorStore';
import { getPreset } from '../math/reactionRegistry';
import { useValidation } from '../hooks/useValidation';
import { AlertTriangle, CheckCircle, Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function StatusBar() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const setRightTab       = useSimulatorStore((s) => s.setRightTab);
  const setPendingTarget  = useSimulatorStore((s) => s.setPendingDesignTarget);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; metric: string; value: number } | null>(null);
  const nodes = useSimulatorStore((s) => s.nodes);
  const simulationMode = useSimulatorStore((s) => s.simulationMode);
  const setSimulationMode = useSimulatorStore((s) => s.setSimulationMode);
  const sizingMode = useSimulatorStore((s) => s.sizingMode);
  const setSizingMode = useSimulatorStore((s) => s.setSizingMode);
  const { isDark, toggle: toggleDark } = useTheme();
  const updateParams = useSimulatorStore((s) => s.updateParams);

  const isSingle = params.reactionMode === 'single';
  const finalXa = result?.finalConversion ?? null;

  const conversionColor =
    finalXa !== null
      ? finalXa > 0.7
        ? 'var(--success)'
        : finalXa > 0.4
          ? 'var(--warn)'
          : 'var(--danger)'
      : 'var(--text-muted)';

  const reactorCount = nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr' || n.type === 'batch').length;
  const hasMixerOrSplitter = nodes.some((n) => n.type === 'mixer' || n.type === 'splitter');

  const preset        = getPreset(params);
  const kUnit         = preset.kUnit ?? 's⁻¹';
  const kineticsLabel = preset.uiLabel;

  const finalYield = result?.finalYield ?? NaN;
  const finalSelectivity = result?.finalSelectivity ?? NaN;

  const yieldColor = isNaN(finalYield)
    ? 'var(--text-muted)'
    : finalYield > 0.4
      ? 'var(--success)'
      : finalYield > 0.2
        ? 'var(--warn)'
        : 'var(--danger)';

  const selColor = isNaN(finalSelectivity)
    ? 'var(--text-muted)'
    : finalSelectivity > 0.6
      ? 'var(--success)'
      : finalSelectivity > 0.3
        ? 'var(--warn)'
        : 'var(--danger)';

  const issues     = useValidation();
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warnCount  = issues.filter((i) => i.level === 'warning').length;

  const handleCtxMenuAction = (e: React.MouseEvent, metric: string, value: number) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, metric, value });
  };

  const applyTarget = () => {
    if (!ctxMenu) return;
    setPendingTarget({ metric: ctxMenu.metric, value: ctxMenu.value });
    setRightTab('design');
    setCtxMenu(null);
  };

  return (
    <div
      className="h-12 flex items-center px-4 gap-3 text-[12px] shrink-0"
      style={{ background: 'var(--surface-raised)', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      onClick={() => ctxMenu && setCtxMenu(null)}
    >
      {ctxMenu && (
        <div
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y - 36,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: 'var(--shadow-popover)',
            zIndex: 9999,
            padding: '4px 0',
          }}
        >
          <button
            onClick={applyTarget}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
          >
            Make this a target…
          </button>
        </div>
      )}
      {result ? (
        <>
          <span style={{ color: 'var(--text-secondary)' }}>Final Xₐ:</span>
          <span
            className="font-mono font-bold"
            style={{ color: conversionColor, cursor: 'context-menu' }}
            onContextMenu={(e) => handleCtxMenuAction(e, 'Xa', finalXa ?? 0)}
            title="Right-click to set as design target"
          >
            {(finalXa! * 100).toFixed(1)}%
          </span>

          {!isSingle && !isNaN(finalYield) && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ color: 'var(--text-secondary)' }}>Yield Y_R:</span>
              <span
                className="font-mono font-bold"
                style={{ color: yieldColor, cursor: 'context-menu' }}
                onContextMenu={(e) => handleCtxMenuAction(e, 'yield_R', finalYield)}
                title="Right-click to set as design target"
              >
                {(finalYield * 100).toFixed(1)}%
              </span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ color: 'var(--text-secondary)' }}>Selectivity S_R:</span>
              <span
                className="font-mono font-bold"
                style={{ color: selColor, cursor: 'context-menu' }}
                onContextMenu={(e) => handleCtxMenuAction(e, 'selectivity_R', finalSelectivity)}
                title="Right-click to set as design target"
              >
                {(finalSelectivity * 100).toFixed(1)}%
              </span>
            </>
          )}

          {hasMixerOrSplitter && result && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              {result.converged ? (
                <span className="flex items-center gap-1" style={{ color: 'var(--success)' }}>
                  <CheckCircle size={12} />
                  <span className="font-mono">Converged ({result.iterations} iter)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1" style={{ color: 'var(--warn)' }}>
                  <AlertTriangle size={12} />
                  <span className="font-mono">Not converged ({result.iterations} iter)</span>
                </span>
              )}
            </>
          )}
        </>
      ) : (
        <span className="flex items-center gap-1.5" style={{ color: 'var(--warn)' }}>
          <AlertTriangle size={14} />
          <span>{hasMixerOrSplitter
            ? 'Connect Feed → Units → Product to simulate'
            : 'Connect Feed → Reactors → Product to simulate'}</span>
        </span>
      )}

      {issues.length > 0 && (
        <>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <span
            title={issues.map((i) => i.message).join('\n')}
            className="flex items-center gap-1 cursor-default"
            style={{ color: errorCount > 0 ? 'var(--danger)' : 'var(--warn)' }}
          >
            <AlertTriangle size={12} />
            <span className="font-mono">
              {errorCount > 0
                ? `${errorCount} error${errorCount > 1 ? 's' : ''}`
                : `${warnCount} warning${warnCount > 1 ? 's' : ''}`}
            </span>
          </span>
        </>
      )}

      <span style={{ color: 'var(--text-muted)' }}>|</span>
      <span style={{ color: 'var(--text-secondary)' }}>Kinetics:</span>
      <span style={{ color: 'var(--text-primary)' }}>{kineticsLabel}</span>

      <span style={{ color: 'var(--text-muted)' }}>|</span>
      <span style={{ color: 'var(--text-secondary)' }}>{isSingle ? 'k =' : 'k₁ ='}</span>
      <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
        {params.k.toFixed(2)} {kUnit}
      </span>

      {!isSingle && (
        <>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <span style={{ color: 'var(--text-secondary)' }}>k₂ =</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
            {params.k2.toFixed(2)} s⁻¹
          </span>
        </>
      )}

      <span style={{ color: 'var(--text-muted)' }}>|</span>
      <span style={{ color: 'var(--text-secondary)' }}>Cₐ₀ =</span>
      <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{params.Ca0.toFixed(2)} mol/L</span>

      {preset.id === 'single-autocatalytic' && (
        <>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <span style={{ color: 'var(--text-secondary)' }}>Cᵣ₀/Cₐ₀ =</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{params.Cr0_fraction.toFixed(3)}</span>
        </>
      )}

      <span style={{ color: 'var(--text-muted)' }}>|</span>
      <span style={{ color: 'var(--text-secondary)' }}>
        {hasMixerOrSplitter
          ? `${reactorCount} Reactor${reactorCount !== 1 ? 's' : ''} in Network`
          : `${reactorCount} Reactor${reactorCount !== 1 ? 's' : ''} in Series`}
      </span>

      {sizingMode && result && params.Q_feed > 0 && (
        <>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <span style={{ color: 'var(--text-secondary)' }}>Total V:</span>
          <span className="font-mono font-bold" style={{ color: 'var(--cat-pressure)' }}>
            {result.segments.reduce((acc, s) => acc + (s.V ?? 0), 0).toFixed(2)} L
          </span>
        </>
      )}

      <div className="ml-auto flex gap-1">
        <button
          onClick={toggleDark}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition-colors"
          style={{
            background: 'var(--surface-raised)',
            color: 'var(--text-muted)',
            borderColor: 'var(--border)',
          }}
        >
          {isDark ? <Sun size={11} /> : <Moon size={11} />}
        </button>
        <button
          onClick={() => setSizingMode(!sizingMode)}
          className="text-[10px] px-2 py-0.5 rounded border font-medium transition-colors"
          style={{
            background: sizingMode ? 'var(--cat-pressure)' : 'var(--bg-inset)',
            color: sizingMode ? '#ffffff' : 'var(--text-secondary)',
            borderColor: sizingMode ? 'var(--cat-pressure)' : 'var(--border)',
          }}
        >
          Sizing
        </button>
        {sizingMode && (
          <div className="flex items-center gap-1">
            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Q =</span>
            <input
              type="number"
              min="0.001"
              max="1000"
              step="0.1"
              value={params.Q_feed || ''}
              placeholder="L/s"
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) updateParams({ Q_feed: v });
              }}
              className="w-16 text-[10px] font-mono border rounded px-1 py-0.5 outline-none"
              style={{ borderColor: 'var(--cat-pressure)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>L/s</span>
          </div>
        )}
        <button
          onClick={() => setSimulationMode('steady-state')}
          className="text-[10px] px-2 py-0.5 rounded border font-medium transition-colors"
          style={{
            background: simulationMode === 'steady-state' ? 'var(--accent)' : 'var(--bg-inset)',
            color: simulationMode === 'steady-state' ? '#ffffff' : 'var(--text-secondary)',
            borderColor: simulationMode === 'steady-state' ? 'var(--accent)' : 'var(--border)',
          }}
        >
          Steady State
        </button>
        <button
          onClick={() => setSimulationMode('dynamic')}
          className="text-[10px] px-2 py-0.5 rounded border font-medium transition-colors"
          style={{
            background: simulationMode === 'dynamic' ? 'var(--accent)' : 'var(--bg-inset)',
            color: simulationMode === 'dynamic' ? '#ffffff' : 'var(--text-secondary)',
            borderColor: simulationMode === 'dynamic' ? 'var(--accent)' : 'var(--border)',
          }}
        >
          Dynamic
        </button>
      </div>
    </div>
  );
}
