import { useState } from 'react';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';

interface Props {
  isRunning: boolean;
  t: number;
  speed: 1 | 5 | 10 | 50;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSetSpeed: (speed: 1 | 5 | 10 | 50) => void;
  onApplyDisturbance: (magnitude: number) => void;
}

export default function DynamicControls({
  isRunning,
  t,
  speed,
  onPlay,
  onPause,
  onReset,
  onSetSpeed,
  onApplyDisturbance,
}: Props) {
  const [showDisturbance, setShowDisturbance] = useState(false);
  const [magStr, setMagStr] = useState('20');

  const handleApply = () => {
    const mag = parseFloat(magStr);
    if (!isNaN(mag)) {
      onApplyDisturbance(mag);
      setShowDisturbance(false);
    }
  };

  return (
    <div className="h-12 bg-[#f8faff] border-t border-[#dde3f0] flex items-center px-4 gap-3 text-[12px] shrink-0">
      <button
        onClick={onReset}
        className="flex items-center gap-1 px-2 py-1 rounded border border-[#dde3f0] bg-[#ffffff] text-[#374151] hover:bg-[#f0f4ff] text-[11px] font-medium"
      >
        <RotateCcw size={14} /> Reset
      </button>

      <button
        onClick={isRunning ? onPause : onPlay}
        className="flex items-center gap-1 px-3 py-1 rounded bg-[#2563eb] text-[#ffffff] hover:bg-[#1d4ed8] text-[11px] font-medium"
      >
        {isRunning ? <Pause size={14} /> : <Play size={14} />}
        {isRunning ? 'Pause' : 'Play'}
      </button>

      <span className="font-mono text-[#0f1730] text-[13px]">
        t = {t.toFixed(2)} s
      </span>

      <span className="text-[#b0bcd4]">|</span>
      <span className="text-[#374151] text-[11px]">Speed:</span>
      <select
        value={speed}
        onChange={(e) => onSetSpeed(Number(e.target.value) as 1 | 5 | 10 | 50)}
        className="text-[11px] border border-[#dde3f0] rounded px-1.5 py-0.5 bg-[#ffffff] text-[#374151] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
      >
        <option value={1}>1×</option>
        <option value={5}>5×</option>
        <option value={10}>10×</option>
        <option value={50}>50×</option>
      </select>

      <div className="relative ml-auto">
        <button
          onClick={() => setShowDisturbance(!showDisturbance)}
          className="flex items-center gap-1 px-2 py-1 rounded border border-[#dde3f0] bg-[#ffffff] text-[#d97706] hover:bg-[#fffbeb] text-[11px] font-medium"
        >
          <Zap size={14} /> Disturbance
        </button>

        {showDisturbance && (
          <div className="absolute right-0 bottom-full mb-1 bg-[#ffffff] border border-[#dde3f0] rounded shadow-lg p-3 z-50 min-w-[200px]">
            <p className="text-[10px] text-[#6b7280] mb-2 uppercase tracking-wider">Feed concentration</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={magStr}
                onChange={(e) => setMagStr(e.target.value)}
                className="w-16 text-[11px] font-mono border border-[#dde3f0] rounded px-1.5 py-0.5 text-[#0f1730] outline-none focus:border-[#2563eb]"
              />
              <span className="text-[11px] text-[#374151]">%</span>
              <button
                onClick={handleApply}
                className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#2563eb] text-[#ffffff] hover:bg-[#1d4ed8]"
              >
                Apply at t = {t.toFixed(2)} s
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
