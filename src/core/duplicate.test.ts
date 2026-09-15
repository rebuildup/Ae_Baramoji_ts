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
  id?: number;
  // Mutable storage so tests can simulate layer.remove() mutating the comp.
  removed?: boolean;
}

function makeLayer(name: string, index: number, comment = '', id?: number): StubLayer {
  return { name, comment, index, id };
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
  it('writes a marker that includes the JSON-encoded source name and the source id', () => {
    const source = makeLayer('S', 1, '', 42);
    const child = makeLayer('A', 2);
    tagArtifact(child as any, source as any, 'text');
    // Source name is JSON.stringify-wrapped (so any character can't
    // produce a prefix-collision with a different source) AND the source
    // id is appended after a `|` separator. The id segment disambiguates
    // two same-named sources from each other.
    expect(child.comment).toBe('baramoji:text:"S"|42');
  });

  it('uses an empty id segment when the source has no id', () => {
    // Older layers (or some hosts) may not expose `layer.id`. The marker
    // still includes a `|` separator so the segment count is fixed.
    const source = makeLayer('S', 1);
    const child = makeLayer('A', 2);
    tagArtifact(child as any, source as any, 'text');
    expect(child.comment).toBe('baramoji:text:"S"|');
  });

  it('preserves a pre-existing comment after the marker (NUL delimiter)', () => {
    const source = makeLayer('S', 1, '', 7);
    const child = makeLayer('A', 2, 'old note');
    tagArtifact(child as any, source as any, 'shape');
    // The delimiter is a NUL byte (0x00); AE layer names cannot contain it.
    expect(child.comment).toBe('baramoji:shape:"S"|7\x00old note');
  });

  it('does nothing when layer is null', () => {
    const source = makeLayer('S', 1, '', 1);
    expect(() => tagArtifact(null, source as any, 'text')).not.toThrow();
  });

  it('refuses to write a degenerate marker when both source name and source id are missing', () => {
    const source = makeLayer('', 1);
    const child = makeLayer('A', 2);
    tagArtifact(child as any, source as any, 'text');
    expect(child.comment).toBe('');
  });

  it('still tags when the source has an id but no name', () => {
    // Some AE layer kinds expose `id` but no settable name (or a name
    // that the user has cleared). The id alone is enough to disambiguate
    // against other sources; we should tag.
    const source = makeLayer('', 1, '', 99);
    const child = makeLayer('A', 2);
    tagArtifact(child as any, source as any, 'text');
    expect(child.comment).toBe('baramoji:text:""|99');
  });

  it('refuses to write when sourceLayer is null', () => {
    const child = makeLayer('A', 2);
    tagArtifact(child as any, null, 'text');
    expect(child.comment).toBe('');
  });

  it('replaces a prior marker on repeated calls (no accumulation)', () => {
    const source = makeLayer('S', 1, '', 3);
    const child = makeLayer('A', 2);
    tagArtifact(child as any, source as any, 'text');
    tagArtifact(child as any, source as any, 'text');
    tagArtifact(child as any, source as any, 'text');
    expect(child.comment).toBe('baramoji:text:"S"|3');
  });
});

// ---------- hasDecompositionArtifacts --------------------------------

