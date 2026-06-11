import type { StateCreator } from 'zustand';
import { displayUnit } from '../../math/units';
import type { Dimension, UnitProfile } from '../../math/units';

export interface UnitsSlice {
  unitsProfile: UnitProfile;
  unitsFieldOverrides: Partial<Record<string, string>>;
  setUnitsProfile: (profile: UnitProfile) => void;
  setUnitFieldOverride: (field: string, unit: string) => void;
  clearUnitFieldOverride: (field: string) => void;
  resolveUnit: (dim: Dimension, field?: string) => string;
}

export const createUnitsSlice: StateCreator<UnitsSlice, [], [], UnitsSlice> =
  (set, get) => ({
    unitsProfile: 'Teaching',
    unitsFieldOverrides: {},

    setUnitsProfile: (profile) => set({ unitsProfile: profile }),

    setUnitFieldOverride: (field, unit) =>
      set((s) => ({
        unitsFieldOverrides: { ...s.unitsFieldOverrides, [field]: unit },
      })),

    clearUnitFieldOverride: (field) =>
      set((s) => {
        const { [field]: _removed, ...rest } = s.unitsFieldOverrides;
        return { unitsFieldOverrides: rest };
      }),

    resolveUnit: (dim, field) => {
      const { unitsFieldOverrides, unitsProfile } = get();
      if (field && unitsFieldOverrides[field]) return unitsFieldOverrides[field]!;
      return displayUnit(dim, unitsProfile);
    },
  });
