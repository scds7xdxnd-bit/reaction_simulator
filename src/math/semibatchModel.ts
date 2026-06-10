import { rk4Step } from './numerics';
import type { ChemistryModel, SpeciesId } from '../types/chemistry';

export interface SemibatchParams {
  tau_batch: number;   // total batch time (s)
  FB0: number;         // B feed rate (mol/s)
  CB_feed: number;     // B feed concentration (mol/L)
  Na0: number;         // initial moles of A
  V0: number;          // initial volume (L)
}

export interface SemibatchProfilePoint {
  t: number;
  Xa: number;
  Ca: number;
  Cb: number;
  V: number;
}

export interface SemibatchResult {
  Xa_out: number;
  selectivity_R: number;
  T_out: number;
  profile: SemibatchProfilePoint[];
}

export function semibatchSolve(
  params: SemibatchParams,
  chemistry: ChemistryModel,
  T_in: number,
): SemibatchResult {
  const { reactions, species } = chemistry;
  const speciesIds = species.map((s) => s.id);
  const nSteps = 200;
  const h = params.tau_batch / nSteps;
  const Q_in = params.FB0 / Math.max(params.CB_feed, 1e-12);

  // State: [NA, NB, NR, NS, V]  (moles of each species + volume)
  const idxA = speciesIds.indexOf('A');
  const idxR = speciesIds.indexOf('R');
  const idxS = speciesIds.indexOf('S');

  const y0: number[] = speciesIds.map((id) => {
    if (id === 'A') return params.Na0;
    return 0;
  });
  y0.push(params.V0); // V at index speciesIds.length

  const fn = (_t: number, y: number[]): number[] => {
    const V = Math.max(y[speciesIds.length], 1e-9);
    const C: Record<SpeciesId, number> = {};
    for (let i = 0; i < speciesIds.length; i++) {
      C[speciesIds[i]] = Math.max(y[i], 0) / V;
    }
    // B is fed continuously — add to CB from exterior
    C['B'] = C['B'] ?? 0;

    const dN: number[] = new Array(speciesIds.length).fill(0);
    for (const rxn of reactions) {
      const r = rxn.rateLaw(C, T_in, rxn.kineticParams);
      for (let i = 0; i < speciesIds.length; i++) {
        const id = speciesIds[i];
        const stoich = rxn.stoichiometry[id] ?? 0;
        dN[i] += stoich * r * V;
      }
    }

    // B fed from outside: dNB/dt += FB0
    const bIdx = speciesIds.indexOf('B');
    if (bIdx >= 0) dN[bIdx] += params.FB0;

    // dV/dt = Q_in (volumetric addition)
    const dV = Q_in;
    return [...dN, dV];
  };

  const profile: SemibatchProfilePoint[] = [];
  const Na0 = params.Na0;

  let y = [...y0];
  profile.push({ t: 0, Xa: 0, Ca: Na0 / Math.max(params.V0, 1e-9), Cb: 0, V: params.V0 });

  for (let i = 0; i < nSteps; i++) {
    y = rk4Step(fn, i * h, y, h);
    for (let j = 0; j < speciesIds.length; j++) y[j] = Math.max(0, y[j]);
    y[speciesIds.length] = Math.max(params.V0, y[speciesIds.length]);

    const V = y[speciesIds.length];
    const NA = y[idxA >= 0 ? idxA : 0];
    const NB = idxR >= 0 ? y[speciesIds.indexOf('B')] : 0;
    const Xa = Math.min(0.9999, Math.max(0, (Na0 - NA) / Math.max(Na0, 1e-12)));
    profile.push({
      t: (i + 1) * h,
      Xa,
      Ca: NA / V,
      Cb: Math.max(0, NB) / V,
      V,
    });
  }

  const finalV = y[speciesIds.length];
  const finalNA = y[idxA >= 0 ? idxA : 0];
  const finalNR = idxR >= 0 ? y[idxR] : 0;
  const Xa_out = Math.min(0.9999, Math.max(0, (Na0 - finalNA) / Math.max(Na0, 1e-12)));
  const consumed = Na0 - finalNA;
  const selectivity_R = consumed > 1e-9 ? Math.min(1, finalNR / consumed) : 0;

  return { Xa_out, selectivity_R, T_out: T_in, profile };
}
