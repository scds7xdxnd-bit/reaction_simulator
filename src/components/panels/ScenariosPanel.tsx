import { useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useScenarios } from '../../hooks/useScenarios';
import type { Scenario } from '../../hooks/useScenarios';

export default function ScenariosPanel() {
  const { getScenarios, save, remove, restore, canSave, rename } = useScenarios();
  const [name, setName] = useState('');
  const [, forceUpdate] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const scenarios = getScenarios();

  const handleSave = useCallback(() => {
    if (save(name)) {
      setName('');
      forceUpdate((n) => n + 1);
    }
  }, [name, save]);

  const handleRemove = useCallback((id: string) => {
    remove(id);
    forceUpdate((n) => n + 1);
  }, [remove]);

  const handleRestore = useCallback((s: Scenario) => {
    restore(s);
  }, [restore]);

  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-inset)' }}>
      <div className="px-3 py-2 flex items-center gap-2 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          placeholder="Scenario name…"
          className="flex-1 text-[11px] rounded px-2 py-1 outline-none"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-inset)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="text-[10px] px-2 py-1 rounded font-medium transition-colors disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#ffffff' }}
          title={!canSave ? 'Maximum 10 scenarios reached' : 'Save current state as scenario'}
        >
          Save
        </button>
      </div>

      {scenarios.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[11px] text-center px-4" style={{ color: 'var(--text-muted)' }}>
          No saved scenarios yet.<br />
          Run a simulation and click Save to snapshot it.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0" style={{ background: 'var(--accent-soft)' }}>
              <tr>
                <th className="text-left px-2 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>Name</th>
                <th className="text-right px-2 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>Kinetics</th>
                <th className="text-right px-2 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>Xₐ</th>
                <th className="text-right px-2 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>Yield</th>
                <th className="text-right px-2 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>Sel.</th>
                <th className="px-1 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {scenarios.map((sc) => (
                <tr
                  key={sc.id}
                  onClick={() => handleRestore(sc)}
                  className="cursor-pointer scenario-row transition-colors"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  title={`Saved: ${sc.savedAt} — click to restore`}
                >
                  <td className="px-2 py-1.5 font-medium max-w-[100px]" style={{ color: 'var(--text-primary)' }}>
                    {editingId === sc.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => {
                          if (editingName.trim()) {
                            rename(sc.id, editingName.trim());
                            forceUpdate((n) => n + 1);
                          }
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingId(null);
                          e.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-[10px] bg-transparent outline-none font-medium"
                        style={{ borderBottom: '1px solid var(--accent)', color: 'var(--text-primary)' }}
                      />
                    ) : (
                      <span
                        className="truncate block cursor-text"
                        title="Double-click to rename"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingId(sc.id);
                          setEditingName(sc.name);
                        }}
                      >
                        {sc.name}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono max-w-[80px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    {sc.kinetics}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold"
                      style={{ color: sc.Xa > 0.7 ? 'var(--success)' : sc.Xa > 0.4 ? 'var(--warn)' : 'var(--danger)' }}>
                    {pct(sc.Xa)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>
                    {sc.yieldR > 0 ? pct(sc.yieldR) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>
                    {sc.selectivity > 0 ? pct(sc.selectivity) : '—'}
                  </td>
                  <td className="px-1 py-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(sc.id); }}
                      className="p-0.5 rounded btn-danger-hover transition-colors"
                      title="Delete scenario"
                    >
                      <Trash2 size={10} color="var(--danger)" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[9px] px-3 py-2 text-center" style={{ color: 'var(--text-muted)' }}>
            {scenarios.length}/{10} scenarios · click a row to restore
          </p>
        </div>
      )}
    </div>
  );
}
