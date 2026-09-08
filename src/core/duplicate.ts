// Heuristics for detecting and removing artifacts left in a comp by a
// previous run of the decomposition algorithms.
//
// Each algorithm leaves layers with distinctive names. We use those names as
// a best-effort signal of "this comp already has a decomposition". Users who
// happen to have unrelated layers with matching names can pre-select to
// avoid false positives.
//
// Algorithm → naming convention:
//   - text decomposition: per-character TextLayer whose name is the single
//     character (possibly filtered through the same charFilter the algorithm
//     applies). See `nameTextArtifact`.
//   - shape decomposition: per-character ShapeLayer named "char_<char>".
//     See `nameShapeArtifact`.
//   - parts decomposition: per-part ShapeLayer named "<partName> Outline ".
//     See `namePartsArtifact`.

import { ADBE } from './constants';

export type Algorithm = 'text' | 'shape' | 'parts';

/**
 * Return true if `sourceLayer` looks like it already has been decomposed
 * inside `comp` by `algorithm`. The check is best-effort and only inspects
 * siblings within the same comp.
 */
export function hasDecompositionArtifacts(
  comp: any,
  sourceLayer: any,
  algorithm: Algorithm
): boolean {
  if (!comp || !sourceLayer) return false;
  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (layer === sourceLayer) continue;
    if (matchesArtifact(layer, sourceLayer, algorithm)) return true;
  }
  return false;
}

/**
 * Remove any layer in `comp` (other than `sourceLayer` itself) that looks
 * like an artifact of a previous `algorithm` run. Returns the count of
 * removed layers. Detection is the same heuristic as `hasDecompositionArtifacts`.
 */
export function removeDecompositionArtifacts(
  comp: any,
  sourceLayer: any,
  algorithm: Algorithm
): number {
  if (!comp || !sourceLayer) return 0;
  // Collect matching layers first; removing while iterating mutates indices.
  const toRemove: any[] = [];
  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (layer === sourceLayer) continue;
    if (matchesArtifact(layer, sourceLayer, algorithm)) toRemove.push(layer);
  }
  for (const layer of toRemove) {
    try {
      layer.remove();
    } catch (e) {
      void e;
    }
  }
  return toRemove.length;
}

function matchesArtifact(layer: any, sourceLayer: any, algorithm: Algorithm): boolean {
  if (!layer || !layer.name) return false;
  const name = String(layer.name);
  if (algorithm === 'text') {
    // Single-character name that appears in the source text (best-effort).
    if (name.length !== 1) return false;
    try {
      const src = String(sourceLayer.text.sourceText.value);
      return src.replace(/\s/g, '').indexOf(name) >= 0;
    } catch (e) {
      void e;
      return false;
    }
  }
  if (algorithm === 'shape') {
    // Shape decomposition names: "char_<char>" or "char_<char>_<idx>".
    return name.indexOf('char_') === 0 && name.length > 5;
  }
  if (algorithm === 'parts') {
    // Parts decomposition leaves shape layers named "<partName> Outline ".
    if (name.length < 10) return false;
    if (name.indexOf(' Outline ') < 0) return false;
    return isShapeOrVectorLayer(layer);
  }
  return false;
}

function isShapeOrVectorLayer(layer: any): boolean {
  try {
    if (layer instanceof (globalThis as any).ShapeLayer) return true;
  } catch (e) {
    void e;
  }
  try {
    return layer.property(ADBE.RootVectorsGroup) !== null;
  } catch (e) {
    void e;
    return false;
  }
}
