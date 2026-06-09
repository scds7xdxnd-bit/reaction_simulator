import { useEffect } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import { useSimulatorStore } from '../store/simulatorStore';
import type { Toast, ToastLevel } from '../store/slices/toastSlice';

const ICONS: Record<ToastLevel, React.ReactNode> = {
  info:    <Info    size={14} className="shrink-0 mt-0.5" />,
  success: <CheckCircle  size={14} className="shrink-0 mt-0.5" />,
  warning: <AlertTriangle size={14} className="shrink-0 mt-0.5" />,
  error:   <XCircle size={14} className="shrink-0 mt-0.5" />,
};

const CARD_CLASS: Record<ToastLevel, string> = {
  info:    'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  error:   'bg-red-50 border-red-200 text-red-800',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.ttl);
    return () => clearTimeout(timer);
  }, [toast.id, toast.ttl, onDismiss]);

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded-lg border shadow-lg pointer-events-auto min-w-[260px] max-w-[380px] text-[12px] leading-snug ${CARD_CLASS[toast.level]}`}
    >
      {ICONS[toast.level]}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-1 shrink-0 opacity-60 hover:opacity-100 cursor-pointer transition-opacity"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function Toaster() {
  const toasts      = useSimulatorStore((s) => s.toasts);
  const dismissToast = useSimulatorStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 right-4 z-50 flex flex-col-reverse gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
