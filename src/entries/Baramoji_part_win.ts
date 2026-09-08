// Baramoji_part_win.jsx entry — part decomposition with progress window.
// Original: Baramoji_part_win.jsx (Copyright 2025 361do_sleep).

import '../init';
import { makeProgressHelpers, runDecomposeTextToShapeParts } from '../core';

(function BaramojiPartWinEntry(this: unknown): void {
  const progress = makeProgressHelpers({ title: 'Text to Parts Decompose' });
  try {
    runDecomposeTextToShapeParts({ onProgress: progress.update });
  } finally {
    progress.close();
  }
})();