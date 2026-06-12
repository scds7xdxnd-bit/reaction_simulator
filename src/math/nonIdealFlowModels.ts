/**
 * F19 — Non-Ideal Flow & Catalyst Effects (pure math, zero React/Zustand imports)
 *
 * F19.1  axialDispersionConversion — analytical Danckwerts-BC formula (1st order, isothermal)
 * F19.2  segregationConversion     — macro-mixing upper bound via numerical quadrature
 * F19.3  thieleModulus, effectivenessFactor, mearsCriterion, catalystActivity
 */

// ─── F19.1: Axial dispersion model ──────────────────────────────────────────

/**
 * Conversion in an isothermal PFR with axial dispersion, 1st-order A→R,
 * Danckwerts inlet/outlet boundary conditions.
 *
 * Analytical solution (Levenspiel "Chemical Reaction Engineering", eqn 13.18):
 *   X = 1 − 4α·exp(Pe/2) / [(1+α)²·exp(αPe/2) − (1−α)²·exp(−αPe/2)]
 *   α = √(1 + 4·Da/Pe)
 *
 * Limits:
 *   Pe → ∞  →  X = 1 − exp(−Da)  (plug-flow PFR)
 *   Pe → 0   →  X ≈ Da/(1+Da)     (CSTR)
 *
 * @param Da  Damköhler number = k·τ  [dimensionless]
 * @param Pe  Péclet number = u·L/D_ax  [dimensionless]; use ≥1000 for near-plug-flow
 */
export function axialDispersionConversion(Da: number, Pe: number): number {
  if (!isFinite(Pe) || Pe >= 1e4) return 1 - Math.exp(-Da);      // plug-flow limit
  if (Pe <= 0)                     return Da / (1 + Da);          // CSTR limit

  const alpha   = Math.sqrt(1 + 4 * Da / Pe);
  const peHalf  = Pe / 2;
  const aPeHalf = alpha * peHalf;

  // Guard against huge exponents (numerical overflow for large Pe/alpha):
  if (aPeHalf > 700) return 1 - Math.exp(-Da);

  const ep   = Math.exp(peHalf);
  const eap  = Math.exp(aPeHalf);
  const enam = Math.exp(-aPeHalf);

  const num   = 4 * alpha * ep;
  const denom = (1 + alpha) ** 2 * eap - (1 - alpha) ** 2 * enam;

  if (Math.abs(denom) < 1e-30) return 1 - Math.exp(-Da);
  return Math.max(0, Math.min(0.9999, 1 - num / denom));
}

// ─── F19.2: Segregation model ────────────────────────────────────────────────

/**
 * Macro-mixing (maximum-segregation) conversion for any kinetics.
 *
 *   X̄ = ∫₀^∞  X_batch(t) · E_CSTR(t)  dt
 *   X_batch(t) = 1 − exp(−k·t)     for 1st-order (general case: user supplies X_batch_fn)
 *   E_CSTR(t)  = (1/τ) · exp(−t/τ)
 *
 * Numerically integrated up to 10·τ (captures >99.995 % of the distribution).
 *
 * For first-order kinetics, the result equals X_CSTR = Da/(1+Da) exactly —
 * segregation invariance for linear kinetics.  For higher-order kinetics the
 * result is LOWER than CSTR conversion (molecules react in isolation, missing
 * the benefit of the well-mixed high-Ca environment).
 *
 * @param X_batch_fn  Batch conversion as a function of time t [s]
 * @param tau         Mean residence time [s]
 * @param n_pts       Number of quadrature points (default 1000)
 */
export function segregationConversion(
  X_batch_fn: (t: number) => number,
  tau: number,
  n_pts = 1000,
): number {
  const t_max = 10 * Math.max(tau, 1e-9);
  const dt = t_max / n_pts;
  let sum = 0;
  for (let i = 0; i < n_pts; i++) {
    const t = (i + 0.5) * dt;          // midpoint quadrature
    const E = Math.exp(-t / tau) / tau; // E_CSTR(t)
    sum += X_batch_fn(t) * E * dt;
  }
  return Math.max(0, Math.min(0.9999, sum));
}

// ─── F19.3: Effectiveness factor & deactivation ──────────────────────────────

/**
 * Thiele modulus for a spherical catalyst pellet with 1st-order reaction.
 *
 *   φ = R_p · √(k_mass · ρ_cat / D_e)
 *
 * @param R_p      Pellet radius [m]
 * @param k_mass   Intrinsic rate constant per unit catalyst mass [m³/(kg·s)]
 * @param rho_cat  Particle density [kg/m³]
 * @param D_e      Effective intraparticle diffusivity [m²/s]
 */
export function thieleModulus(
  R_p: number,
  k_mass: number,
  rho_cat: number,
  D_e: number,
): number {
  const k_vol = Math.max(k_mass, 0) * Math.max(rho_cat, 0); // [1/s]
  return R_p * Math.sqrt(k_vol / Math.max(D_e, 1e-30));
}

/**
 * Internal effectiveness factor η ∈ (0, 1] for a sphere with 1st-order kinetics.
 *
 *   η = (3/φ²) · (φ · coth φ − 1)
 *
 * Limits:  φ → 0 → η = 1 (kinetics-limited)
 *          φ → ∞ → η ≈ 3/φ (diffusion-limited)
 */
export function effectivenessFactor(phi: number): number {
  if (phi < 1e-6)  return 1;
  if (phi > 1000)  return 3 / phi;           // diffusion-limited asymptote
  const cothPhi = 1 / Math.tanh(phi) ;        // coth(φ)
  return (3 / (phi * phi)) * (phi * cothPhi - 1);
}

export interface MearsCriterionResult {
  value: number;  // dimensionless criterion: r·ρ_b·R_p·n / (k_c·C_Ab)
  pass: boolean;  // true if < 0.15 (external film resistance negligible)
}

/**
 * Mears criterion: checks whether external mass-transfer resistance is negligible.
 *
 *   M = r · ρ_b · R_p · n / (k_c · C_Ab)  <  0.15  → negligible
 *
 * @param r     Observed reaction rate [mol/(kg_cat·s)]
 * @param rho_b Bulk bed density [kg/m³]
 * @param R_p   Pellet radius [m]
 * @param n     Reaction order [-]
 * @param k_c   External mass-transfer coefficient [m/s]
 * @param C_Ab  Bulk concentration of limiting reactant A [mol/m³]
 */
export function mearsCriterion(
  r: number,
  rho_b: number,
  R_p: number,
  n: number,
  k_c: number,
  C_Ab: number,
): MearsCriterionResult {
  const denom = Math.max(k_c, 1e-30) * Math.max(C_Ab, 1e-30);
  const value = (r * rho_b * R_p * n) / denom;
  return { value, pass: value < 0.15 };
}

/**
 * Catalyst deactivation: returns activity a(t) ∈ [0, 1].
 *
 *   da/dt = −k_d · aᵈ
 *   d = 1 → a(t) = exp(−k_d · t)          (1st-order, most common)
 *   d ≠ 1 → a(t) = [1 − (d−1)·k_d·t]^(1/(1−d))  (general power-law)
 *
 * @param t   Catalyst age [s]
 * @param k_d Deactivation rate constant [1/s]
 * @param d   Deactivation order (default 1)
 */
export function catalystActivity(t: number, k_d: number, d = 1): number {
  if (t <= 0 || k_d <= 0) return 1;
  if (Math.abs(d - 1) < 1e-6) return Math.exp(-k_d * t);
  const base = 1 - (d - 1) * k_d * t;
  if (base <= 0) return 0;
  return Math.max(0, Math.pow(base, 1 / (1 - d)));
}
