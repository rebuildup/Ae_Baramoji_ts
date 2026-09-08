// Unit tests for src/core/properties.ts.
//
// The module is parameterised by AE's `Layer` global, which doesn't exist
// outside ExtendScript. We build a small in-test stub layer that exposes
// only the surface the helpers under test actually touch.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  captureBasicProperties,
  applyBasicProperties,
  setPosition,
  hasDeepGlow,
} from './properties';

// ---------- Layer stub -------------------------------------------------

interface StubProp {
  numKeys: number;
  value: any;
  setValue: (v: any) => void;
  property?: (name: string) => StubProp | null;
}

function makeProp(initial: any, numKeys = 0): StubProp {
  const p: StubProp = {
    numKeys,
    value: initial,
    setValue: vi.fn(function (v: any) {
      p.value = v;
    }),
  };
  return p;
}

interface StubLayer {
  name: string;
  inPoint: number;
  outPoint: number;
  enabled: boolean;
  solo: boolean;
  shy: boolean;
  locked: boolean;
  label: number;
  comment: string;
  threeDLayer: boolean;
  parent: Layer | null;
  blendingMode: number;
  property: (name: string) => StubProp | null;
}

function makeLayer(overrides: Partial<StubLayer> = {}): StubLayer {
  const props: Record<string, StubProp> = {};
  return {
    name: 'L1',
    inPoint: 0,
    outPoint: 5,
    enabled: true,
    solo: false,
    shy: false,
    locked: false,
    label: 0,
    comment: '',
    threeDLayer: false,
    parent: null,
    blendingMode: 1,
    property: (name: string) => props[name] ?? null,
    ...overrides,
  };
}

// ---------- capture / apply round-trip --------------------------------

describe('captureBasicProperties / applyBasicProperties', () => {
  let layer: StubLayer;

  beforeEach(() => {
    layer = makeLayer({
      name: 'Original',
      inPoint: 1.5,
      outPoint: 7.25,
      enabled: false,
      solo: true,
      shy: true,
      locked: true,
      label: 7,
      comment: 'a comment',
      threeDLayer: true,
      blendingMode: 5,
    });
  });

  it('captures the expected fields', () => {
    const captured = captureBasicProperties(layer as unknown as Layer);
    expect(captured.name).toBe('Original');
    expect(captured.inPoint).toBe(1.5);
    expect(captured.outPoint).toBe(7.25);
    expect(captured.enabled).toBe(false);
    expect(captured.solo).toBe(true);
    expect(captured.shy).toBe(true);
    expect(captured.locked).toBe(true);
    expect(captured.label).toBe(7);
    expect(captured.comment).toBe('a comment');
    expect(captured.threeDLayer).toBe(true);
    expect(captured.blendingMode).toBe(5);
  });

  it('round-trip: capture then apply to a different layer preserves state', () => {
    const captured = captureBasicProperties(layer as unknown as Layer);
    const target = makeLayer();
    applyBasicProperties(target as unknown as Layer, captured);
    expect(target.inPoint).toBe(1.5);
    expect(target.outPoint).toBe(7.25);
    expect(target.enabled).toBe(false);
    expect(target.solo).toBe(true);
    expect(target.shy).toBe(true);
    expect(target.locked).toBe(true);
    expect(target.comment).toBe('a comment');
    expect(target.threeDLayer).toBe(true);
    expect(target.blendingMode).toBe(5);
  });

  it('apply is a no-op if the target throws on assignment', () => {
    const captured = captureBasicProperties(layer as unknown as Layer);
    const target = makeLayer();
    Object.defineProperty(target, 'inPoint', {
      get() {
        throw new Error('locked');
      },
      set() {
        throw new Error('locked');
      },
      configurable: true,
    });
    expect(() => applyBasicProperties(target as unknown as Layer, captured)).not.toThrow();
  });
});

// ---------- setPosition ------------------------------------------------

describe('setPosition', () => {
  it('writes the value when prop has no keyframes', () => {
    const prop = makeProp([0, 0]);
    setPosition(prop as unknown as Property, [10, 20]);
    expect(prop.setValue).toHaveBeenCalledWith([10, 20]);
    expect(prop.value).toEqual([10, 20]);
  });

  it('writes the value when prop has keyframes (falls through to try)', () => {
    const prop = makeProp([0, 0], 3);
    setPosition(prop as unknown as Property, [7, 8]);
    expect(prop.setValue).toHaveBeenCalledWith([7, 8]);
    expect(prop.value).toEqual([7, 8]);
  });

  it('does nothing if prop is null', () => {
    expect(() => setPosition(null, [1, 2])).not.toThrow();
  });

  it('swallows errors when setValue throws on a keyframed prop', () => {
    const prop: StubProp = {
      numKeys: 2,
      value: [0, 0],
      setValue: () => {
        throw new Error('animated');
      },
    };
    expect(() => setPosition(prop as unknown as Property, [1, 2])).not.toThrow();
  });
});

// ---------- hasDeepGlow -----------------------------------------------

describe('hasDeepGlow', () => {
  function makeLayerWithEffects(effectNames: string[]): StubLayer {
    const effectParade: StubProp = {
      numKeys: 0,
      value: null,
      setValue: vi.fn(),
      property: (name: string) => (effectNames.includes(name) ? makeProp(null) : null),
    };
    return makeLayer({
      property: (name: string) => (name === 'ADBE Effect Parade' ? effectParade : null),
    });
  }

  it('returns true when PEDG effect is present', () => {
    const layer = makeLayerWithEffects(['PEDG']);
    expect(hasDeepGlow(layer as unknown as Layer)).toBe(true);
  });

  it('returns true when PEDG2 effect is present', () => {
    const layer = makeLayerWithEffects(['PEDG2']);
    expect(hasDeepGlow(layer as unknown as Layer)).toBe(true);
  });

  it('returns false when neither PEDG nor PEDG2 is present', () => {
    const layer = makeLayerWithEffects(['SomeOtherEffect']);
    expect(hasDeepGlow(layer as unknown as Layer)).toBe(false);
  });

  it('returns false when the Effect Parade property is missing', () => {
    const layer = makeLayer();
    expect(hasDeepGlow(layer as unknown as Layer)).toBe(false);
  });
});
