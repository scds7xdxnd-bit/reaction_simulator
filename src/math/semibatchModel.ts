import { odeAdaptive, resampleUniform } from './numerics';
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

  const Na0 = params.Na0;
  const VIdx = speciesIds.length;
  const idxB = speciesIds.indexOf('B');

  const { tPoints, yPoints } = odeAdaptive(fn, 0, params.tau_batch, y0);
  const { t: tUnif, y: yUnif } = resampleUniform(tPoints, yPoints, 201);

  const profile: SemibatchProfilePoint[] = tUnif.map((t, idx) => {
    const yi = yUnif[idx];
    const V = Math.max(params.V0, yi[VIdx]);
    const NA = Math.max(0, yi[idxA >= 0 ? idxA : 0]);
    const NB = idxB >= 0 ? Math.max(0, yi[idxB]) : 0;
    return {
      t, Xa: Math.min(0.9999, Math.max(0, (Na0 - NA) / Math.max(Na0, 1e-12))),
      Ca: NA / V, Cb: NB / V, V,
    };
  });

  const yLast = yUnif[yUnif.length - 1];
  const finalV  = Math.max(params.V0, yLast[VIdx]);
  const finalNA = Math.max(0, yLast[idxA >= 0 ? idxA : 0]);
  const finalNR = idxR >= 0 ? Math.max(0, yLast[idxR]) : 0;
  const Xa_out  = Math.min(0.9999, Math.max(0, (Na0 - finalNA) / Math.max(Na0, 1e-12)));
  const consumed = Na0 - finalNA;
  const selectivity_R = consumed > 1e-9 ? Math.min(1, finalNR / consumed) : 0;

  return { Xa_out, selectivity_R, T_out: T_in, profile };
}
