// Baramoji_shape_win.jsx entry — shape decomposition with progress window.
// Original: Baramoji_shape_win.jsx (Copyright 2024 Nisai, 2025 361do_sleep).

import '../init';
import { makeProgressHelpers, runDecomposeTextToShapeLayers } from '../core';

(function BaramojiShapeWinEntry(this: unknown): void {
  const progress = makeProgressHelpers({ title: 'Decompose Text To Shapes' });
  try {
    runDecomposeTextToShapeLayers({ onProgress: progress.update });
  } finally {
    progress.close();
  }
})();