import type { Stream, AnnotatedStream } from '../types/stream';

export interface StreamState {
  Xa: number;
  Ca: number;
  Cr: number;
  Cs: number;
  flow: number;
  T: number;
  speciesLabel?: string; // primary reactant key in F (default 'A')
}

const BYPRODUCT_KEYS = new Set(['R', 'S', 'T', 'U']);

export function streamToState(s: Stream, Ca0: number): StreamState {
  const primary = 'A' in s.F ? 'A' : (Object.keys(s.F).find(k => !BYPRODUCT_KEYS.has(k)) ?? 'A');
  const FA = s.F[primary] ?? 0;
  const FR = s.F['R'] ?? 0;
  const FS = s.F['S'] ?? 0;
  const totalF = FA + FR + FS;
  const flow = Ca0 > 1e-12 ? totalF / Ca0 : 1.0;
  const Ca   = flow > 1e-12 ? FA / flow : 0;
  const Cr   = flow > 1e-12 ? FR / flow : 0;
  const Cs   = flow > 1e-12 ? FS / flow : 0;
  const Xa   = Ca0 > 1e-12 ? Math.max(0, Math.min(0.9999, 1 - Ca / Ca0)) : 0;
  return { Xa, Ca, Cr, Cs, flow, T: s.T, speciesLabel: primary === 'A' ? undefined : primary };
}

export function stateToStream(s: StreamState): Stream {
  const primary = s.speciesLabel ?? 'A';
  return {
    F: {
      [primary]: Math.max(0, s.Ca * s.flow),
      'R': Math.max(0, s.Cr * s.flow),
      'S': Math.max(0, s.Cs * s.flow),
    },
    T: s.T,
    P: 101325,
  };
}

export function makeFeedStream(Ca0: number, T_feed: number): Stream {
  return {
    F: { 'A': Ca0, 'R': 0, 'S': 0 },
    T: T_feed,
    P: 101325,
  };
}

export function annotateStream(
  s: Stream,
  label?: string,
  desc?: string
): AnnotatedStream {
  return { ...s, streamLabel: label, streamDesc: desc };
}

export function _debugRoundTrip(s: Stream, Ca0: number): boolean {
  const rt = stateToStream(streamToState(s, Ca0));
  return (
    Math.abs((rt.F['A'] ?? 0) - (s.F['A'] ?? 0)) < 1e-9 &&
    Math.abs((rt.F['R'] ?? 0) - (s.F['R'] ?? 0)) < 1e-9 &&
    Math.abs(rt.T - s.T) < 1e-9
  );
}
