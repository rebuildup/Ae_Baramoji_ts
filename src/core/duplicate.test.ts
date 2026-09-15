// Unit tests for src/core/duplicate.ts.
//
// The module inspects AE's `Comp` / `Layer` globals, which don't exist
// outside ExtendScript. We build a small in-test stub comp that lets us
// drive `hasDecompositionArtifacts`, `removeDecompositionArtifacts`, and
// `tagArtifact` without an AE host.

import { describe, it, expect } from 'vitest';
import {
  hasDecompositionArtifacts,
  removeDecompositionArtifacts,
  tagArtifact,
} from './duplicate';

// ---------- Comp / Layer stub -----------------------------------------

interface StubLayer {
  name: string;
  comment: string;
  index: number;
  // Mutable storage so tests can simulate layer.remove() mutating the comp.
  removed?: boolean;
}

function makeLayer(name: string, index: number, comment = ''): StubLayer {
  return { name, comment, index };
}

interface StubComp {
  numLayers: number;
  layer: (i: number) => StubLayer | null;
}

function makeComp(layers: StubLayer[]): {
  comp: StubComp;
  layerMap: Map<StubLayer, number>;
} {
  const live = layers.slice();
  const layerMap = new Map<StubLayer, number>();
  live.forEach((l, idx) => layerMap.set(l, idx + 1));
  const comp: StubComp = {
    get numLayers() {
      return live.length;
    },
    layer(i: number) {
      const l = live[i - 1];
      if (!l) return null;
      return l;
    },
  };
  (comp as any).__live = live;
  (comp as any).__layerMap = layerMap;
  return { comp, layerMap };
}

function wireRemove(layer: StubLayer, comp: StubComp) {
  layer.removed = false;
  (layer as any).remove = function () {
    layer.removed = true;
    const live: StubLayer[] = (comp as any).__live;
    const idx = live.indexOf(layer);
    if (idx >= 0) live.splice(idx, 1);
  };
}

// ---------- tagArtifact ----------------------------------------------

describe('tagArtifact', () => {
  it('writes the marker onto an empty comment', () => {
    const source = makeLayer('S', 1);
    const child = makeLayer('A', 2);
    tagArtifact(child as any, source as any, 'text');
    // The source name is JSON-encoded so no character in the layer name
    // (tabs, spaces, our own prefix, quotes, etc.) can produce a
    // prefix-collision with a different source.
    expect(child.comment).toBe('baramoji:text:"S"');
  });

  it('preserves a pre-existing comment after the marker (NUL delimiter)', () => {
    const source = makeLayer('S', 1);
    const child = makeLayer('A', 2, 'old note');
    tagArtifact(child as any, source as any, 'shape');
    // The delimiter is a NUL byte (0x00); AE layer names cannot contain it.
    expect(child.comment).toBe('baramoji:shape:"S"\x00old note');
  });

  it('does nothing when layer is null', () => {
    const source = makeLayer('S', 1);
    expect(() => tagArtifact(null, source as any, 'text')).not.toThrow();
  });

  it('refuses to write a degenerate marker for an empty source name', () => {
    const source = makeLayer('', 1);
    const child = makeLayer('A', 2);
    tagArtifact(child as any, source as any, 'text');
    expect(child.comment).toBe('');
  });

  it('refuses to write when sourceLayer is null', () => {
    const child = makeLayer('A', 2);
    tagArtifact(child as any, null, 'text');
    expect(child.comment).toBe('');
  });

  it('replaces a prior marker on repeated calls (no accumulation)', () => {
    const source = makeLayer('S', 1);
    const child = makeLayer('A', 2);
    tagArtifact(child as any, source as any, 'text');
    tagArtifact(child as any, source as any, 'text');
    tagArtifact(child as any, source as any, 'text');
    expect(child.comment).toBe('baramoji:text:"S"');
  });
});

// ---------- hasDecompositionArtifacts --------------------------------

