import { toPng } from 'html-to-image';
import { useSimulatorStore } from '../store/simulatorStore';
import { concentration, conversion, totalMolarFlow } from '../types/stream';
import { makeFeedStream } from '../math/streamBridge';
import { formatEquation } from '../math/formatEquation';

export function useExport() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);

  async function exportPng() {
    const el = document.querySelector<HTMLElement>('.react-flow');
    if (!el) return;
    const date = new Date().toISOString().slice(0, 10);
    try {
      const dataUrl = await toPng(el, { cacheBust: true, backgroundColor: '#f0f4ff' });
      const a = document.createElement('a');
      a.download = `reaction-sim_${params.kinetics}_${date}_flowsheet.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error('PNG export failed', err);
    }
  }

  function exportCsv() {
    if (!result) return;
    const isSingle = params.reactionMode === 'single';
    const feedStream = makeFeedStream(params.Ca0, params.T_feed);
    const recycleIds = new Set(result.recycleEdgeIds);
    const entries = Object.entries(result.streams)
      .filter(([key]) => !key.includes('-product') && !key.startsWith('feed-'))
      .sort((a, b) => {
        const aR = recycleIds.has(a[0]) ? 1 : 0;
        const bR = recycleIds.has(b[0]) ? 1 : 0;
        if (aR !== bR) return aR - bR;
        return (a[1].streamLabel ?? '').localeCompare(b[1].streamLabel ?? '');
      });

    const headers = isSingle
      ? ['Stream', 'Xa', 'Ca (mol/L)', 'T (K)', 'Flow (mol/s)']
      : ['Stream', 'Xa', 'Ca (mol/L)', 'Cr (mol/L)', 'Cs (mol/L)', 'T (K)', 'Flow (mol/s)'];

    const rows = entries.map(([, s]) => {
      const xa = conversion(s, feedStream, 'A').toFixed(4);
      const ca = concentration(s, 'A', params.Ca0).toFixed(4);
      const T  = s.T.toFixed(1);
      const fl = totalMolarFlow(s).toFixed(3);
      const label = s.streamLabel ?? '';
      if (isSingle) return [label, xa, ca, T, fl];
      const cr = concentration(s, 'R', params.Ca0).toFixed(4);
      const cs = concentration(s, 'S', params.Ca0).toFixed(4);
      return [label, xa, ca, cr, cs, T, fl];
    });

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.download = `reaction-sim_${params.kinetics}_${date}_streams.csv`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportReport() {
    if (!result) return;
    const isSingle = params.reactionMode === 'single';
    const feedStream = makeFeedStream(params.Ca0, params.T_feed);

    const reactionLabel = params.reactionMode === 'custom' && params.customReaction
      ? formatEquation(params.customReaction.species)
      : params.kinetics;

    let flowsheetImg = '';
    try {
      const flowEl = document.querySelector<HTMLElement>('.react-flow');
      if (flowEl) {
        const dataUrl = await toPng(flowEl, { cacheBust: true, backgroundColor: '#f0f4ff' });
        flowsheetImg = `<img src="${dataUrl}" style="width:100%;max-height:380px;object-fit:contain;margin-bottom:16px" alt="Flowsheet Diagram" />`;
      }
    } catch { /* ignore */ }

    const segRows = result.segments
      .map(
        (s) =>
          `<tr><td>${s.label}</td><td>${s.reactorType}</td><td>${s.tau.toFixed(2)}</td>` +
          `<td>${s.Da.toFixed(3)}</td><td>${(s.Xa_in * 100).toFixed(1)}%</td>` +
          `<td>${(s.Xa_out * 100).toFixed(1)}%</td>` +
          `<td>${s.T_out.toFixed(0)} K</td>` +
          (s.V !== undefined ? `<td>${s.V.toFixed(2)} L</td>` : '<td>—</td>') +
          `</tr>`
      )
      .join('');

    const streamRows = Object.entries(result.streams)
      .filter(([k]) => !k.includes('-product') && !k.startsWith('feed-'))
      .map(([, s]) =>
        `<tr><td>${s.streamLabel ?? ''}</td>` +
        `<td>${conversion(s, feedStream, 'A').toFixed(4)}</td>` +
        `<td>${concentration(s, 'A', params.Ca0).toFixed(4)}</td>` +
        (!isSingle
          ? `<td>${concentration(s, 'R', params.Ca0).toFixed(4)}</td>` +
            `<td>${concentration(s, 'S', params.Ca0).toFixed(4)}</td>`
          : '') +
        `<td>${s.T.toFixed(1)}</td></tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Simulation Report</title>
<style>
  body { font-family: system-ui, sans-serif; font-size: 12px; margin: 32px; color: #0f1730; }
  h1 { font-size: 20px; color: #2563eb; margin-bottom: 4px; }
  .meta { color: #6b7280; margin-bottom: 24px; font-size: 11px; }
  h2 { font-size: 13px; font-weight: 700; color: #374151; border-bottom: 1px solid #dde3f0; padding-bottom: 4px; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #eff6ff; text-align: left; padding: 4px 8px; font-size: 10px; color: #374151; }
  td { padding: 4px 8px; border-bottom: 1px solid #f0f4ff; font-family: monospace; font-size: 11px; }
  .summary { display: flex; gap: 24px; margin-top: 8px; }
  .kpi { background: #f8faff; border: 1px solid #dde3f0; border-radius: 6px; padding: 8px 16px; }
  .kpi-label { font-size: 10px; color: #6b7280; }
  .kpi-value { font-size: 18px; font-weight: 700; color: #2563eb; }
  @media print { body { margin: 16px; } }
</style>
</head>
<body>
<h1>Reaction Simulator — Simulation Report</h1>
<div class="meta">Generated ${new Date().toLocaleString()} · Reaction: ${reactionLabel} · k = ${params.k} · Ca0 = ${params.Ca0} mol/L</div>
${flowsheetImg ? `<h2>Flowsheet Diagram</h2>${flowsheetImg}` : ''}
<div class="summary">
  <div class="kpi"><div class="kpi-label">Final Conversion</div><div class="kpi-value">${(result.finalConversion * 100).toFixed(1)}%</div></div>
  ${!isSingle ? `<div class="kpi"><div class="kpi-label">Yield Y_R</div><div class="kpi-value">${(result.finalYield * 100).toFixed(1)}%</div></div>` : ''}
  ${!isSingle ? `<div class="kpi"><div class="kpi-label">Selectivity S_R</div><div class="kpi-value">${(result.finalSelectivity * 100).toFixed(1)}%</div></div>` : ''}
  <div class="kpi"><div class="kpi-label">Converged</div><div class="kpi-value" style="color:${result.converged ? '#16a34a' : '#dc2626'}">${result.converged ? 'Yes' : 'No'}</div></div>
</div>
<h2>Reactor Segments</h2>
<table>
  <thead><tr><th>Label</th><th>Type</th><th>τ (s)</th><th>Da</th><th>Xₐ in</th><th>Xₐ out</th><th>T out</th><th>V (L)</th></tr></thead>
  <tbody>${segRows}</tbody>
</table>
<h2>Stream Summary</h2>
<table>
  <thead><tr><th>Stream</th><th>Xₐ</th><th>Cₐ (mol/L)</th>${!isSingle ? '<th>Cᵣ (mol/L)</th><th>Cₛ (mol/L)</th>' : ''}<th>T (K)</th></tr></thead>
  <tbody>${streamRows}</tbody>
</table>
<p style="margin-top:24px;color:#94a3b8;font-size:10px">Reaction Simulator · Print this page (Ctrl/Cmd + P) to save as PDF</p>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  return { exportPng, exportCsv, exportReport, hasResult: !!result };
}
