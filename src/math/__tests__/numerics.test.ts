import { describe, it, expect } from 'vitest';
import { brent } from '../numerics';

describe('brent', () => {
  it('finds √2 in [1, 2]', () => {
    const { root, converged } = brent((x) => x * x - 2, 1, 2);
    expect(converged).toBe(true);
    expect(root).toBeCloseTo(Math.SQRT2, 8);
  });

  it('finds π as root of sin on [3, 4]', () => {
    const { root, converged } = brent(Math.sin, 3, 4);
    expect(converged).toBe(true);
    expect(root).toBeCloseTo(Math.PI, 8);
  });

  it('finds root of cubic x³ - x - 2 in [1, 2]', () => {
    const { root, converged } = brent((x) => x * x * x - x - 2, 1, 2);
    expect(converged).toBe(true);
    expect(root).toBeCloseTo(1.5213797, 5);
  });

  it('converged: false when no bracket (f always positive)', () => {
    const { converged } = brent((x) => x * x + 1, -2, 2);
    expect(converged).toBe(false);
  });

  it('handles f(lo) = 0 immediately', () => {
    const { root, converged } = brent((x) => x - 1, 1, 5);
    expect(converged).toBe(true);
    expect(root).toBeCloseTo(1, 8);
  });

  it('antisymmetric: brent on [-1, 1] for f(x)=x finds root ≈ 0', () => {
    const { root, converged } = brent((x) => x, -1, 1);
    expect(converged).toBe(true);
    expect(Math.abs(root)).toBeLessThan(1e-7);
  });
});
