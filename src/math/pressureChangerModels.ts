import type { ProcessStream } from '../types/stream';

const R_GAS = 8.314; // J/(mol·K)

export interface PumpResult {
  outlet: ProcessStream;
  W_shaft: number; // W (positive = work input to fluid)
}

// Pump (liquid): Ẇ = Q_vol · ΔP / η;  T and composition unchanged
export function pumpModel(
  inlet: ProcessStream,
  params: { P_out: number; eta: number; Q_vol: number },
): PumpResult {
  const { P_out, eta, Q_vol } = params;
  const W_shaft = Q_vol * Math.max(0, P_out - inlet.P) / Math.max(eta, 1e-6);
  return {
    outlet: { F: { ...inlet.F }, T: inlet.T, P: P_out },
    W_shaft,
  };
}

export interface CompResult {
  outlet: ProcessStream;
  W_shaft: number; // W
}

// Compressor (gas): isentropic work + real T₂ from isentropic efficiency
export function compModel(
  inlet: ProcessStream,
  params: { P_out: number; eta: number; gamma: number },
): CompResult {
  const { P_out, eta, gamma } = params;
  const ratio = P_out / Math.max(inlet.P, 1);
  const exponent = (gamma - 1) / gamma;
  const ratioExp = Math.pow(ratio, exponent);
  const N_total = Object.values(inlet.F).reduce((a, b) => a + b, 0);

  const T_out = inlet.T * (1 + (ratioExp - 1) / Math.max(eta, 1e-6));
  const W_shaft = (gamma * R_GAS * inlet.T / (gamma - 1)) * N_total * (ratioExp - 1) / Math.max(eta, 1e-6);

  return {
    outlet: { F: { ...inlet.F }, T: T_out, P: P_out },
    W_shaft: Math.max(0, W_shaft),
  };
}

export interface ValveResult {
  outlet: ProcessStream;
  W_shaft: 0;
}

// Valve: isenthalpic, ideal-gas → T unchanged;  P_out < P_in
export function valveModel(
  inlet: ProcessStream,
  params: { P_out: number },
): ValveResult {
  return {
    outlet: { F: { ...inlet.F }, T: inlet.T, P: params.P_out },
    W_shaft: 0,
  };
}
