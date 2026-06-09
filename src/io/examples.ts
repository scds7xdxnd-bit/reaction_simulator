import type { SavedState } from './serializer';

export interface Example {
  id: string;
  name: string;
  description: string;
  state: SavedState;
}

export const EXAMPLES: Example[] = [
  {
    id: 'single-cstr',
    name: 'Single CSTR',
    description: '1st-order, isothermal \u00b7 Feed \u2192 CSTR \u2192 Product',
    state: {
      version: 1,
      nodes: [
        {
          id: 'feed',
          type: 'feed',
          position: { x: 100, y: 200 },
          data: { label: 'Feed' },
        },
        {
          id: 'cstr-2',
          type: 'cstr',
          position: { x: 300, y: 200 },
          data: {
            reactorType: 'CSTR',
            label: 'CSTR-2',
            tau: 2.0,
            thermalMode: 'isothermal',
            Tc: 300,
            kappa_v: 0.5,
            ic_Ca: 1.0,
            ic_T: 300,
          },
        },
        {
          id: 'product',
          type: 'product',
          position: { x: 520, y: 200 },
          data: { label: 'Product' },
        },
      ],
      edges: [
        { id: 'e-feed-cstr2', source: 'feed', target: 'cstr-2' },
        { id: 'e-cstr2-product', source: 'cstr-2', target: 'product' },
      ],
      params: {
        reactionMode: 'single',
        kinetics: 'first-order',
        k: 0.5,
        k2: 0.3,
        Keq_ref: 4.0,
        Ca0: 1.0,
        Cr0_fraction: 0.01,
        T_ref: 300,
        Ea: 0,
        delta_H: -50,
        rho_Cp: 4.18,
        T_feed: 300,
      },
      mode: 'steady-state',
    },
  },
  {
    id: 'two-cstr-series',
    name: 'Two CSTRs in Series',
    description: '1st-order, isothermal \u00b7 higher conversion through staging',
    state: {
      version: 1,
      nodes: [
        {
          id: 'feed',
          type: 'feed',
          position: { x: 100, y: 200 },
          data: { label: 'Feed' },
        },
        {
          id: 'cstr-2',
          type: 'cstr',
          position: { x: 300, y: 200 },
          data: {
            reactorType: 'CSTR',
            label: 'CSTR-2',
            tau: 2.0,
            thermalMode: 'isothermal',
            Tc: 300,
            kappa_v: 0.5,
            ic_Ca: 1.0,
            ic_T: 300,
          },
        },
        {
          id: 'cstr-3',
          type: 'cstr',
          position: { x: 500, y: 200 },
          data: {
            reactorType: 'CSTR',
            label: 'CSTR-3',
            tau: 2.0,
            thermalMode: 'isothermal',
            Tc: 300,
            kappa_v: 0.5,
            ic_Ca: 1.0,
            ic_T: 300,
          },
        },
        {
          id: 'product',
          type: 'product',
          position: { x: 720, y: 200 },
          data: { label: 'Product' },
        },
      ],
      edges: [
        { id: 'e-feed-cstr2', source: 'feed', target: 'cstr-2' },
        { id: 'e-cstr2-cstr3', source: 'cstr-2', target: 'cstr-3' },
        { id: 'e-cstr3-product', source: 'cstr-3', target: 'product' },
      ],
      params: {
        reactionMode: 'single',
        kinetics: 'first-order',
        k: 0.3,
        k2: 0.3,
        Keq_ref: 4.0,
        Ca0: 1.0,
        Cr0_fraction: 0.01,
        T_ref: 300,
        Ea: 0,
        delta_H: -50,
        rho_Cp: 4.18,
        T_feed: 300,
      },
      mode: 'steady-state',
    },
  },
  {
    id: 'cstr-pfr',
    name: 'CSTR + PFR',
    description: '2nd-order, isothermal \u00b7 hybrid design',
    state: {
      version: 1,
      nodes: [
        {
          id: 'feed',
          type: 'feed',
          position: { x: 100, y: 200 },
          data: { label: 'Feed' },
        },
        {
          id: 'cstr-2',
          type: 'cstr',
          position: { x: 300, y: 200 },
          data: {
            reactorType: 'CSTR',
            label: 'CSTR-2',
            tau: 2.0,
            thermalMode: 'isothermal',
            Tc: 300,
            kappa_v: 0.5,
            ic_Ca: 1.0,
            ic_T: 300,
          },
        },
        {
          id: 'pfr-2',
          type: 'pfr',
          position: { x: 520, y: 200 },
          data: {
            reactorType: 'PFR',
            label: 'PFR-2',
            tau: 4.0,
            thermalMode: 'isothermal',
            Tc: 300,
            kappa_v: 0.5,
            ic_Ca: 1.0,
            ic_T: 300,
          },
        },
        {
          id: 'product',
          type: 'product',
          position: { x: 740, y: 200 },
          data: { label: 'Product' },
        },
      ],
      edges: [
        { id: 'e-feed-cstr2', source: 'feed', target: 'cstr-2' },
        { id: 'e-cstr2-pfr2', source: 'cstr-2', target: 'pfr-2' },
        { id: 'e-pfr2-product', source: 'pfr-2', target: 'product' },
      ],
      params: {
        reactionMode: 'single',
        kinetics: 'second-order',
        k: 0.4,
        k2: 0.3,
        Keq_ref: 4.0,
        Ca0: 1.0,
        Cr0_fraction: 0.01,
        T_ref: 300,
        Ea: 0,
        delta_H: -50,
        rho_Cp: 4.18,
        T_feed: 300,
      },
      mode: 'steady-state',
    },
  },
];