describe('hasDecompositionArtifacts', () => {
  it('returns false for an empty comp', () => {
    const { comp } = makeComp([]);
    const source = makeLayer('S', 1);
    expect(hasDecompositionArtifacts(comp as any, source as any, 'text')).toBe(false);
  });

  it('detects a tagged artifact that matches the source', () => {
    const source = makeLayer('S', 1);
    const child = makeLayer('A', 2);
    tagArtifact(child as any, source as any, 'text');
    const { comp } = makeComp([source, child]);
    expect(hasDecompositionArtifacts(comp as any, source as any, 'text')).toBe(true);
  });

  it('ignores a tagged artifact from a different source', () => {
    const source = makeLayer('S', 1);
    const otherSource = makeLayer('Other', 2);
    const child = makeLayer('A', 3);
    tagArtifact(child as any, otherSource as any, 'text');
    const { comp } = makeComp([source, child]);
    expect(hasDecompositionArtifacts(comp as any, source as any, 'text')).toBe(false);
  });

  it('does not let the legacy name heuristic delete tagged artifacts of other sources', () => {
    // Source A is named "S". A child layer is tagged for source B ("Other").
    // Even though the child's name is "char_A" (which would match the
    // legacy shape heuristic for source A), the cross-source guard must
    // prevent it from being treated as A's artifact.
    const source = makeLayer('S', 1);
    const otherSource = makeLayer('Other', 2);
    const child = makeLayer('char_A', 3);
    tagArtifact(child as any, otherSource as any, 'shape');
    const { comp } = makeComp([source, child]);
    expect(hasDecompositionArtifacts(comp as any, source as any, 'shape')).toBe(false);
  });

  it('uses JSON-encoded source names so prefix collisions are impossible', () => {
    // Regression: with raw encoding, source "abc" would match a tag for
    // source "abc def" because "baramoji:text:abc" is a prefix of
    // "baramoji:text:abc def ...". JSON.stringify wraps the source name in
    // quotes and escapes any embedded specials, so the encoded form for
    // "abc" is `"abc"` (length 5) and for "abc def" is `"abc def"` (length 9)
    // — no substring relationship.
    const sourceA = makeLayer('abc', 1);
    const sourceB = makeLayer('abc def', 2);
    const artifactA = makeLayer('A', 3);
    tagArtifact(artifactA as any, sourceA as any, 'text');
    const { comp } = makeComp([sourceA, sourceB, artifactA]);
    expect(hasDecompositionArtifacts(comp as any, sourceB as any, 'text')).toBe(false);
  });

  it('does not consider the source layer itself an artifact', () => {
    const source = makeLayer('S', 1);
    tagArtifact(source as any, source as any, 'text');
    const { comp } = makeComp([source]);
    expect(hasDecompositionArtifacts(comp as any, source as any, 'text')).toBe(false);
  });
});

// ---------- removeDecompositionArtifacts -----------------------------

describe('removeDecompositionArtifacts', () => {
  it('returns 0 for an empty comp', () => {
    const { comp } = makeComp([]);
    const source = makeLayer('S', 1);
    expect(removeDecompositionArtifacts(comp as any, source as any, 'text')).toBe(0);
  });

  it('removes all tagged siblings and returns the count', () => {
    const source = makeLayer('S', 1);
    const a = makeLayer('A', 2);
    const b = makeLayer('B', 3);
    const c = makeLayer('C', 4);
    tagArtifact(a as any, source as any, 'text');
    tagArtifact(b as any, source as any, 'text');
    // `c` is NOT tagged, must survive.
    const { comp } = makeComp([source, a, b, c]);
    wireRemove(a, comp);
    wireRemove(b, comp);
    wireRemove(c, comp);
    expect(removeDecompositionArtifacts(comp as any, source as any, 'text')).toBe(2);
    expect(a.removed).toBe(true);
    expect(b.removed).toBe(true);
    expect(c.removed).toBe(false);
  });

  it('skips layers from a different source even when names collide', () => {
    const source = makeLayer('Hello', 1);
    const otherSource = makeLayer('World', 2);
    const orphan = makeLayer('H', 3);
    tagArtifact(orphan as any, otherSource as any, 'text');
    const { comp } = makeComp([source, orphan]);
    wireRemove(orphan, comp);
    // `orphan` is tagged for "World", not "Hello"; must not be removed.
    expect(removeDecompositionArtifacts(comp as any, source as any, 'text')).toBe(0);
    expect(orphan.removed).toBe(false);
  });

  it('survives a removal failure and surfaces the error to the caller', () => {
    // After Fix #6, removeDecompositionArtifacts must NOT swallow failures.
    // We simulate a stubborn layer whose remove() throws, and assert that the
    // exception propagates so the caller can abort the overwrite pass.
    const source = makeLayer('S', 1);
    const stubborn = makeLayer('A', 2);
    tagArtifact(stubborn as any, source as any, 'text');
    const { comp } = makeComp([source, stubborn]);
    (stubborn as any).remove = () => {
      throw new Error('locked');
    };
    expect(() =>
      removeDecompositionArtifacts(comp as any, source as any, 'text'),
    ).toThrow(/locked/);
  });
});