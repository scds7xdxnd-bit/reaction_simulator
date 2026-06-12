import type { ProcessStream } from '../types/stream';
import { bisect } from './numerics';
import speciesLibraryRaw from '../data/speciesLibrary.json';

type AntoineEntry = { id: string; antoine?: { A: number; B: number; C: number } };
const speciesLib = speciesLibraryRaw as AntoineEntry[];

// Antoine: log₁₀(P_sat [mmHg]) = A - B/(C + T_°C), returns Pa
function pSatPa(A: number, B: number, C: number, T_K: number): number {
  return Math.pow(10, A - B / (C + T_K - 273.15)) * 133.322;
}

function rachfordRice(K: number[], z: number[], psi: number): number {
  return K.reduce((sum, ki, i) => sum + z[i] * (ki - 1) / (1 + psi * (ki - 1)), 0);
}

export interface FlashResult {
  vapor: ProcessStream;
  liquid: ProcessStream;
  psi: number;
  nonVolatile: string[];
}

export function flashModel(inlet: ProcessStream): FlashResult {
  const species = Object.keys(inlet.F);
  const F_total = Object.values(inlet.F).reduce((a, b) => a + b, 0);

  const emptyF = Object.fromEntries(species.map((s) => [s, 0]));
  if (F_total < 1e-12) {
    return {
      vapor:  { F: { ...emptyF }, T: inlet.T, P: inlet.P, vaporFraction: 1 },
      liquid: { F: { ...emptyF }, T: inlet.T, P: inlet.P, vaporFraction: 0 },
      psi: 0, nonVolatile: [],
    };
  }

  const antoineMap = new Map<string, { A: number; B: number; C: number }>();
  for (const entry of speciesLib) {
    if (entry.antoine) antoineMap.set(entry.id, entry.antoine);
  }

  const nonVolatile: string[] = [];
  const volatileSpecies: string[] = [];
  const z: number[] = [];
  const K: number[] = [];

  for (const sp of species) {
    const ant = antoineMap.get(sp);
    if (ant) {
      volatileSpecies.push(sp);
      z.push(inlet.F[sp]! / F_total);
      K.push(pSatPa(ant.A, ant.B, ant.C, inlet.T) / inlet.P);
    } else {
      nonVolatile.push(sp);
    }
  }

  let psi: number;
  if (volatileSpecies.length === 0) {
    psi = 0;
  } else {
    const f0 = rachfordRice(K, z, 0);
    if (f0 <= 0) {
      psi = 0;
    } else {
      const f1 = rachfordRice(K, z, 1);
      psi = f1 >= 0 ? 1 : bisect((pv) => rachfordRice(K, z, pv), 0, 1);
    }
  }

  const vaporF: Record<string, number> = {};
  const liquidF: Record<string, number> = {};

  for (let i = 0; i < volatileSpecies.length; i++) {
    const sp = volatileSpecies[i];
    const xi = (inlet.F[sp]! / F_total) / (1 + psi * (K[i] - 1));
    vaporF[sp]  = K[i] * xi * psi * F_total;
    liquidF[sp] = xi * (1 - psi) * F_total;
  }
  for (const sp of nonVolatile) {
    vaporF[sp]  = 0;
    liquidF[sp] = inlet.F[sp]!;
  }

  return {
    vapor:  { F: vaporF,  T: inlet.T, P: inlet.P, vaporFraction: 1 },
    liquid: { F: liquidF, T: inlet.T, P: inlet.P, vaporFraction: 0 },
    psi, nonVolatile,
  };
}

export interface PurgeResult {
  vent: ProcessStream;
  process: ProcessStream;
}

// Purge: β fraction to vent (top), (1-β) to process (bottom)
export function purgeModel(inlet: ProcessStream, beta: number): PurgeResult {
  const b = Math.max(0, Math.min(1, beta));
  const ventF: Record<string, number> = {};
  const procF: Record<string, number> = {};
  for (const [sp, f] of Object.entries(inlet.F)) {
    ventF[sp] = f * b;
    procF[sp] = f * (1 - b);
  }
  return {
    vent:    { F: ventF, T: inlet.T, P: inlet.P },
    process: { F: procF, T: inlet.T, P: inlet.P },
  };
}
