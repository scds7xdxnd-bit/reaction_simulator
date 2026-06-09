import { useCallback, useEffect, useRef } from 'react';
import { Clipboard } from 'lucide-react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { useClipboardActions } from '../../hooks/useClipboardActions';
import { Button } from '../ui';

export default function CanvasContextMenu() {
  const canvasMenuVisible = useSimulatorStore((s) => s.canvasMenuVisible);
  const canvasMenuX       = useSimulatorStore((s) => s.canvasMenuX);
  const canvasMenuY       = useSimulatorStore((s) => s.canvasMenuY);
  const canvasMenuFlowX   = useSimulatorStore((s) => s.canvasMenuFlowX);
  const canvasMenuFlowY   = useSimulatorStore((s) => s.canvasMenuFlowY);
  const closeCanvasMenu   = useSimulatorStore((s) => s.closeCanvasMenu);
  const clipboard         = useSimulatorStore((s) => s.clipboard);
  const { pasteAt } = useClipboardActions();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasMenuVisible) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        closeCanvasMenu();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [canvasMenuVisible, closeCanvasMenu]);

  if (!canvasMenuVisible) return null;

  return (
    <div
      ref={menuRef}
      style={{ top: canvasMenuY, left: canvasMenuX }}
      className="fixed z-50 bg-surface border border-border-subtle rounded-lg shadow-xl py-1 min-w-[160px]"
    >
      <Button
        variant="ghost" size="sm"
        className="w-full justify-start px-3 py-1.5 rounded-none"
        disabled={clipboard === null}
        onClick={() => { pasteAt(canvasMenuFlowX, canvasMenuFlowY); closeCanvasMenu(); }}
      >
        <Clipboard size={13} />
        <span className="flex-1 text-left">Paste here</span>
        <span className="text-[10px] text-text-muted ml-2">⌘V</span>
      </Button>
    </div>
  );
}
