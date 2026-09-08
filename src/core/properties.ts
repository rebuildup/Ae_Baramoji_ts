// Property helpers for capturing and applying layer state.
//
// Used by both text decomposition (per-character style extraction) and parts
// decomposition (preserve original layer attributes when duplicating).

import { ADBE } from './constants';

export interface LayerProperties {
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
}

/**
 * Capture the subset of layer properties that the Baramoji algorithms
 * preserve when duplicating / moving / re-creating layers.
 */
export function captureBasicProperties(layer: Layer): LayerProperties {
  const props: Partial<LayerProperties> = {};
  try {
    props.name = layer.name;
    props.inPoint = layer.inPoint;
    props.outPoint = layer.outPoint;
    props.enabled = layer.enabled;
    props.solo = layer.solo;
    props.shy = layer.shy;
    props.locked = layer.locked;
    props.label = layer.label;
    props.comment = layer.comment;
    props.threeDLayer = layer.threeDLayer;
    props.parent = layer.parent;
    props.blendingMode = layer.blendingMode;
  } catch (e) {
    void e;
  }
  return props as LayerProperties;
}

/** Apply a previously captured property set to a layer. */
export function applyBasicProperties(layer: Layer, props: LayerProperties): void {
  try {
    layer.inPoint = props.inPoint;
    layer.outPoint = props.outPoint;
    layer.enabled = props.enabled;
    layer.solo = props.solo;
    layer.shy = props.shy;
    layer.locked = props.locked;
    layer.comment = props.comment;
    layer.threeDLayer = props.threeDLayer;
    layer.blendingMode = props.blendingMode;
    if (props.parent) {
      try {
        layer.parent = props.parent;
      } catch (e) {
        void e;
      }
    }
  } catch (e) {
    void e;
  }
}

/** Set a property's value, falling back silently on animated properties. */
export function setPosition(prop: Property | null, value: number | [number, number] | [number, number, number]): void {
  if (!prop) return;
  if (prop.numKeys === 0) {
    prop.setValue(value);
  } else {
    try {
      prop.setValue(value);
    } catch (e) {
      void e;
    }
  }
}

/**
 * Extract an array-valued TextLayer style attribute as a comma-separated
 * string by temporarily setting an expression. Original Baramoji_txt.jsx
 * uses this trick to read fontSize / fillColor / etc. per character.
 */
export function getPropertyArray(property: string, layer: any): string {
  const txtSave = layer.property(ADBE.SourceText).value;
  const expression =
    'var output_txt=[]; for(var i=0;i<text.sourceText.length;i++){output_txt.push(text.sourceText.getStyleAt(i).' +
    property +
    ');}output_txt;';
  layer.property(ADBE.SourceText).expression = expression;
  const output = layer.property(ADBE.SourceText).value;
  layer.property(ADBE.SourceText).expression = '';
  // Restore the original TextDocument (assigning to .value triggers setValue).
  layer.text.sourceText.setValue(txtSave);
  return String(output);
}

/** Get the source rect (size) of a layer at the comp's current time. */
export function getLayerSize(layer: Layer): [number, number] {
  const comp = app.project.activeItem as any;
  const bounds = layer.sourceRectAtTime(comp.time, false);
  return [bounds.width, bounds.height];
}

/** Detect "Deep Glow" effect (the popular plugin) on a layer. */
export function hasDeepGlow(layer: Layer): boolean {
  try {
    const ef = layer.property(ADBE.EffectParade);
    if (!ef) return false;
    if (ef.property(ADBE.PEDG) || ef.property(ADBE.PEDG2)) return true;
  } catch (e) {
    void e;
  }
  return false;
}

/** Move a layer's anchor to its visual center and apply a position offset. */
export function adjustLayerPosition(layer: Layer, curTime: number, posX: number, posY: number): void {
  try {
    const layerBounds = layer.sourceRectAtTime(curTime, false);
    const left = layerBounds.left;
    const top = layerBounds.top;
    const width = layerBounds.width;
    const height = layerBounds.height;
    layer.transform.anchorPoint.setValue([width / 2 + left, height / 2 + top]);
  } catch (e) {
    void e;
  }
  try {
    if (!layer.transform.position.dimensionsSeparated) {
      setPosition(layer.transform.property(ADBE.Position) as Property, [posX, posY]);
    } else {
      setPosition(layer.transform.property(ADBE.Position_0) as Property, posX);
      setPosition(layer.transform.property(ADBE.Position_1) as Property, posY);
    }
  } catch (e) {
    try {
      layer.transform.position.setValue([posX, posY]);
    } catch (e2) {
      void e2;
    }
  }
}