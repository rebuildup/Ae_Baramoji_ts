// Baramoji.jsx entry — combined UI palette for all three decompositions.
// Original: Baramoji.jsx (Copyright 2025 361do_sleep).

import '../init';
import {
  buildPalette,
  runDecomposeTextToTextLayers,
  runDecomposeTextToShapeLayers,
  runDecomposeTextToShapeParts,
} from '../core';

(function BaramojiEntry(this: unknown): void {
  const win = buildPalette({
    onTexts: () => runDecomposeTextToTextLayers(),
    onShapes: () => runDecomposeTextToShapeLayers(),
    onParts: () => runDecomposeTextToShapeParts(),
  });
  (win as any).center();
  (win as any).show();
})();