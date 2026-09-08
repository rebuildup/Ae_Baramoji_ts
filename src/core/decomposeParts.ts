// Decompose a TextLayer (or ShapeLayer with vector content) into per-part
// shape layers using path signed-area + point-in-polygon merge logic.
//
// This is the algorithm that powers:
//   - Baramoji_part.jsx
//   - Baramoji_part_win.jsx
//   - the "Parts" button in Baramoji.jsx
//
// The algorithm is verbatim from the original .jsx (Copyright 2025 361do_sleep)
// with type annotations added and shared helpers factored into `properties.ts` /
// `anchor.ts`. Logic MUST stay byte-identical so the result matches the legacy
// output.

import { ADBE, ALERT, CMD_CREATE_TEXT_SHAPE, UNDO, type DuplicateMode } from './constants';
import { captureBasicProperties, applyBasicProperties, type LayerProperties } from './properties';
import { adjustAnchorPoint } from './anchor';
import { hasDecompositionArtifacts, removeDecompositionArtifacts } from './duplicate';

export interface DecomposePartsOptions {
  onProgress?: (progress: number, message: string) => void;
  /**
   * How to handle layers that look like a previous decomposition. Default: skip.
   * See DUPLICATE_MODE_LABEL for user-facing descriptions.
   */
  duplicateMode?: DuplicateMode;
}

