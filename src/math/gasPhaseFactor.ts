// Pure gas-phase volumetric expansion utilities (zero React/Zustand imports).
// Fogler-style: ε = (total moles at Xa=1 - total moles at Xa=0) / total moles at Xa=0

/** Concentration of A at conversion Xa for gas-phase 1st-order: Ca = Ca0·(1-Xa)/(1+ε·Xa) */
export function gasPhaseConc(Ca0: number, Xa: number, epsilon: number): number {
  return Ca0 * (1 - Xa) / Math.max(1 + epsilon * Xa, 1e-9);
}

/**
 * Invert Ca = Ca0·(1-Xa)/(1+ε·Xa) → Xa = (Ca0-Ca)/(Ca0+ε·Ca)
 * Exact algebraic inversion, no iteration needed.
 */
export function gasPhaseXaFromCa(Ca: number, Ca0: number, epsilon: number): number {
  if (Math.abs(epsilon) < 1e-9) return Math.max(0, Math.min(0.9999, 1 - Ca / Math.max(Ca0, 1e-9)));
  return Math.max(0, Math.min(0.9999, (Ca0 - Ca) / Math.max(Ca0 + epsilon * Ca, 1e-9)));
}

/**
 * Gas-phase isothermal CSTR design equation for 1st-order A→R:
 *   Da·(1-Xa) = Xa·(1+ε·Xa)
 * → ε·Xa² + (1+Da)·Xa - Da = 0
 * Positive root of the quadratic. Degenerates to Da/(1+Da) when ε=0.
 */
export function cstrGasPhaseXa(Da: number, epsilon: number): number {
  if (Math.abs(epsilon) < 1e-9) return Da / Math.max(1 + Da, 1e-9);
  // quadratic: ε·Xa² + (1+Da)·Xa - Da = 0
  const b = 1 + Da;
  const discriminant = b * b + 4 * epsilon * Da;
  return Math.max(0, Math.min(0.9999, (-b + Math.sqrt(Math.max(0, discriminant))) / (2 * epsilon)));
}

/** dXa/dτ for gas-phase isothermal 1st-order PFR: k·(1-Xa)/(1+ε·Xa) */
export function pfrGasPhaseODE(Xa: number, k: number, epsilon: number): number {
  return k * (1 - Xa) / Math.max(1 + epsilon * Xa, 1e-9);
}
