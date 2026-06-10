/**
 * Pure equilibrium math — no framework imports.
 * Xa_eq = Keq / (1 + Keq) for A ⇌ R in a liquid-phase system.
 */
export function computeXeq(Keq: number): number {
  if (Keq <= 0) return 0;
  return Keq / (1 + Keq);
}

export function computeDeltaG(Keq: number, T: number): number {
  const R = 8.314;
  return -R * T * Math.log(Keq);
}
