import { describe, it, expect } from 'vitest';
import { solveNetwork } from '../networkSolver';
import { EXAMPLES } from '../../io/examples';

describe('solveNetwork — golden examples', () => {
  it('single-cstr: first-order isothermal, Xa = 0.5', () => {
    const { nodes, edges, params } = EXAMPLES[0].state;
    const result = solveNetwork(nodes, edges, params);

    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    expect(result!.iterations).toBe(1);
    expect(Math.abs(result!.finalConversion - 0.5)).toBeLessThan(1e-4);

    expect(result!.segments).toHaveLength(1);
    expect(result!.segments[0].reactorId).toBe('cstr-2');
    expect(Math.abs(result!.segments[0].Xa_out - 0.5)).toBeLessThan(1e-4);
    expect(Math.abs(result!.segments[0].Ca_out - 0.5)).toBeLessThan(1e-4);
    expect(result!.segments[0].T_out).toBe(300);
  });

  it('two-cstr-series: staging increases conversion to ~0.609', () => {
    const { nodes, edges, params } = EXAMPLES[1].state;
    const result = solveNetwork(nodes, edges, params);

    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    expect(result!.iterations).toBe(1);
    expect(Math.abs(result!.finalConversion - 0.609375)).toBeLessThan(1e-4);

    expect(result!.segments).toHaveLength(2);
    expect(result!.segments[0].reactorId).toBe('cstr-2');
    expect(Math.abs(result!.segments[0].Xa_out - 0.375)).toBeLessThan(1e-4);
    expect(result!.segments[1].reactorId).toBe('cstr-3');
    expect(Math.abs(result!.segments[1].Xa_out - 0.609375)).toBeLessThan(1e-4);
  });

  it('cstr-pfr: second-order hybrid, Xa ~ 0.680', () => {
    const { nodes, edges, params } = EXAMPLES[2].state;
    const result = solveNetwork(nodes, edges, params);

    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    expect(result!.iterations).toBe(1);
    expect(Math.abs(result!.finalConversion - 0.6799)).toBeLessThan(5e-3);

    expect(result!.segments).toHaveLength(2);
    expect(result!.segments[0].reactorId).toBe('cstr-2');
    expect(Math.abs(result!.segments[0].Xa_out - 0.3441)).toBeLessThan(5e-3);
    expect(result!.segments[1].reactorId).toBe('pfr-2');
    expect(Math.abs(result!.segments[1].Xa_out - 0.6799)).toBeLessThan(5e-3);
    expect(result!.segments[0].Xa_out).toBeLessThan(result!.segments[1].Xa_out);
  });
});
