import { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { SplitterNodeData } from '../../types/reactor';

function SplitterNode({ id, data }: { id: string; data: SplitterNodeData }) {
  const { updateNodeData } = useReactFlow();
  const [alphaStr, setAlphaStr] = useState(String(data.alpha));

  useEffect(() => { setAlphaStr(String(data.alpha)); }, [data.alpha]);

  return (
    <div
      style={{
        width: 110,
        height: 80,
        borderRadius: 8,
        background: '#ffffff',
        border: '2px solid #7c3aed',
      }}
      className="flex flex-col items-center justify-center gap-1"
    >
      <Handle type="target" position={Position.Left} id="in"
        style={{ width: 10, height: 10, background: '#7c3aed', border: 'none', left: -5 }} />
      <Handle type="source" position={Position.Right} id="out-top"
        style={{ width: 8, height: 8, background: '#7c3aed', border: 'none', right: -4, top: '30%' }} />
      <Handle type="source" position={Position.Right} id="out-bot"
        style={{ width: 8, height: 8, background: '#7c3aed', border: 'none', right: -4, top: '70%' }} />
      <span className="text-[11px] font-medium text-[#7c3aed] uppercase tracking-wider">
        Splitter
      </span>
      <span className="text-[10px] font-mono text-[#374151]">{data.label}</span>
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-[#374151]">α =</span>
        <input
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={alphaStr}
          onChange={(e) => setAlphaStr(e.target.value)}
          onBlur={() => {
            const parsed = parseFloat(alphaStr);
            if (!isNaN(parsed)) {
              const clamped = Math.max(0, Math.min(1, parsed));
              updateNodeData(id, { ...data, alpha: clamped });
              setAlphaStr(String(clamped));
            } else {
              setAlphaStr(String(data.alpha));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            e.stopPropagation();
          }}
          className="w-10 text-[10px] font-mono bg-[#f8faff] border border-[#dde3f0] rounded px-1 py-0.5 text-[#0f1730] outline-none focus:border-[#7c3aed]"
        />
      </div>
    </div>
  );
}

export default memo(SplitterNode);
