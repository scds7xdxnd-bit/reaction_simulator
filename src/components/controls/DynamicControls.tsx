import { useState } from 'react';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';
import { Button, Input, Select } from '../ui';

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
  isRunning, t, speed,
  onPlay, onPause, onReset, onSetSpeed, onApplyDisturbance,
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
    <div className="h-12 bg-surface-elevated border-t border-border-subtle flex items-center px-4 gap-3 text-[12px] shrink-0">
      <Button variant="secondary" size="md" onClick={onReset}>
        <RotateCcw size={14} /> Reset
      </Button>

      <Button variant="primary" size="md" onClick={isRunning ? onPause : onPlay}>
        {isRunning ? <Pause size={14} /> : <Play size={14} />}
        {isRunning ? 'Pause' : 'Play'}
      </Button>

      <span className="font-mono text-text-primary text-[13px]">
        t = {t.toFixed(2)} s
      </span>

      <span className="text-border-medium">|</span>
      <span className="text-text-secondary text-[11px]">Speed:</span>
      <Select
        value={speed}
        onChange={(e) => onSetSpeed(Number(e.target.value) as 1 | 5 | 10 | 50)}
      >
        <option value={1}>1×</option>
        <option value={5}>5×</option>
        <option value={10}>10×</option>
        <option value={50}>50×</option>
      </Select>

      <div className="relative ml-auto">
        <Button
          variant="ghost"
          size="md"
          className="text-warning hover:text-warning hover:bg-pfr-fill border border-border-subtle"
          onClick={() => setShowDisturbance(!showDisturbance)}
        >
          <Zap size={14} /> Disturbance
        </Button>

        {showDisturbance && (
          <div className="absolute right-0 bottom-full mb-1 bg-surface border border-border-subtle rounded shadow-lg p-3 z-50 min-w-[200px]">
            <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">Feed concentration</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={magStr}
                onChange={(e) => setMagStr(e.target.value)}
                className="w-16"
              />
              <span className="text-[11px] text-text-secondary">%</span>
              <Button variant="primary" size="sm" onClick={handleApply}>
                Apply at t = {t.toFixed(2)} s
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
