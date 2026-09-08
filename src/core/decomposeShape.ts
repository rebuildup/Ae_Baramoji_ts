// Decompose a TextLayer into per-character shape layers.
//
// This is the algorithm that powers:
//   - Baramoji_shape.jsx
//   - Baramoji_shape_win.jsx
//   - the "Shapes" button in Baramoji.jsx
//
// Algorithm (verbatim from the original .jsx):
//   1. Convert selected text layer to shapes (executeCommand 3781).
//   2. Duplicate the resulting shape group N times (one per glyph).
//   3. In each duplicate, strip all but the matching glyph from Contents.
//   4. Name each dup "char_<ch>" and align its in/out points to the source.
//   5. Adjust its anchor point to the visual centre and shift its position
//      so it stays in place.
//   6. Move the duplicate before the source text layer.
//   7. Disable the source text layer and remove the original shape group.
//   8. Select the result layers.

import { adjustAnchorPoint } from './anchor';
import { ADBE, ALERT, CMD_CREATE_TEXT_SHAPE, UNDO } from './constants';

export interface DecomposeShapeOptions {
  /** Called after each layer is processed. progress in 0-100. */
  onProgress?: (progress: number, message: string) => void;
}

export function runDecomposeTextToShapeLayers(opts: DecomposeShapeOptions = {}): void {
  const { onProgress } = opts;

  try {
    app.beginUndoGroup(UNDO.DecomposeTextToShape);

    onProgress?.(0, 'Initializing...');

    const comp = app.project.activeItem as any;
    if (!comp || !(comp instanceof (globalThis as any).CompItem)) {
      alert(ALERT.NoCompositionShape);
      app.endUndoGroup();
      return;
    }

    onProgress?.(4, 'Inspecting layers...');

    const selLayers = comp.selectedLayers as Layer[];
    if (!selLayers || selLayers.length === 0) {
      alert(ALERT.NoLayersShape);
      app.endUndoGroup();
      return;
    }

    for (let layerIdx = 0; layerIdx < selLayers.length; layerIdx++) {
      const layerSpan = 60;
      const layerBase = 8 + Math.round((layerIdx / Math.max(1, selLayers.length)) * 10);
      onProgress?.(
        Math.min(layerBase, 18),
        'Processing layer ' + (layerIdx + 1) + '/' + selLayers.length + '...',
      );

      const textLayer = selLayers[layerIdx];
      if (!(textLayer instanceof (globalThis as any).TextLayer)) {
        continue;
      }

      const layerInPoint = textLayer.inPoint;
      const layerOutPoint = textLayer.outPoint;

      const textContent = String(textLayer.text.sourceText.value);
      const cleanedForChars = textContent.replace(/\r|\n|/g, '');
      const cleanText = cleanedForChars.replace(/\s+/g, '');

      for (let sdel = 0; sdel < comp.selectedLayers.length; sdel++) {
        comp.selectedLayers[sdel].selected = false;
      }
      textLayer.selected = true;

      onProgress?.(20, 'Converting text to shapes...');
      app.executeCommand(CMD_CREATE_TEXT_SHAPE);

      const baseShapeLayer = comp.selectedLayers[0];
      if (!baseShapeLayer) {
        alert(ALERT.FailedShapesFromText + textLayer.name);
        continue;
      }

      const shapeContents = baseShapeLayer.property(ADBE.Contents) as any;
      const totalShapes = shapeContents.numProperties;

      const resultLayers: Layer[] = [];
      for (let i = totalShapes - 1; i >= 0; i--) {
        const dup = baseShapeLayer.duplicate();
        const dupContents = dup.property(ADBE.Contents) as any;

        for (let j = dupContents.numProperties; j > 0; j--) {
          if (j !== i + 1) {
            try {
              dupContents.property(j).remove();
            } catch (e) {
              void e;
            }
          }
        }

        const charName = cleanText[i] ? cleanText[i] : String(i + 1);
        dup.name = 'char_' + charName;

        dup.inPoint = layerInPoint;
        dup.outPoint = layerOutPoint;

        adjustAnchorPoint(dup, 0);

        try {
          dup.moveBefore(textLayer);
        } catch (e) {
          void e;
        }

        resultLayers.push(dup);

        if (onProgress) {
          const progressBase = 22;
          const step =
            progressBase +
            Math.round(((totalShapes - 1 - i) / Math.max(1, totalShapes)) * layerSpan);
          onProgress(
            step,
            'Isolating shape ' + (totalShapes - i) + '/' + totalShapes + '...',
          );
        }
      }

      onProgress?.(86, 'Cleaning up...');

      try {
        textLayer.enabled = false;
      } catch (e) {
        void e;
      }
      try {
        baseShapeLayer.remove();
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

      onProgress?.(
        Math.min(90 + Math.round(((layerIdx + 1) / selLayers.length) * 8), 98),
        'Layer ' + (layerIdx + 1) + '/' + selLayers.length + ' completed',
      );
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