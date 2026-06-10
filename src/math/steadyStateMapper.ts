// Pure steady-state multiplicity classifier (zero React/Zustand imports).

export type SteadyStateLabel = 'extinction' | 'unstable' | 'ignition' | 'unique';

export interface ClassifiedSteadyState {
  T: number;
  Xa: number;
  stable: boolean;
  label: SteadyStateLabel;
}

export interface MultiplicityResult {
  count: 1 | 3;
  states: ClassifiedSteadyState[];
  hasMultiplicity: boolean;
}

/**
 * Classify raw steady states from buildOperatingDiagram.
 *
 * For a non-isothermal cooled CSTR, G(T) and R(T) can intersect at 1 or 3 points.
 * When 3 intersections exist (sorted by ascending T):
 *   [0] lowest T, stable  → extinction state
 *   [1] middle T, unstable → unstable state (physically unattainable)
 *   [2] highest T, stable  → ignition state
 *
 * Any count other than 3 is treated as a unique steady state (use the stable one).
 */
export function classifySteadyStates(
  rawStates: { T: number; Xa: number; stable: boolean }[]
): MultiplicityResult {
  const sorted = [...rawStates].sort((a, b) => a.T - b.T);

  if (sorted.length >= 3) {
    const states: ClassifiedSteadyState[] = [
      { ...sorted[0]!, label: 'extinction' },
      { ...sorted[1]!, label: 'unstable' },
      { ...sorted[2]!, label: 'ignition' },
    ];
    return { count: 3, states, hasMultiplicity: true };
  }

  const best = sorted.find((s) => s.stable) ?? sorted[0];
  if (!best) return { count: 1, states: [], hasMultiplicity: false };

  return {
    count: 1,
    states: [{ ...best, label: 'unique' }],
    hasMultiplicity: false,
  };
}

/** Display colour for each label */
export function steadyStateColor(label: SteadyStateLabel): string {
  switch (label) {
    case 'extinction': return '#2563eb';
    case 'unstable':   return '#dc2626';
    case 'ignition':   return '#d97706';
    case 'unique':     return '#16a34a';
  }
}
