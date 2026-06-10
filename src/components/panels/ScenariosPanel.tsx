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
    <div className="flex flex-col h-full overflow-hidden bg-[#f8faff]">
      <div className="px-3 py-2 border-b border-[#dde3f0] bg-[#ffffff] flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          placeholder="Scenario name…"
          className="flex-1 text-[11px] border border-[#dde3f0] rounded px-2 py-1 outline-none bg-[#f8faff] text-[#0f1730]"
        />
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="text-[10px] px-2 py-1 rounded font-medium transition-colors disabled:opacity-40"
          style={{ background: '#2563eb', color: '#ffffff' }}
          title={!canSave ? 'Maximum 10 scenarios reached' : 'Save current state as scenario'}
        >
          Save
        </button>
      </div>

      {scenarios.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[11px] text-[#94a3b8] text-center px-4">
          No saved scenarios yet.<br />
          Run a simulation and click Save to snapshot it.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-[10px]">
            <thead className="bg-[#eff6ff] sticky top-0">
              <tr>
                <th className="text-left px-2 py-1.5 text-[#374151] font-medium">Name</th>
                <th className="text-right px-2 py-1.5 text-[#374151] font-medium">Kinetics</th>
                <th className="text-right px-2 py-1.5 text-[#374151] font-medium">Xₐ</th>
                <th className="text-right px-2 py-1.5 text-[#374151] font-medium">Yield</th>
                <th className="text-right px-2 py-1.5 text-[#374151] font-medium">Sel.</th>
                <th className="px-1 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {scenarios.map((sc) => (
                <tr
                  key={sc.id}
                  onClick={() => handleRestore(sc)}
                  className="border-b border-[#f0f4ff] cursor-pointer hover:bg-[#eff6ff] transition-colors"
                  title={`Saved: ${sc.savedAt} — click to restore`}
                >
                  <td className="px-2 py-1.5 font-medium text-[#0f1730] max-w-[100px]">
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
                        className="w-full text-[10px] bg-transparent border-b border-[#2563eb] outline-none font-medium"
                        style={{ color: '#0f1730' }}
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
                  <td className="px-2 py-1.5 text-right font-mono text-[#6b7280] max-w-[80px] truncate">
                    {sc.kinetics}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold"
                      style={{ color: sc.Xa > 0.7 ? '#16a34a' : sc.Xa > 0.4 ? '#d97706' : '#dc2626' }}>
                    {pct(sc.Xa)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[#374151]">
                    {sc.yieldR > 0 ? pct(sc.yieldR) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[#374151]">
                    {sc.selectivity > 0 ? pct(sc.selectivity) : '—'}
                  </td>
                  <td className="px-1 py-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(sc.id); }}
                      className="p-0.5 rounded hover:bg-[#fee2e2] transition-colors"
                      title="Delete scenario"
                    >
                      <Trash2 size={10} color="#dc2626" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[9px] text-[#b0bcd4] px-3 py-2 text-center">
            {scenarios.length}/{10} scenarios · click a row to restore
          </p>
        </div>
      )}
    </div>
  );
}
