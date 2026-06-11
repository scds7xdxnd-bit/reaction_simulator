import type { SimulationParams } from '../types/reactor';

export interface ParamFieldDef {
  key: keyof SimulationParams;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

export interface ParamSectionDef {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  fields: ParamFieldDef[];
}

export const PARAM_SECTIONS: ParamSectionDef[] = [
  {
    id: 'feed',
    label: 'Feed Conditions',
    color: '#0d9488',
    bgColor: '#f0fdfa',
    fields: [
      { key: 'Ca0',          label: 'Cₐ₀',      unit: 'mol/L', min: 0.1,   max: 100,  step: 0.1   },
      { key: 'Cb0',          label: 'C_B₀',      unit: 'mol/L', min: 0.1,   max: 100,  step: 0.1   },
      { key: 'T_feed',       label: 'T_feed',    unit: 'K',     min: 200,   max: 600,  step: 5     },
      { key: 'epsilon',      label: 'ε',         unit: '—',     min: -1,    max: 3,    step: 0.01  },
      { key: 'Cr0_fraction', label: 'Cᵣ₀/Cₐ₀',  unit: '—',     min: 0.001, max: 0.5,  step: 0.001 },
    ],
  },
  {
    id: 'kinetics',
    label: 'Kinetics',
    color: '#2563eb',
    bgColor: '#f8faff',
    fields: [
      { key: 'k',       label: 'k₁',      unit: 's⁻¹',    min: 0.01, max: 10,  step: 0.01 },
      { key: 'k2',      label: 'k₂',      unit: 's⁻¹',    min: 0.01, max: 10,  step: 0.01 },
      { key: 'k3',      label: 'k₃',      unit: 's⁻¹',    min: 0.01, max: 10,  step: 0.01 },
      { key: 'k4',      label: 'k₄',      unit: 's⁻¹',    min: 0.01, max: 10,  step: 0.01 },
      { key: 'Keq_ref', label: 'Kₑq,ref', unit: '—',      min: 0.1,  max: 100, step: 0.1  },
      { key: 'Ea',      label: 'Eₐ',      unit: 'kJ/mol', min: 0,    max: 500, step: 1    },
    ],
  },
  {
    id: 'thermal',
    label: 'Thermodynamics',
    color: '#f97316',
    bgColor: '#fff7ed',
    fields: [
      { key: 'delta_H', label: 'ΔH',    unit: 'kJ/mol',    min: -500, max: 500, step: 1   },
      { key: 'rho_Cp',  label: 'ρCₚ',   unit: 'kJ/(m³·K)', min: 0.1,  max: 20,  step: 0.1 },
      { key: 'T_ref',   label: 'T_ref', unit: 'K',          min: 200,  max: 600, step: 5   },
    ],
  },
];
