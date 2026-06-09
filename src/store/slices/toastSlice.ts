import type { StateCreator } from 'zustand';
import type { SimulatorStore } from '../simulatorStore';

export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  level: ToastLevel;
  message: string;
  ttl: number;
}

export interface ToastSlice {
  toasts: Toast[];
  addToast: (level: ToastLevel, message: string, ttl?: number) => void;
  dismissToast: (id: string) => void;
}

const DEFAULT_TTL: Record<ToastLevel, number> = {
  info:    3000,
  success: 3000,
  warning: 5000,
  error:   5000,
};

export const createToastSlice: StateCreator<SimulatorStore, [], [], ToastSlice> =
  (set) => ({
    toasts: [],

    addToast: (level, message, ttl) =>
      set((s) => ({
        toasts: [
          ...s.toasts,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            level,
            message,
            ttl: ttl ?? DEFAULT_TTL[level],
          },
        ],
      })),

    dismissToast: (id) =>
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  });