describe('hasDecompositionArtifacts', () => {
  it('returns false for an empty comp', () => {
    const { comp } = makeComp([]);
    const source = makeLayer('S', 1, '', 1);
    expect(hasDecompositionArtifacts(comp as any, source as any, 'text')).toBe(false);
  });

  it('detects a tagged artifact that matches the source', () => {
    const source = makeLayer('S', 1, '', 1);
    const child = makeLayer('A', 2);
    tagArtifact(child as any, source as any, 'text');
    const { comp } = makeComp([source, child]);
    expect(hasDecompositionArtifacts(comp as any, source as any, 'text')).toBe(true);
  });

  it('ignores a tagged artifact from a different source', () => {
    const source = makeLayer('S', 1, '', 1);
    const otherSource = makeLayer('Other', 2, '', 2);
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
    const source = makeLayer('S', 1, '', 1);
    const otherSource = makeLayer('Other', 2, '', 2);
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
    const sourceA = makeLayer('abc', 1, '', 1);
    const sourceB = makeLayer('abc def', 2, '', 2);
    const artifactA = makeLayer('A', 3);
    tagArtifact(artifactA as any, sourceA as any, 'text');
    const { comp } = makeComp([sourceA, sourceB, artifactA]);
    expect(hasDecompositionArtifacts(comp as any, sourceB as any, 'text')).toBe(false);
  });

  it('disambiguates two same-named sources by their AE layer id', () => {
    // Regression: without the id segment, two layers named "Hello" would
    // share the same marker, and overwriting one would delete the other's
    // artifacts. With id included, the marker for "Hello" id=100 is
    // `baramoji:text:"Hello"|100` and for "Hello" id=200 is
    // `baramoji:text:"Hello"|200` — distinct.
    const sourceA = makeLayer('Hello', 1, '', 100);
    const sourceB = makeLayer('Hello', 2, '', 200);
    const artifactA = makeLayer('H', 3);
    const artifactB = makeLayer('H', 4);
    tagArtifact(artifactA as any, sourceA as any, 'text');
    tagArtifact(artifactB as any, sourceB as any, 'text');
    const { comp } = makeComp([sourceA, sourceB, artifactA, artifactB]);
    expect(hasDecompositionArtifacts(comp as any, sourceA as any, 'text')).toBe(true);
    expect(hasDecompositionArtifacts(comp as any, sourceB as any, 'text')).toBe(true);
    // The id segment is what tells the two apart — without it both
    // sources would see both artifacts as their own.
    expect(artifactA.comment).not.toBe(artifactB.comment);
  });

  it('does not consider the source layer itself an artifact', () => {
    const source = makeLayer('S', 1, '', 1);
    tagArtifact(source as any, source as any, 'text');
    const { comp } = makeComp([source]);
    expect(hasDecompositionArtifacts(comp as any, source as any, 'text')).toBe(false);
  });
});

// ---------- removeDecompositionArtifacts -----------------------------

describe('removeDecompositionArtifacts', () => {
  it('returns 0 for an empty comp', () => {
    const { comp } = makeComp([]);
    const source = makeLayer('S', 1, '', 1);
    expect(removeDecompositionArtifacts(comp as any, source as any, 'text')).toBe(0);
  });

  it('removes all tagged siblings and returns the count', () => {
    const source = makeLayer('S', 1, '', 1);
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
    const source = makeLayer('Hello', 1, '', 1);
    const otherSource = makeLayer('World', 2, '', 2);
    const orphan = makeLayer('H', 3);
    tagArtifact(orphan as any, otherSource as any, 'text');
    const { comp } = makeComp([source, orphan]);
    wireRemove(orphan, comp);
    // `orphan` is tagged for "World", not "Hello"; must not be removed.
    expect(removeDecompositionArtifacts(comp as any, source as any, 'text')).toBe(0);
    expect(orphan.removed).toBe(false);
  });

  it('does not remove same-named artifacts from a different source id', () => {
    // Two sources share the name "Hello" but have distinct ids. An
    // overwrite of source A must NOT remove the artifact tagged for
    // source B even though both names match without the id segment.
    const sourceA = makeLayer('Hello', 1, '', 100);
    const sourceB = makeLayer('Hello', 2, '', 200);
    const orphan = makeLayer('H', 3);
    tagArtifact(orphan as any, sourceB as any, 'text');
    const { comp } = makeComp([sourceA, sourceB, orphan]);
    wireRemove(orphan, comp);
    expect(removeDecompositionArtifacts(comp as any, sourceA as any, 'text')).toBe(0);
    expect(orphan.removed).toBe(false);
  });

  it('survives a removal failure and surfaces the error to the caller', () => {
    // After Fix #6, removeDecompositionArtifacts must NOT swallow failures.
    // We simulate a stubborn layer whose remove() throws, and assert that the
    // exception propagates so the caller can abort the overwrite pass.
    const source = makeLayer('S', 1, '', 1);
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
