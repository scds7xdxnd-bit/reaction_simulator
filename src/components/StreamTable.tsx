import { useSimulatorStore } from '../store/simulatorStore';
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { concentration, conversion, totalMolarFlow } from '../types/stream';
import { makeFeedStream } from '../math/streamBridge';

export default function StreamTable() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const feedStream = makeFeedStream(params.Ca0, params.T_feed);
  const [collapsed, setCollapsed] = useState(false);

  if (!result) return null;

  const isSingle = params.reactionMode === 'single';
  const recycleIds = new Set(result.recycleEdgeIds);
  const entries = Object.entries(result.streams)
    .filter(([key]) => !key.includes('-product') && !key.startsWith('feed-'))
    .sort((a, b) => {
      const aRecycle = recycleIds.has(a[0]) ? 1 : 0;
      const bRecycle = recycleIds.has(b[0]) ? 1 : 0;
      if (aRecycle !== bRecycle) return aRecycle - bRecycle;
      const aLabel = a[1].streamLabel ?? '';
      const bLabel = b[1].streamLabel ?? '';
      return aLabel.localeCompare(bLabel);
    });

  if (entries.length === 0) return null;

  return (
    <div className="border-t border-[#dde3f0] bg-[#ffffff]">
      <div
        className="flex items-center gap-1 px-3 py-1.5 cursor-pointer hover:bg-[#f8faff]"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight size={12} className="text-[#6b7280]" /> : <ChevronDown size={12} className="text-[#6b7280]" />}
        <span className="text-[11px] font-medium text-[#374151] uppercase tracking-wider">Stream Table</span>
        {result.converged ? (
          <CheckCircle size={12} className="text-[#16a34a] ml-auto" />
        ) : (
          <AlertTriangle size={12} className="text-[#d97706] ml-auto" />
        )}
        <span className="text-[9px] text-[#6b7280]">
          {result.converged ? `converged (${result.iterations} iter)` : `not converged (${result.iterations} iter)`}
        </span>
      </div>
      {!collapsed && (
        <div className="max-h-[200px] overflow-y-auto">
          <table className="w-full text-[10px] font-mono">
            <thead className="bg-[#f8faff] sticky top-0">
              <tr>
                <th className="text-left px-2 py-1 text-[#374151] font-medium">Stream</th>
                <th className="text-right px-2 py-1 text-[#374151] font-medium">Xₐ</th>
                <th className="text-right px-2 py-1 text-[#374151] font-medium">Cₐ</th>
                {!isSingle && (
                  <>
                    <th className="text-right px-2 py-1 text-[#374151] font-medium">Cᵣ</th>
                    <th className="text-right px-2 py-1 text-[#374151] font-medium">Cₛ</th>
                  </>
                )}
                <th className="text-right px-2 py-1 text-[#374151] font-medium">T</th>
                <th className="text-right px-2 py-1 text-[#374151] font-medium">Flow</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([id, stream]) => {
                const T = stream.T ?? params.T_feed ?? 300;
                const tColor = T > 310 ? '#dc2626' : T < 290 ? '#2563eb' : '#6b7280';
                const isRecycle = recycleIds.has(id);
                const label = stream.streamLabel ?? id;
                const desc = stream.streamDesc;
                return (
                  <tr key={id} className="border-t border-[#dde3f0]">
                    <td className="px-2 py-0.5">
                      <span className="font-mono font-semibold text-[#0f1730]">{label}</span>
                      {isRecycle && (
                        <span className="text-[#7c3aed] ml-1">↺</span>
                      )}
                      {desc && (
                        <div className="text-[#6b7280] text-[9px]">{desc}</div>
                      )}
                    </td>
                    <td className="text-right px-2 py-0.5 text-[#0f1730]">
                      {(conversion(stream, feedStream, 'A') * 100).toFixed(1)}%
                    </td>
                    <td className="text-right px-2 py-0.5 text-[#0f1730]">
                      {concentration(stream, 'A', params.Ca0).toFixed(3)}
                    </td>
                    {!isSingle && (
                      <>
                        <td className="text-right px-2 py-0.5 text-[#0f1730]">
                          {concentration(stream, 'R', params.Ca0).toFixed(3)}
                        </td>
                        <td className="text-right px-2 py-0.5 text-[#0f1730]">
                          {concentration(stream, 'S', params.Ca0).toFixed(3)}
                        </td>
                      </>
                    )}
                    <td className="text-right px-2 py-0.5" style={{ color: tColor }}>
                      {T.toFixed(0)} K
                    </td>
                    <td className="text-right px-2 py-0.5 text-[#0f1730]">
                      {(totalMolarFlow(stream) / params.Ca0).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
