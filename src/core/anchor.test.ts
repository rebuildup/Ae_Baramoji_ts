// Unit tests for src/core/anchor.ts.
//
// adjustAnchorPoint depends on AE's TransformGroup / Position /
// AnchorPoint / Scale / RotateZ properties, plus sourceRectAtTime.
// We stub these out for the test (no ExtendScript runtime available).

import { describe, it, expect, vi } from 'vitest';
import { adjustAnchorPoint } from './anchor';
import { ADBE } from './constants';

// ---------- stub layer ------------------------------------------------

interface StubProp {
  numKeys: number;
  value: any;
  setValue: ReturnType<typeof vi.fn>;
  dimensionsSeparated: boolean;
}

function makeProp(value: any, opts: { numKeys?: number; dimensionsSeparated?: boolean } = {}): StubProp {
  return {
    numKeys: opts.numKeys ?? 0,
    value,
    setValue: vi.fn(),
    dimensionsSeparated: opts.dimensionsSeparated ?? false,
  };
}

interface StubTransformGroup {
  Position: StubProp;
  Position_0: StubProp;
  Position_1: StubProp;
  AnchorPoint: StubProp;
  RotateZ: StubProp;
  Scale: StubProp;
  property: (name: string) => StubProp | null;
}

interface StubLayer {
  sourceRect: { left: number; top: number; width: number; height: number };
  transformGroup: StubTransformGroup;
  property: (name: string) => StubTransformGroup | null;
}

function makeLayer(rect = { left: 0, top: 0, width: 100, height: 50 }): StubLayer {
  const transformGroup: StubTransformGroup = {
    Position: makeProp([10, 20]),
    Position_0: makeProp(10),
    Position_1: makeProp(20),
    AnchorPoint: makeProp([5, 5]),
    RotateZ: makeProp(0),
    Scale: makeProp([100, 100]),
    property(name: string): StubProp | null {
      const map: Record<string, StubProp> = {
        [ADBE.Position]: transformGroup.Position,
        [ADBE.Position_0]: transformGroup.Position_0,
        [ADBE.Position_1]: transformGroup.Position_1,
        [ADBE.AnchorPoint]: transformGroup.AnchorPoint,
        [ADBE.RotateZ]: transformGroup.RotateZ,
        [ADBE.Scale]: transformGroup.Scale,
      };
      return map[name] ?? null;
    },
  };

  return {
    sourceRect: rect,
    transformGroup,
    property(name: string): StubTransformGroup | null {
      return name === ADBE.TransformGroup ? transformGroup : null;
    },
  };
}

// Map stub onto a partial Layer shape that adjustAnchorPoint uses.
function toLayer(stub: StubLayer): Layer {
  return {
    property: ((name: string) => {
      if (name === ADBE.TransformGroup) return stub.transformGroup;
      return null;
    }) as any,
    sourceRectAtTime: () => stub.sourceRect,
  } as unknown as Layer;
}

// ---------- tests -----------------------------------------------------

describe('adjustAnchorPoint', () => {
  it('returns early when transform group is missing', () => {
    const stub = makeLayer();
    (stub as any).property = () => null;
    expect(() => adjustAnchorPoint(toLayer(stub), 0)).not.toThrow();
  });

  it('returns early when any of the position / anchor properties has keyframes', () => {
    const stub = makeLayer();
    stub.transformGroup.Position.numKeys = 1; // animated
    adjustAnchorPoint(toLayer(stub), 0);
    expect(stub.transformGroup.AnchorPoint.setValue).not.toHaveBeenCalled();
  });

  it('writes the visual center to the transform anchor (pet=0)', () => {
    // Rect is { left: 0, top: 0, width: 100, height: 50 }
    // Visual centre: (50, 25)
    const stub = makeLayer();
    adjustAnchorPoint(toLayer(stub), 0);
    expect(stub.transformGroup.AnchorPoint.setValue).toHaveBeenCalledWith([50, 25, 0]);
  });

  it('writes a 2-element centre when calling with pet=0 default behaviour', () => {
    const stub = makeLayer({ left: 10, top: 20, width: 100, height: 50 });
    // Visual centre: (10 + 100/2, 20 + 50/2) = (60, 45)
    adjustAnchorPoint(toLayer(stub), 0);
    expect(stub.transformGroup.AnchorPoint.setValue).toHaveBeenCalledWith([60, 45, 0]);
  });

  it('updates the position by the inverse translation', () => {
    // Rect centred on (50, 25), original anchor (5, 5), original position (10, 20)
    // DX = (50 - 5) * 0.01 * 100 = 45
    // DY = (25 - 5) * 0.01 * 100 = 20
    // Rotation = 0
    // newX = 10 + 45 * 1 - 20 * 0 = 55
    // newY = 20 + 45 * 0 + 20 * 1 = 40
    const stub = makeLayer();
    adjustAnchorPoint(toLayer(stub), 0);
    expect(stub.transformGroup.Position.setValue).toHaveBeenCalledWith([55, 40, 0]);
  });

  it('respects scale when computing the offset', () => {
    // Same as above but scale = 50, 50
    // DX = (50 - 5) * 0.01 * 50 = 22.5
    // DY = (25 - 5) * 0.01 * 50 = 10
    // newX = 10 + 22.5 = 32.5, newY = 20 + 10 = 30
    const stub = makeLayer();
    stub.transformGroup.Scale.value = [50, 50];
    adjustAnchorPoint(toLayer(stub), 0);
    expect(stub.transformGroup.Position.setValue).toHaveBeenCalledWith([32.5, 30, 0]);
  });

  it('uses Position_0 / Position_1 when dimensionsSeparated', () => {
    const stub = makeLayer();
    stub.transformGroup.Position.dimensionsSeparated = true;
    stub.transformGroup.Position_0.value = 100;
    stub.transformGroup.Position_1.value = 200;
    adjustAnchorPoint(toLayer(stub), 0);
    expect(stub.transformGroup.Position_0.setValue).toHaveBeenCalled();
    expect(stub.transformGroup.Position_1.setValue).toHaveBeenCalled();
  });
});
