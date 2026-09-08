// Decompose a TextLayer into per-character text layers (preserving per-char
// styling and positions).
//
// This is the algorithm that powers:
//   - Baramoji_txt.jsx
//   - Baramoji_txt_win.jsx
//   - the "Texts" button in Baramoji.jsx
//
// Logic MUST stay byte-identical to the original (Copyright 2025 361do_sleep).

import { ADBE, ALERT, CMD_CREATE_TEXT_SHAPE, UNDO, type DuplicateMode } from './constants';
import {
  getPropertyArray,
  getLayerSize,
  hasDeepGlow,
  setPosition,
} from './properties';
import { degToRad, rotationToMatrix, multiplyMatrix3x3, applyMatrixToOffset } from './matrix';
import { hasDecompositionArtifacts, removeDecompositionArtifacts } from './duplicate';

export interface DecomposeTextOptions {
  onProgress?: (progress: number, message: string) => void;
  /**
   * How to handle layers that look like a previous decomposition. Default: skip.
   * See DUPLICATE_MODE_LABEL for user-facing descriptions.
   */
  duplicateMode?: DuplicateMode;
}

const STYLE_KEYS = [
  'fontSize',
  'font',
  'applyFill',
  'fillColor',
  'applyStroke',
  'strokeColor',
  'strokeWidth',
  'tracking',
  'baselineShift',
  'strokeOverFill',
  'fauxBold',
  'fauxItalic',
  'tsume',
] as const;

