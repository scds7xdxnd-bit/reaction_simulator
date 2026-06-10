import { useCallback, useEffect, useRef } from 'react';
import { Copy, Scissors, CopyPlus, Trash2, SlidersHorizontal } from 'lucide-react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { useClipboardActions } from '../../hooks/useClipboardActions';
import { Button, Divider } from '../ui';

export default function ContextMenu() {
  const menuVisible       = useSimulatorStore((s) => s.menuVisible);
  const menuX             = useSimulatorStore((s) => s.menuX);
  const menuY             = useSimulatorStore((s) => s.menuY);
  const menuTargetId      = useSimulatorStore((s) => s.menuTargetId);
  const closeMenu         = useSimulatorStore((s) => s.closeMenu);
  const nodes             = useSimulatorStore((s) => s.nodes);
  const setNodes          = useSimulatorStore((s) => s.setNodes);
  const setEdges          = useSimulatorStore((s) => s.setEdges);
  const pushHistory       = useSimulatorStore((s) => s.pushHistory);
  const setPropertiesNodeId = useSimulatorStore((s) => s.setPropertiesNodeId);

  const { copySelected, cut, duplicate } = useClipboardActions();
  const menuRef = useRef<HTMLDivElement>(null);

  const targetNode   = nodes.find((n) => n.id === menuTargetId);
  const isProtected  = menuTargetId === 'feed' || menuTargetId === 'product';
  const isReactor    = targetNode?.type === 'cstr' || targetNode?.type === 'pfr' || targetNode?.type === 'batch';

  const run = useCallback((fn: () => void) => {
    fn();
    closeMenu();
  }, [closeMenu]);

  const handleDelete = useCallback(() => {
    if (!menuTargetId || isProtected) return;
    const { nodes: n, edges: e } = useSimulatorStore.getState();
    pushHistory();
    setNodes(n.filter((nd) => nd.id !== menuTargetId));
    setEdges(e.filter((ed) => ed.source !== menuTargetId && ed.target !== menuTargetId));
    closeMenu();
  }, [menuTargetId, isProtected, pushHistory, setNodes, setEdges, closeMenu]);

  const handleProperties = useCallback(() => {
    if (!menuTargetId) return;
    setPropertiesNodeId(menuTargetId);
    closeMenu();
  }, [menuTargetId, setPropertiesNodeId, closeMenu]);

  useEffect(() => {
    if (!menuVisible) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [menuVisible, closeMenu]);

  if (!menuVisible || !menuTargetId) return null;

  return (
    <div
      ref={menuRef}
      style={{ top: menuY, left: menuX }}
      className="fixed z-50 bg-surface border border-border-subtle rounded-lg shadow-xl py-1 min-w-[148px]"
    >
      <Button
        variant="ghost" size="sm"
        className="w-full justify-start px-3 py-1.5 rounded-none"
        disabled={isProtected}
        onClick={() => run(copySelected)}
      >
        <Copy size={13} />
        <span className="flex-1 text-left">Copy</span>
        <span className="text-[10px] text-text-muted ml-2">⌘C</span>
      </Button>

      <Button
        variant="ghost" size="sm"
        className="w-full justify-start px-3 py-1.5 rounded-none"
        disabled={isProtected}
        onClick={() => run(cut)}
      >
        <Scissors size={13} />
        <span className="flex-1 text-left">Cut</span>
        <span className="text-[10px] text-text-muted ml-2">⌘X</span>
      </Button>

      <Button
        variant="ghost" size="sm"
        className="w-full justify-start px-3 py-1.5 rounded-none"
        disabled={isProtected}
        onClick={() => run(duplicate)}
      >
        <CopyPlus size={13} />
        <span className="flex-1 text-left">Duplicate</span>
        <span className="text-[10px] text-text-muted ml-2">⌘D</span>
      </Button>

      <div className="px-3 py-1">
        <Divider />
      </div>

      <Button
        variant="ghost" size="sm"
        className="w-full justify-start px-3 py-1.5 rounded-none text-danger hover:text-danger hover:bg-[#fef2f2]"
        disabled={isProtected}
        onClick={handleDelete}
      >
        <Trash2 size={13} />
        <span className="flex-1 text-left">Delete</span>
        <span className="text-[10px] text-text-muted ml-2">⌫</span>
      </Button>

      <Button
        variant="ghost" size="sm"
        className="w-full justify-start px-3 py-1.5 rounded-none"
        disabled={!isReactor}
        onClick={handleProperties}
      >
        <SlidersHorizontal size={13} />
        <span className="flex-1 text-left">Properties</span>
      </Button>
    </div>
  );
}
