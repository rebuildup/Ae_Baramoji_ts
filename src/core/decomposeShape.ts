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
import { ADBE, ALERT, CMD_CREATE_TEXT_SHAPE, UNDO, type DuplicateMode } from './constants';
import {
  hasDecompositionArtifacts,
  removeDecompositionArtifacts,
  tagArtifact,
} from './duplicate';

export interface DecomposeShapeOptions {
  /** Called after each layer is processed. progress in 0-100. */
  onProgress?: (progress: number, message: string) => void;
  /**
   * How to handle layers that look like a previous decomposition. Default: skip.
   * See DUPLICATE_MODE_LABEL for user-facing descriptions.
   */
  duplicateMode?: DuplicateMode;
}

export function runDecomposeTextToShapeLayers(opts: DecomposeShapeOptions = {}): void {
  const { onProgress, duplicateMode = 'skip' } = opts;

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

    if (duplicateMode === 'cancel') {
      for (let i = 0; i < selLayers.length; i++) {
        if (hasDecompositionArtifacts(comp, selLayers[i], 'shape')) {
          alert('Aborted: a selected layer already has a shape decomposition. ' +
                'Re-run with Skip or Overwrite to change existing layers.');
          app.endUndoGroup();
          return;
        }
      }
    }

    for (let layerIdx = 0; layerIdx < selLayers.length; layerIdx++) {
      // Hoisted so the per-source catch can roll back partial artifacts
      // (baseShapeLayer is created by CMD_CREATE_TEXT_SHAPE; resultLayers
      // are created by baseShapeLayer.duplicate() below). textLayer must
      // also be visible in the catch for the same reason — clear-selection
      // state and restore it before continuing to the next source.
      let textLayer: Layer | null = null;
      let baseShapeLayer: Layer | null = null;
      let resultLayers: Layer[] = [];
      // Wrap each source layer in its own try/catch so a failure on one
      // source (e.g. removeDecompositionArtifacts hitting a locked layer)
      // doesn't abort the entire multi-source pass.
      try {
      const layerSpan = 60;
      const layerBase = 8 + Math.round((layerIdx / Math.max(1, selLayers.length)) * 10);
      onProgress?.(
        Math.min(layerBase, 18),
        'Processing layer ' + (layerIdx + 1) + '/' + selLayers.length + '...',
      );

      textLayer = selLayers[layerIdx];
      if (!(textLayer instanceof (globalThis as any).TextLayer)) {
        continue;
      }

      if (duplicateMode === 'skip' && hasDecompositionArtifacts(comp, textLayer, 'shape')) {
        onProgress?.(layerBase, 'Skipping already-decomposed layer: ' + textLayer.name);
        continue;
      }
      if (duplicateMode === 'overwrite') {
        const removed = removeDecompositionArtifacts(comp, textLayer, 'shape');
        if (removed > 0) onProgress?.(layerBase, 'Removed ' + removed + ' stale layer(s) for: ' + textLayer.name);
      }

      const layerInPoint = textLayer.inPoint;
      const layerOutPoint = textLayer.outPoint;

      const textContent = String(textLayer.text.sourceText.value);
      const cleanedForChars = textContent.replace(/\r|\n|/g, '');
      const cleanText = cleanedForChars.replace(/\s+/g, '');

      // Clear selection before selecting this source so a stale selection
      // from the previous iteration's `resultLayers` doesn't end up as
      // `comp.selectedLayers[0]` after `CMD_CREATE_TEXT_SHAPE`.
      for (let sdel = 0; sdel < comp.selectedLayers.length; sdel++) {
        try {
          comp.selectedLayers[sdel].selected = false;
        } catch (e) {
          void e;
        }
      }
      textLayer.selected = true;

      onProgress?.(20, 'Converting text to shapes...');
      app.executeCommand(CMD_CREATE_TEXT_SHAPE);

      if (!comp.selectedLayers[0]) {
        alert(ALERT.FailedShapesFromText + textLayer.name);
        continue;
      }
      baseShapeLayer = comp.selectedLayers[0];

      // Narrowed for use inside the loop below; the null case was already
      // handled above. Re-narrow here so TS knows the call sites are
      // non-null without sprinkling `!` operators throughout.
      const baseLayer: Layer = baseShapeLayer as Layer;

      const shapeContents = baseLayer.property(ADBE.Contents) as any;
      const totalShapes = shapeContents.numProperties;

      for (let i = totalShapes - 1; i >= 0; i--) {
        const dup = baseLayer.duplicate();
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
        // Tag the artifact so a later overwrite pass can match it back to
        // THIS source layer (and not a user-created sibling called "char_A").
        tagArtifact(dup, textLayer, 'shape');

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
        baseLayer.remove();
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
      } catch (layerError) {
        // Wrap each source in its own try/catch so one bad layer doesn't
        // abort the whole multi-source pass. Roll back partial artifacts
        // we created for THIS source so a failure mid-way doesn't leave a
        // half-decomposed source next to the original. Existing tagged
        // decompositions removed by `overwrite` mode are kept — we only
        // undo what THIS run produced for the failed source.
        for (let r = 0; r < resultLayers.length; r++) {
          try {
            resultLayers[r].remove();
          } catch (e) {
            void e;
          }
        }
        if (baseShapeLayer) {
          try {
            baseShapeLayer.remove();
          } catch (e) {
            void e;
          }
        }
        if (textLayer) {
          try {
            textLayer.selected = false;
          } catch (e) {
            void e;
          }
        }
        try {
          alert(
            'Error processing layer: ' +
              ((layerError as any)?.toString
                ? (layerError as any).toString()
                : layerError),
          );
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