export function runDecomposeTextToTextLayers(opts: DecomposeTextOptions = {}): void {
  const { onProgress, duplicateMode = 'skip' } = opts;

  try {
    app.beginUndoGroup(UNDO.DecomposeTextToText);
    onProgress?.(0, 'Initializing...');

    const comp = app.project.activeItem as any;
    if (!comp || !(comp instanceof (globalThis as any).CompItem)) {
      alert(ALERT.NoCompositionText);
      app.endUndoGroup();
      return;
    }

    const curTime = comp.time;
    const selLayers = comp.selectedLayers as Layer[];
    if (!selLayers || selLayers.length === 0) {
      alert(ALERT.NoLayersText);
      app.endUndoGroup();
      return;
    }

    // Cancel-mode short-circuit: if ANY selected layer already looks
    // decomposed, abort before doing any work.
    if (duplicateMode === 'cancel') {
      for (let i = 0; i < selLayers.length; i++) {
        if (hasDecompositionArtifacts(comp, selLayers[i], 'text')) {
          alert('Aborted: a selected layer already has a text decomposition. ' +
                'Re-run with Skip or Overwrite to change existing layers.');
          app.endUndoGroup();
          return;
        }
      }
    }

    onProgress?.(4, 'Inspecting layers...');

    for (let layerIdx = 0; layerIdx < selLayers.length; layerIdx++) {
      const layerBase = 8 + Math.round((layerIdx / Math.max(1, selLayers.length)) * 10);
      onProgress?.(
        Math.min(layerBase, 18),
        'Processing layer ' + (layerIdx + 1) + '/' + selLayers.length + '...',
      );

      const textLayer = selLayers[layerIdx];
      if (!(textLayer instanceof (globalThis as any).TextLayer)) {
        continue;
      }

      if (hasDeepGlow(textLayer)) {
        alert(ALERT.RemoveDeepGlow + textLayer.name);
        continue;
      }

      // Skip / overwrite handling: check this source layer's siblings.
      if (duplicateMode === 'skip' && hasDecompositionArtifacts(comp, textLayer, 'text')) {
        onProgress?.(layerBase, 'Skipping already-decomposed layer: ' + textLayer.name);
        continue;
      }
      if (duplicateMode === 'overwrite') {
        const removed = removeDecompositionArtifacts(comp, textLayer, 'text');
        if (removed > 0) onProgress?.(layerBase, 'Removed ' + removed + ' stale layer(s) for: ' + textLayer.name);
      }

      let originalScale: [number, number] = [100, 100];
      try {
        const s = (textLayer.transform.scale as any).value as number[];
        if (s.length === 2) originalScale = [s[0], s[1]];
        else if (s.length === 3) originalScale = [s[0], s[1]];
      } catch (e) {
        void e;
      }

      let originalSolo = false;
      try {
        originalSolo = textLayer.solo === true;
      } catch (e) {
        void e;
      }

      const layerInPoint = textLayer.inPoint;
      const layerOutPoint = textLayer.outPoint;

      const originalText = textLayer.text.sourceText.value;
      const textContent = String(originalText);

      const cleanedForChars = textContent.replace(//g, '');
      const textFontSize = getPropertyArray('fontSize', textLayer).split(',');
      const textFont = getPropertyArray('font', textLayer).split(',');
      const textApplyFill = getPropertyArray('applyFill', textLayer).split(',');
      const textFillColor_txt = getPropertyArray('fillColor', textLayer).split(',');
      const textApplyStroke = getPropertyArray('applyStroke', textLayer).split(',');
      const textStrokeColor_txt = getPropertyArray('strokeColor', textLayer).split(',');
      const textStrokeWidth = getPropertyArray('strokeWidth', textLayer).split(',');

      const textTracking = getPropertyArray('tracking', textLayer).split(',');
      const textBaselineShift = getPropertyArray('baselineShift', textLayer).split(',');
      const textStrokeOverFill = getPropertyArray('strokeOverFill', textLayer).split(',');
      const textFauxBold = getPropertyArray('fauxBold', textLayer).split(',');
      const textFauxItalic = getPropertyArray('fauxItalic', textLayer).split(',');
      const textTsume = getPropertyArray('tsume', textLayer).split(',');

      const textFillColor: string[][] = [];
      for (let i = 0; i < textFillColor_txt.length; i += 3) {
        textFillColor.push(textFillColor_txt.slice(i, i + 3));
      }
      const textStrokeColor: string[][] = [];
      for (let i = 0; i < textStrokeColor_txt.length; i += 3) {
        textStrokeColor.push(textStrokeColor_txt.slice(i, i + 3));
      }

      const specialCharRegex = /[\s\n\r]/g;
      const specialCharIndices: number[] = [];
      const text = cleanedForChars;
      for (let ci = 0; ci < text.length; ci++) {
        if (specialCharRegex.test(text[ci])) specialCharIndices.push(ci);
      }
      const cleanText = text.replace(/\s+/g, '');
      for (let j = specialCharIndices.length - 1; j >= 0; j--) {
        const idx = specialCharIndices[j];
        if (textFontSize.length > idx) textFontSize.splice(idx, 1);
        if (textFont.length > idx) textFont.splice(idx, 1);
        if (textApplyFill.length > idx) textApplyFill.splice(idx, 1);
        if (textFillColor.length > idx) textFillColor.splice(idx, 1);
        if (textApplyStroke.length > idx) textApplyStroke.splice(idx, 1);
        if (textStrokeColor.length > idx) textStrokeColor.splice(idx, 1);
        if (textStrokeWidth.length > idx) textStrokeWidth.splice(idx, 1);

        if (textTracking.length > idx) textTracking.splice(idx, 1);
        if (textBaselineShift.length > idx) textBaselineShift.splice(idx, 1);
        if (textStrokeOverFill.length > idx) textStrokeOverFill.splice(idx, 1);
        if (textFauxBold.length > idx) textFauxBold.splice(idx, 1);
        if (textFauxItalic.length > idx) textFauxItalic.splice(idx, 1);
        if (textTsume.length > idx) textTsume.splice(idx, 1);
      }

      for (let sdel = 0; sdel < comp.selectedLayers.length; sdel++) {
        comp.selectedLayers[sdel].selected = false;
      }
      textLayer.selected = true;
      onProgress?.(20, 'Converting text to shapes...');
      app.executeCommand(CMD_CREATE_TEXT_SHAPE);

      const shapeLayer = comp.selectedLayers[0];
      if (!shapeLayer) {
        alert(ALERT.FailedShapesFromText + textLayer.name);
        continue;
      }

      const shapeContents = shapeLayer.property(ADBE.Contents) as any;
      for (let p = shapeContents.numProperties - 1; p > 0; p--) {
        const duplicatedShape = (comp.selectedLayers[0] as Layer).duplicate();
        duplicatedShape.selected = true;
      }
      const allShapes = comp.selectedLayers as Layer[];

      for (let si = 0; si < allShapes.length; si++) {
        const curShape = allShapes[si];
        curShape.enabled = false;
        const curContents = curShape.property(ADBE.Contents) as any;
        for (let pi = curContents.numProperties; pi > 0; pi--) {
          if (pi !== si + 1) {
            try {
              curContents.property(pi).remove();
            } catch (e) {
              void e;
            }
          }
        }
      }

      const shapeAnchorX: number[] = [];
      const shapeAnchorY: number[] = [];
      const shapePositionX: number[] = [];
      const shapePositionY: number[] = [];
      for (let s = 0; s < allShapes.length; s++) {
        try {
          const cur = allShapes[s] as any;
          const shapeRot = cur.transform.rotation
            ? (cur.transform.rotation as any).value
            : 0;
          const shapeAnchor = (cur.transform.anchorPoint as any).value as number[];
          const shapeBounds = cur.sourceRectAtTime(curTime, false);
          const centerX = shapeBounds.width / 2 + shapeBounds.left;
          const centerY = shapeBounds.height / 2 + shapeBounds.top;

          const offsetX = (centerX - shapeAnchor[0]) * (originalScale[0] / 100);
          const offsetY = (centerY - shapeAnchor[1]) * (originalScale[1] / 100);
          const cosR = Math.cos((shapeRot * Math.PI) / 180);
          const sinR = Math.sin((shapeRot * Math.PI) / 180);
          const shpPos = (cur.transform.position as any).value as number[];

          shapeAnchorX.push(centerX);
          shapeAnchorY.push(centerY);
          shapePositionX.push(shpPos[0] + offsetX * cosR - offsetY * sinR);
          shapePositionY.push(shpPos[1] + offsetX * sinR + offsetY * cosR);
        } catch (e) {
          void e;
          shapeAnchorX.push(0);
          shapeAnchorY.push(0);
          const baseP = (textLayer.transform.position as any).value as number[];
          shapePositionX.push(baseP[0]);
          shapePositionY.push(baseP[1]);
        }
      }

      const resultLayers: Layer[] = [];
      for (let ci = cleanText.length - 1; ci >= 0; ci--) {
        const characterLayer = textLayer.duplicate();
        characterLayer.enabled = true;
        characterLayer.name = cleanText[ci];
        try {
          characterLayer.solo = originalSolo;
        } catch (e) {
          void e;
        }
        resultLayers.unshift(characterLayer);
      }

      const baseProgress = 22;
      const span = 60;
      for (let charIndex = 0; charIndex < cleanText.length; charIndex++) {
        const characterLayer = resultLayers[charIndex];

        const charTextDocument = ((textLayer.text.sourceText as any).valueAtTime(
          curTime,
          true,
        ) as TextDocument) as any;
        charTextDocument.text = cleanText[charIndex];

        try {
          if (charIndex < textFontSize.length) {
            if (textFontSize[charIndex] !== '') {
              charTextDocument.fontSize = Number(textFontSize[charIndex]);
            }
            if (textFont[charIndex] !== '') {
              charTextDocument.font = textFont[charIndex];
            }

            if (textApplyFill[charIndex] === 'true') {
              charTextDocument.applyFill = true;
              if (textFillColor[charIndex]) {
                charTextDocument.fillColor = textFillColor[charIndex] as any;
              }
            } else {
              charTextDocument.applyFill = false;
            }

            if (textApplyStroke[charIndex] === 'true') {
              charTextDocument.applyStroke = true;
              if (textStrokeColor[charIndex]) {
                charTextDocument.strokeColor = textStrokeColor[charIndex] as any;
              }
              if (textStrokeWidth[charIndex] !== '') {
                charTextDocument.strokeWidth = Number(textStrokeWidth[charIndex]);
              }
            } else {
              charTextDocument.applyStroke = false;
            }

            if (textTracking[charIndex] !== undefined && textTracking[charIndex] !== '') {
              charTextDocument.tracking = Number(textTracking[charIndex]);
            }
            if (textBaselineShift[charIndex] !== undefined && textBaselineShift[charIndex] !== '') {
              charTextDocument.baselineShift = Number(textBaselineShift[charIndex]);
            }
            if (textStrokeOverFill[charIndex] !== undefined) {
              charTextDocument.strokeOverFill = textStrokeOverFill[charIndex] === 'true';
            }
            if (textFauxBold[charIndex] !== undefined) {
              charTextDocument.fauxBold = textFauxBold[charIndex] === 'true';
            }
            if (textFauxItalic[charIndex] !== undefined) {
              charTextDocument.fauxItalic = textFauxItalic[charIndex] === 'true';
            }
            if (textTsume[charIndex] !== undefined && textTsume[charIndex] !== '') {
              charTextDocument.tsume = Number(textTsume[charIndex]);
            }
          }
        } catch (styleError) {
          void styleError;
        }

        (characterLayer.text.sourceText as any).setValue(charTextDocument);

        try {
          const tSize = getLayerSize(characterLayer);
          const sSize = getLayerSize(allShapes[charIndex]);

          const originalHScale = (charTextDocument as any).horizontalScale || 100;
          const originalVScale = (charTextDocument as any).verticalScale || 100;

          const newHScale = (sSize[0] / (tSize[0] || 1)) * originalHScale;
          const newVScale = (sSize[1] / (tSize[1] || 1)) * originalVScale;

          (charTextDocument as any).horizontalScale = Math.min(Math.max(newHScale, 0), 1000);
          (charTextDocument as any).verticalScale = Math.min(Math.max(newVScale, 0), 1000);

          (characterLayer.text.sourceText as any).setValue(charTextDocument);
        } catch (e) {
          void e;
        }

        try {
          const lb = characterLayer.sourceRectAtTime(curTime, false);
          const charAnchorLocal: [number, number] = [
            lb.width / 2 + lb.left,
            lb.height / 2 + lb.top,
          ];

          try {
            (characterLayer.transform.anchorPoint as any).setValue(charAnchorLocal);
          } catch (e) {
            void e;
          }

          const textAP = (textLayer.transform.anchorPoint as any).value as number[];

          const sx = shapeAnchorX[charIndex];
          const sy = shapeAnchorY[charIndex];

          const localOffsetX = (sx - textAP[0]) * (originalScale[0] / 100);
          const localOffsetY = (sy - textAP[1]) * (originalScale[1] / 100);
          const localOffsetZ = 0;

          if (!textLayer.threeDLayer) {
            const rotZ = textLayer.transform.rotation
              ? ((textLayer.transform.rotation as any).value as number)
              : 0;
            const cosR = Math.cos(degToRad(rotZ));
            const sinR = Math.sin(degToRad(rotZ));
            const rotX = localOffsetX * cosR - localOffsetY * sinR;
            const rotY = localOffsetX * sinR + localOffsetY * cosR;
            const basePos = (textLayer.transform.position as any).value as number[];
            const finalX = basePos[0] + rotX;
            const finalY = basePos[1] + rotY;
            try {
              if (!(characterLayer.transform.position as any).dimensionsSeparated) {
                setPosition(
                  characterLayer.transform.property(ADBE.Position) as any,
                  [finalX, finalY],
                );
              } else {
                setPosition(characterLayer.transform.property(ADBE.Position_0) as any, finalX);
                setPosition(characterLayer.transform.property(ADBE.Position_1) as any, finalY);
              }
            } catch (e) {
              try {
                (characterLayer.transform.position as any).setValue([finalX, finalY]);
              } catch (e2) {
                void e2;
              }
            }
          } else {
            let ori: [number, number, number] = [0, 0, 0];
            try {
              const oriVal = (textLayer.transform.orientation as any).value as number[];
              if (oriVal && oriVal.length >= 3) {
                ori = [oriVal[0], oriVal[1], oriVal[2]];
              }
            } catch (e) {
              void e;
            }
            const xRot = textLayer.transform.xRotation
              ? ((textLayer.transform.xRotation as any).value as number)
              : 0;
            const yRot = textLayer.transform.yRotation
              ? ((textLayer.transform.yRotation as any).value as number)
              : 0;
            const zRot = textLayer.transform.zRotation
              ? ((textLayer.transform.zRotation as any).value as number)
              : 0;
            const rotationVals: [number, number, number] = [xRot, yRot, zRot];

            const oriMat = rotationToMatrix(ori as [number, number, number]);
            const rotMat = rotationToMatrix(rotationVals);
            const finalMat = multiplyMatrix3x3(oriMat, rotMat);

            const applied = applyMatrixToOffset(
              finalMat,
              localOffsetX,
              localOffsetY,
              localOffsetZ,
            );

            const basePos = (textLayer.transform.position as any).value as number[];
            const finalPos3: number[] = [
              basePos[0] + applied[0],
              basePos[1] + applied[1],
              (basePos.length > 2 ? basePos[2] : 0) + (applied[2] || 0),
            ];

            try {
              if (!(characterLayer.transform.position as any).dimensionsSeparated) {
                setPosition(
                  characterLayer.transform.property(ADBE.Position) as any,
                  finalPos3 as any,
                );
              } else {
                setPosition(
                  characterLayer.transform.property(ADBE.Position_0) as any,
                  finalPos3[0],
                );
                setPosition(
                  characterLayer.transform.property(ADBE.Position_1) as any,
                  finalPos3[1],
                );
                if (characterLayer.transform.property(ADBE.Position_2)) {
                  setPosition(
                    characterLayer.transform.property(ADBE.Position_2) as any,
                    finalPos3[2],
                  );
                }
              }
            } catch (e) {
              try {
                (characterLayer.transform.position as any).setValue(finalPos3 as any);
              } catch (e2) {
                void e2;
              }
            }
          }
        } catch (posError) {
          try {
            (characterLayer.transform.position as any).setValue(
              (textLayer.transform.position as any).value,
            );
          } catch (e2) {
            void e2;
          }
        }

        characterLayer.inPoint = layerInPoint;
        characterLayer.outPoint = layerOutPoint;

        if (onProgress) {
          onProgress(
            baseProgress + Math.round((charIndex / Math.max(1, cleanText.length)) * span),
            'Styling character ' + (charIndex + 1) + '/' + cleanText.length + '...',
          );
        }
      }

      onProgress?.(86, 'Cleaning up...');

      try {
        textLayer.enabled = false;
      } catch (e) {
        void e;
      }

      for (let rem = 0; rem < allShapes.length; rem++) {
        try {
          allShapes[rem].remove();
        } catch (e) {
          void e;
        }
      }

      try {
        for (let ss = 0; ss < comp.selectedLayers.length; ss++) {
          comp.selectedLayers[ss].selected = false;
        }
      } catch (e) {
        void e;
      }
      for (let rr = 0; rr < resultLayers.length; rr++) {
        try {
          resultLayers[rr].selected = true;
        } catch (e) {
          void e;
        }
      }
    }

    onProgress?.(99, 'Finalizing...');
    try {
      (globalThis as any).$.sleep?.(150);
    } catch (e) {
      void e;
    }
    onProgress?.(100, 'Completed!');
    try {
      (globalThis as any).$.sleep?.(250);
    } catch (e) {
      void e;
    }

    app.endUndoGroup();
  } catch (err) {
    try {
      app.endUndoGroup();
    } catch (e) {
      void e;
    }
    alert('Error: ' + ((err as any)?.toString ? (err as any).toString() : err));
  }
}