export function runDecomposeTextToShapeParts(opts: DecomposePartsOptions = {}): void {
  const { onProgress, duplicateMode = 'skip' } = opts;

  try {
    app.beginUndoGroup(UNDO.DecomposeTextToParts);
    onProgress?.(0, 'Initializing...');

    const comp = app.project.activeItem as any;
    if (!comp || !(comp instanceof (globalThis as any).CompItem)) {
      alert(ALERT.NoCompositionParts);
      app.endUndoGroup();
      return;
    }

    const selectedLayers = comp.selectedLayers as Layer[];
    if (selectedLayers.length === 0) {
      alert(ALERT.NoLayersParts);
      app.endUndoGroup();
      return;
    }

    if (duplicateMode === 'cancel') {
      for (let i = 0; i < selectedLayers.length; i++) {
        if (hasDecompositionArtifacts(comp, selectedLayers[i], 'parts')) {
          alert('Aborted: a selected layer already has a parts decomposition. ' +
                'Re-run with Skip or Overwrite to change existing layers.');
          app.endUndoGroup();
          return;
        }
      }
    }

    try {
      const textLayerIndices: number[] = [];
      const layerProperties: LayerProperties[] = [];

      for (let i = 0; i < selectedLayers.length; i++) {
        const layer = selectedLayers[i];
        const isTextLayer = layer instanceof (globalThis as any).TextLayer;
        const isShapeLayer =
          layer instanceof (globalThis as any).AVLayer || layer.constructor.name === 'ShapeLayer';
        let hasVectorGroup = false;

        try {
          hasVectorGroup = layer.property(ADBE.RootVectorsGroup) !== null;
        } catch (e) {
          hasVectorGroup = false;
        }

        if (isTextLayer || (isShapeLayer && hasVectorGroup)) {
          textLayerIndices.push(layer.index);
          layerProperties.push(captureBasicProperties(layer));
        }

        layer.selected = false;
      }

      textLayerIndices.sort((a, b) => a - b);

      if (textLayerIndices.length === 0) {
        alert(ALERT.NoValidForParts);
        app.endUndoGroup();
        return;
      }

      const totalSteps = Math.max(1, textLayerIndices.length);
      for (let i = 0; i < textLayerIndices.length; i++) {
        const layerIndex = textLayerIndices[i];
        const originalProps = layerProperties[i];

        onProgress?.(
          Math.round((i / totalSteps) * 80),
          'Processing layer ' + (i + 1) + '/' + totalSteps + '...',
        );

        const currentLayer = comp.layers[layerIndex] as Layer;
        currentLayer.selected = true;

        if (duplicateMode === 'skip' && hasDecompositionArtifacts(comp, currentLayer, 'parts')) {
          onProgress?.(Math.round((i / totalSteps) * 80), 'Skipping already-decomposed layer: ' + currentLayer.name);
          currentLayer.selected = false;
          continue;
        }
        if (duplicateMode === 'overwrite') {
          const removed = removeDecompositionArtifacts(comp, currentLayer, 'parts');
          if (removed > 0) onProgress?.(Math.round((i / totalSteps) * 80), 'Removed ' + removed + ' stale layer(s) for: ' + currentLayer.name);
        }

        let baseShapeLayer: Layer;
        if (currentLayer instanceof (globalThis as any).TextLayer) {
          app.executeCommand(CMD_CREATE_TEXT_SHAPE);
          baseShapeLayer =
            comp.selectedLayers && comp.selectedLayers.length > 0
              ? comp.selectedLayers[0]
              : (null as any);
          if (!baseShapeLayer) {
            alert(ALERT.FailedShapesFromTextA);
            currentLayer.selected = false;
            continue;
          }
        } else {
          try {
            if (!currentLayer.property(ADBE.RootVectorsGroup)) {
              alert(ALERT.FailedShapesNoVector + currentLayer.name);
              currentLayer.selected = false;
              continue;
            }
            baseShapeLayer = currentLayer;
          } catch (e) {
            alert('Error processing shape layer: ' + (e as Error).toString());
            currentLayer.selected = false;
            continue;
          }
        }

        let shapeLabel: number | undefined = undefined;
        try {
          shapeLabel = (baseShapeLayer as any).label;
        } catch (e) {
          void e;
        }

        processPartsMerge(baseShapeLayer);

        const keepOriginal = currentLayer.constructor.name === 'ShapeLayer';
        const resultLayers = processPartsDecompose(
          baseShapeLayer,
          originalProps,
          shapeLabel,
          keepOriginal,
        );

        if (resultLayers && resultLayers.length > 0) {
          try {
            for (let s = 0; s < comp.selectedLayers.length; s++) {
              comp.selectedLayers[s].selected = false;
            }
            for (let r = 0; r < resultLayers.length; r++) {
              resultLayers[r].selected = true;
            }
          } catch (e) {
            void e;
          }
        }
      }
    } catch (error) {
      alert('Error occurred: ' + (error as Error).toString());
    }

    onProgress?.(95, 'Finalizing...');
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

/**
 * Merge overlapping paths inside the shape layer's "ADBE Root Vectors Group"
 * using signed-area + point-in-polygon tests. Identical to the original
 * Baramoji_part.jsx implementation.
 */
function processPartsMerge(layer: Layer): void {
  const vectorGroup = layer.property(ADBE.RootVectorsGroup) as any;
  let prowloop = 1;

  while (prowloop <= vectorGroup.numProperties) {
    let pathcount = 1;
    let pathnum = 3;
    const nowtext = vectorGroup.property(prowloop).property(2) as any;

    if (nowtext.numProperties === 3) {
      pathnum--;
    }

    const area: number[] = [];
    let maxarea = 0;
    let mavec = true;
    let pathveccheckloop = 1;
    const areavecchash: number[] = [];
    let pathnowloop = 0;

    while (pathveccheckloop <= nowtext.numProperties - pathnum) {
      let nexdex = 0;
      let areachash = 0;
      const nowpath = nowtext.property(pathveccheckloop).property(2) as any;
      const nowpathpoint: number[][] = nowpath.value.vertices;

      for (let i = 0; i < nowpathpoint.length; i++) {
        nexdex = (i + 1) % nowpathpoint.length;
        areachash += nowpathpoint[i][0] * nowpathpoint[nexdex][1];
        areachash -= nowpathpoint[nexdex][0] * nowpathpoint[i][1];
      }

      if (Math.abs(areachash) > Math.abs(maxarea)) {
        maxarea = areachash;
      }
      areavecchash[pathveccheckloop - 1] = areachash;
      pathveccheckloop++;
    }

    if (maxarea > 0) {
      mavec = false;
    }

    while (pathcount <= nowtext.numProperties - pathnum) {
      area[pathcount - 1] = areavecchash[pathnowloop];

      if ((area[pathcount - 1] < 0) === mavec) {
        let countloop = 1;
        let areamove = false;

        nowtext.addProperty(ADBE.VectorGroup).moveTo(pathcount);
        nowtext.property(pathcount).property(ADBE.VectorMaterialsGroup).remove();
        nowtext.property(pathcount).name = nowtext.property(pathcount + 1).name;
        nowtext.property(pathcount).property(2).addProperty(ADBE.VectorShapeGroup);
        nowtext
          .property(pathcount)
          .property(2)
          .property(1)
          .property(2)
          .setValue(nowtext.property(pathcount + 1).property(2).value);
        nowtext.property(pathcount).property(2).property(1).name = nowtext.property(pathcount + 1).name;
        nowtext.property(pathcount + 1).remove();

        while (countloop < pathcount) {
          if (area[countloop - 1] < area[pathcount - 1]) {
            nowtext.property(pathcount).moveTo(countloop);
            area.splice(countloop - 1, 0, area[pathcount - 1]);
            areamove = true;
          }
          countloop++;
        }

        if (!areamove) {
          nowtext.property(pathcount).moveTo(countloop);
        }
        pathcount++;
      } else {
        nowtext.property(pathcount).moveTo(nowtext.numProperties - 3);
        pathnum++;
      }
      pathnowloop++;
    }

    let countloop2 = 1;
    while (countloop2 < pathcount) {
      let contentsloop = 0;
      let Mflag = false;

      while (contentsloop < nowtext.numProperties - (pathcount + 2)) {
        let ppflag = false;
        const checkpoint: [number, number] = [
          (nowtext.property(pathcount + contentsloop).property(2) as any).value.vertices[0][0],
          (nowtext.property(pathcount + contentsloop).property(2) as any).value.vertices[0][1],
        ];

        let cn = 0;
        const nowtexpath = nowtext
          .property(countloop2)
          .property(2)
          .property(1)
          .property(2) as any;
        const nowpathpoint: number[][] = nowtexpath.value.vertices;
        const nowpathoutT: number[][] = nowtexpath.value.outTangents;
        const nowpathinT: number[][] = nowtexpath.value.inTangents;

        const bezposX: number[] = [];
        const bezposY: number[] = [];

        for (let k = 0; k < nowpathpoint.length; k++) {
          const beznexdex = (k + 1) % nowpathpoint.length;
          const bez3 = 0.125;
          const p0: [number, number] = [nowpathpoint[k][0], nowpathpoint[k][1]];
          const p1: [number, number] = [
            nowpathpoint[k][0] + nowpathoutT[k][0],
            nowpathpoint[k][1] + nowpathoutT[k][1],
          ];
          const p2: [number, number] = [
            nowpathpoint[beznexdex][0] + nowpathinT[beznexdex][0],
            nowpathpoint[beznexdex][1] + nowpathinT[beznexdex][1],
          ];
          const p3: [number, number] = [nowpathpoint[beznexdex][0], nowpathpoint[beznexdex][1]];

          bezposX[k] = bez3 * p0[0] + 3 * bez3 * p1[0] + 3 * bez3 * p2[0] + bez3 * p3[0];
          bezposY[k] = bez3 * p0[1] + 3 * bez3 * p1[1] + 3 * bez3 * p2[1] + bez3 * p3[1];
        }

        let u = 0;
        const bppointpos: any[] = [];
        for (let j = 0; j < nowpathpoint.length * 2; j++) {
          if (j % 2 === 0) {
            bppointpos[j] = nowpathpoint[u];
          } else {
            bppointpos[j] = [bezposX[u], bezposY[u]];
            u++;
          }
        }

        for (let i = 0; i < bppointpos.length; i++) {
          const nexdex = (i + 1) % bppointpos.length;

          if (
            (bppointpos[i][1] <= checkpoint[1] && bppointpos[nexdex][1] > checkpoint[1]) ||
            (bppointpos[i][1] > checkpoint[1] && bppointpos[nexdex][1] <= checkpoint[1])
          ) {
            const vt =
              (checkpoint[1] - bppointpos[i][1]) / (bppointpos[nexdex][1] - bppointpos[i][1]);

            if (
              checkpoint[0] <
              bppointpos[i][0] + vt * (bppointpos[nexdex][0] - bppointpos[i][0])
            ) {
              cn++;
            }
          }
        }

        ppflag = cn % 2 !== 0;

        if (ppflag) {
          nowtext.property(countloop2).property(2).addProperty(ADBE.VectorShapeGroup).moveTo(2);
          nowtext
            .property(countloop2)
            .property(2)
            .property(2)
            .property(2)
            .setValue(nowtext.property(pathcount + contentsloop).property(2).value);
          nowtext.property(countloop2).property(2).property(2).name =
            nowtext.property(pathcount + contentsloop).name;
          nowtext.property(pathcount + contentsloop).remove();
          contentsloop--;

          if (!Mflag) {
            nowtext.property(countloop2).property(2).addProperty(ADBE.VectorFilterMerge);
            Mflag = true;
          }
        }
        contentsloop++;
      }
      countloop2++;
    }
    prowloop++;
  }
}

/**
 * Produce one duplicated layer per character outline from the merged
 * vector group.
 */
function processPartsDecompose(
  layer: Layer,
  originalProps: LayerProperties,
  targetLabel: number | undefined,
  keepOriginal: boolean,
): Layer[] {
  const vectorGroup = layer.property(ADBE.RootVectorsGroup) as any;
  let proloop = 0;
  const texnum = vectorGroup.numProperties;
  const resultLayers: Layer[] = [];

  while (proloop < texnum) {
    const character = vectorGroup.property(1) as any;
    const contents = character.property(2) as any;
    const pronum = contents.numProperties - 3;
    let prowloop = 1;

    while (prowloop < pronum) {
      const duplicatedLayer = layer.duplicate();
      duplicatedLayer.name = character.name + ' Outline ';

      const dupContents = duplicatedLayer
        .property(ADBE.RootVectorsGroup)
        .property(1)
        .property(2) as any;
      while (dupContents.numProperties > 4) {
        dupContents.property(2).remove();
      }

      if (dupContents.property(2).matchName === ADBE.VectorFilterMerge) {
        dupContents.property(2).remove();
      }

      contents.property(1).remove();

      while ((duplicatedLayer.property(ADBE.RootVectorsGroup) as any).numProperties > 1) {
        (duplicatedLayer.property(ADBE.RootVectorsGroup) as any).property(2).remove();
      }

      adjustAnchorPoint(duplicatedLayer, 2);
      applyBasicProperties(duplicatedLayer, originalProps);
      if (typeof targetLabel !== 'undefined') {
        try {
          (duplicatedLayer as any).label = targetLabel;
        } catch (e) {
          void e;
        }
      }

      try {
        if (resultLayers.length === 0) {
          duplicatedLayer.moveBefore(layer);
        } else {
          const lastLayer = resultLayers[resultLayers.length - 1];
          duplicatedLayer.moveBefore(lastLayer);
        }
      } catch (e) {
        void e;
      }

      resultLayers.push(duplicatedLayer);
      prowloop++;
    }

    const finalLayer = layer.duplicate();
    finalLayer.name = character.name + ' Outline ';

    const finalContents = finalLayer
      .property(ADBE.RootVectorsGroup)
      .property(1)
      .property(2) as any;
    if (finalContents.property(2).matchName === ADBE.VectorFilterMerge) {
      finalContents.property(2).remove();
    }

    while ((finalLayer.property(ADBE.RootVectorsGroup) as any).numProperties > 1) {
      (finalLayer.property(ADBE.RootVectorsGroup) as any).property(2).remove();
    }

    adjustAnchorPoint(finalLayer, 2);
    applyBasicProperties(finalLayer, originalProps);
    if (typeof targetLabel !== 'undefined') {
      try {
        (finalLayer as any).label = targetLabel;
      } catch (e) {
        void e;
      }
    }

    try {
      if (resultLayers.length === 0) {
        finalLayer.moveBefore(layer);
      } else {
        const lastLayer = resultLayers[resultLayers.length - 1];
        finalLayer.moveBefore(lastLayer);
      }
    } catch (e) {
      void e;
    }

    resultLayers.push(finalLayer);

    (vectorGroup.property(1) as any).remove();
    proloop++;
  }

  if (keepOriginal) {
    try {
      layer.enabled = false;
    } catch (e) {
      void e;
    }
  } else {
    try {
      layer.remove();
    } catch (e) {
      void e;
    }
  }
  return resultLayers;
}