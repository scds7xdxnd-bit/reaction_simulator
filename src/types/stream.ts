import type { SpeciesId } from './chemistry';

export interface Stream {
  F: Record<SpeciesId, number>;
  T: number;
  P: number;
}

export interface AnnotatedStream extends Stream {
  streamLabel?: string;
  streamDesc?: string;
}

export function totalMolarFlow(s: Stream): number {
  return Object.values(s.F).reduce((sum, f) => sum + f, 0);
}

export function relativeVolumetricFlow(s: Stream, Ca0: number): number {
  return Ca0 > 1e-12 ? totalMolarFlow(s) / Ca0 : 1.0;
}

export function concentration(s: Stream, id: SpeciesId, Ca0: number): number {
  const vRel = relativeVolumetricFlow(s, Ca0);
  return vRel > 1e-12 ? (s.F[id] ?? 0) / vRel : 0;
}

export function conversion(s: Stream, feed: Stream, keyId: SpeciesId): number {
  const FA0 = feed.F[keyId] ?? 0;
  if (FA0 < 1e-12) return 0;
  return Math.max(0, Math.min(0.9999, 1 - (s.F[keyId] ?? 0) / FA0));
}
