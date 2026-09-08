// Unit tests for src/core/matrix.ts.
//
// Pure math, no ExtendScript dependencies. Covers all four exported
// helpers: degToRad, rotationToMatrix, multiplyMatrix3x3,
// applyMatrixToOffset.

import { describe, it, expect } from 'vitest';
import {
  degToRad,
  rotationToMatrix,
  multiplyMatrix3x3,
  applyMatrixToOffset,
} from './matrix';

describe('degToRad', () => {
  it('converts 0° to 0', () => {
    expect(degToRad(0)).toBe(0);
  });
  it('converts 180° to π', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
  });
  it('converts 360° to 2π', () => {
    expect(degToRad(360)).toBeCloseTo(2 * Math.PI);
  });
  it('converts negative angles', () => {
    expect(degToRad(-90)).toBeCloseTo(-Math.PI / 2);
  });
});

describe('rotationToMatrix', () => {
  it('identity rotation produces identity matrix', () => {
    const m = rotationToMatrix([0, 0, 0]);
    // Note: we use toBeCloseTo per element because Math.sin(0) is +0 while
    // -Math.sin(0) is -0 — they compare unequal under strict deep equality.
    expect(m[0][0]).toBeCloseTo(1);
    expect(m[0][1]).toBeCloseTo(0);
    expect(m[0][2]).toBeCloseTo(0);
    expect(m[1][0]).toBeCloseTo(0);
    expect(m[1][1]).toBeCloseTo(1);
    expect(m[1][2]).toBeCloseTo(0);
    expect(m[2][0]).toBeCloseTo(0);
    expect(m[2][1]).toBeCloseTo(0);
    expect(m[2][2]).toBeCloseTo(1);
  });

  it('90° around Z rotates X axis to Y axis', () => {
    const m = rotationToMatrix([0, 0, 90]);
    const v = applyMatrixToOffset(m, 1, 0, 0);
    expect(v[0]).toBeCloseTo(0);
    expect(v[1]).toBeCloseTo(1);
    expect(v[2]).toBeCloseTo(0);
  });

  it('90° around X rotates Y axis to Z axis', () => {
    const m = rotationToMatrix([90, 0, 0]);
    const v = applyMatrixToOffset(m, 0, 1, 0);
    expect(v[0]).toBeCloseTo(0);
    expect(v[1]).toBeCloseTo(0);
    expect(v[2]).toBeCloseTo(1);
  });

  it('returns the expected value for a known rotation', () => {
    const m = rotationToMatrix([0, 0, 0]);
    expect(m[0][0]).toBeCloseTo(1);
    expect(m[1][1]).toBeCloseTo(1);
    expect(m[2][2]).toBeCloseTo(1);
    expect(m[0][1]).toBeCloseTo(0);
    expect(m[1][0]).toBeCloseTo(0);
  });
});

describe('multiplyMatrix3x3', () => {
  it('identity × X = X', () => {
    const I = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ] as const;
    const x = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ] as const;
    const r = multiplyMatrix3x3(I, x);
    expect(r).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
  });

  it('X × identity = X', () => {
    const I = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ] as const;
    const x = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ] as const;
    const r = multiplyMatrix3x3(x, I);
    expect(r).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
  });

  it('zero × X = zero', () => {
    const Z = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ] as const;
    const x = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ] as const;
    const r = multiplyMatrix3x3(Z, x);
    expect(r).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  it('Z(90°) × X(90°) composes correctly', () => {
    // Rotate first by X then by Z. Expected: (1,0,0) → (1,0,0) under X,
    // then (1,0,0) → (0,1,0) under Z. So overall: (1,0,0) → (0,1,0).
    const mx = rotationToMatrix([90, 0, 0]);
    const mz = rotationToMatrix([0, 0, 90]);
    const composed = multiplyMatrix3x3(mz, mx);
    const v = applyMatrixToOffset(composed, 1, 0, 0);
    expect(v[0]).toBeCloseTo(0);
    expect(v[1]).toBeCloseTo(1);
    expect(v[2]).toBeCloseTo(0);
  });
});

describe('applyMatrixToOffset', () => {
  it('identity matrix passes through', () => {
    const I = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ] as const;
    expect(applyMatrixToOffset(I, 3, 4, 5)).toEqual([3, 4, 5]);
  });

  it('zero matrix produces zero offset', () => {
    const Z = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ] as const;
    expect(applyMatrixToOffset(Z, 100, 200, 300)).toEqual([0, 0, 0]);
  });
});
