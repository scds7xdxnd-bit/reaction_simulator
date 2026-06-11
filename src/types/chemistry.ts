export type SpeciesId = string;

export interface SpeciesLibraryEntry {
  id: string;
  name: string;
  formula: string;
  mw: number;
  phase: 'g' | 'l' | 's';
  dHf298: number;
  S298: number;
  Cp: { A: number; B: number; C: number; D: number; E: number };
  antoine?: { A: number; B: number; C: number };
  rhoLiq?: number;
  Tc?: number;
  Pc?: number;
}

export interface Species {
  id: SpeciesId;
  label: string;
}

export type RateLawFn = (
  C: Readonly<Record<SpeciesId, number>>,
  T: number,
  kParams: Readonly<Record<string, number>>
) => number;

export interface Reaction {
  id: string;
  label: string;
  stoichiometry: Record<SpeciesId, number>;
  rateLaw: RateLawFn;
  kineticParams: Record<string, number>;
}

export type ReactionSet = Reaction[];

export interface ThermoModel {
  deltaH(reactionId: string, T: number): number;
  rhoCp(C: Readonly<Record<SpeciesId, number>>, T: number): number;
}

export interface ChemistryModel {
  species: Species[];
  reactions: ReactionSet;
  thermo: ThermoModel;
  keyReactantId: SpeciesId;
  initialConcentrations?: Record<SpeciesId, number>;
}
