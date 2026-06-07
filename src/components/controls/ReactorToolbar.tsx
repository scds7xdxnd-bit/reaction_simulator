import { useCallback } from 'react';

function CstRIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="#2563eb" strokeWidth="1.5" fill="none" />
      <line x1="7" y1="12" x2="17" y2="12" stroke="#2563eb" strokeWidth="1" strokeDasharray="2 2" />
      <line x1="10" y1="9" x2="10" y2="15" stroke="#2563eb" strokeWidth="1" />
      <line x1="14" y1="9" x2="14" y2="15" stroke="#2563eb" strokeWidth="1" />
    </svg>
  );
}

function PFRicon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="6" stroke="#d97706" strokeWidth="1.5" fill="none" />
      <line x1="7" y1="12" x2="17" y2="12" stroke="#d97706" strokeWidth="1" strokeDasharray="2 2" />
      <line x1="9" y1="10" x2="9" y2="14" stroke="#d97706" strokeWidth="0.8" />
      <line x1="12" y1="10" x2="12" y2="14" stroke="#d97706" strokeWidth="0.8" />
      <line x1="15" y1="10" x2="15" y2="14" stroke="#d97706" strokeWidth="0.8" />
    </svg>
  );
}

export default function ReactorToolbar() {
  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string) => {
      event.dataTransfer.setData('application/reactflow', nodeType);
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  return (
    <div className="w-16 h-full bg-[#ffffff] border-r border-[#dde3f0] flex flex-col items-center pt-4 gap-4">
      <div
        className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, 'CSTR')}
        style={{ width: 56 }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{
            width: 44,
            height: 52,
            borderColor: '#2563eb',
            background: '#eff6ff',
          }}
        >
          <CstRIcon />
        </div>
        <span className="text-[10px] font-medium text-[#2563eb] uppercase tracking-wider">
          CSTR
        </span>
      </div>

      <div
        className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, 'PFR')}
        style={{ width: 56 }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{
            width: 44,
            height: 52,
            borderColor: '#d97706',
            background: '#fffbeb',
          }}
        >
          <PFRicon />
        </div>
        <span className="text-[10px] font-medium text-[#d97706] uppercase tracking-wider">
          PFR
        </span>
      </div>
    </div>
  );
}
