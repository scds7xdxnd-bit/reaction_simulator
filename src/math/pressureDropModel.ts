// pure Liquid-phase Ergun model with τ = z/u0 as independent variable

export interface PressureDropConfig {
  Dp: number;   // particle diameter [m]
  phi: number;  // porosity [-]
  P0: number;   // inlet pressure [Pa]
  u0: number;   // superficial velocity [m/s]
}

const MU_LIQUID = 8.9e-4;  // dynamic viscosity [Pa·s]
const RHO_LIQUID = 1000.0; // density [kg/m³]

/** Returns dP/dτ [Pa/s] — negative (pressure drops along reactor) */
export function ergunDpDtau(cfg: PressureDropConfig): number {
  const { Dp, phi, u0 } = cfg;
  const G = RHO_LIQUID * u0;
  const beta0 =
    (G * (1 - phi)) / (RHO_LIQUID * Dp * phi ** 3) *
    (150 * (1 - phi) * MU_LIQUID / Dp + 1.75 * G);
  return -beta0 * u0;
}

/** Total ΔP [Pa] across reactor of residence time tau_total [s] */
export function ergunTotalDeltaP(cfg: PressureDropConfig, tau_total: number): number {
  return ergunDpDtau(cfg) * tau_total;
}
