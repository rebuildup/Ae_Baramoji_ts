// adjustAnchorPoint — the anchor/position math that appears in both
// Baramoji_shape.jsx (inline) and Baramoji_part.jsx (extracted as
// `adjustAnchorPoint`). The `_part` version accepts a `pet` parameter to
// control where the vector anchor is set; we preserve that here.

import { ADBE } from './constants';

/**
 * Move a layer's anchor point to the visual center of its sourceRect and
 * apply the inverse translation to its position so the layer visually
 * stays in place. No-op if the transform group has keyframes.
 *
 * @param pet 0 = transform-group anchor; 1 = root vectors group anchor;
 *            2 = nested (1).property(2).property(1) anchor (used in parts).
 */
export function adjustAnchorPoint(layer: Layer, pet: number): void {
  const laytrans = layer.property(ADBE.TransformGroup) as any;
  if (!laytrans) return;

  // Skip if any of these are animated.
  if (
    (laytrans.property(ADBE.Position) as any).numKeys !== 0 ||
    (laytrans.property(ADBE.Position_0) as any).numKeys !== 0 ||
    (laytrans.property(ADBE.Position_1) as any).numKeys !== 0 ||
    (laytrans.property(ADBE.AnchorPoint) as any).numKeys !== 0
  ) {
    return;
  }

  try {
    const RZ = (laytrans.property(ADBE.RotateZ) as any).value as number;
    const sourceRect = layer.sourceRectAtTime(0, true);
    const CX = sourceRect.width * 0.5 + sourceRect.left;
    const CY = sourceRect.height * 0.5 + sourceRect.top;
    const scale = (laytrans.property(ADBE.Scale) as any).value as number[];
    const SX = scale[0];
    const SY = scale[1];
    const anchor = (laytrans.property(ADBE.AnchorPoint) as any).value as number[];
    const APX = anchor[0];
    const APY = anchor[1];

    let PX = 0;
    let PY = 0;
    if (!(laytrans.property(ADBE.Position) as any).dimensionsSeparated) {
      const pos = (laytrans.property(ADBE.Position) as any).value as number[];
      PX = pos[0];
      PY = pos[1];
    } else {
      PX = (laytrans.property(ADBE.Position_0) as any).value as number;
      PY = (laytrans.property(ADBE.Position_1) as any).value as number;
    }

    (laytrans.property(ADBE.AnchorPoint) as any).setValue([0, 0, 0]);

    if (pet === 1) {
      (
        layer
          .property(ADBE.RootVectorsGroup)
          .property(1)
          .property(3)
          .property('ADBE Vector Anchor') as any
      ).setValue([CX, CY]);
    } else if (pet === 2) {
      (
        layer
          .property(ADBE.RootVectorsGroup)
          .property(1)
          .property(2)
          .property(1)
          .property(3)
          .property('ADBE Vector Anchor') as any
      ).setValue([CX, CY]);
    } else {
      (laytrans.property(ADBE.AnchorPoint) as any).setValue([CX, CY, 0]);
    }

    const DX = (CX - APX) * 0.01 * SX;
    const DY = (CY - APY) * 0.01 * SY;
    const rotRad = (RZ * Math.PI) / 180;

    const newX = PX + DX * Math.cos(rotRad) - DY * Math.sin(rotRad);
    const newY = PY + DX * Math.sin(rotRad) + DY * Math.cos(rotRad);

    if (!(laytrans.property(ADBE.Position) as any).dimensionsSeparated) {
      (laytrans.property(ADBE.Position) as any).setValue([newX, newY, 0]);
    } else {
      (laytrans.property(ADBE.Position_0) as any).setValue(newX);
      (laytrans.property(ADBE.Position_1) as any).setValue(newY);
    }
  } catch (e) {
    void e;
  }
}