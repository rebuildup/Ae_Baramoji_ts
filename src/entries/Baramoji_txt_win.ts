// Baramoji_txt_win.jsx entry — text-layer decomposition with progress window.
// Original: Baramoji_txt_win.jsx (Copyright 2024 Nisai, 2025 361do_sleep).

import '../init';
import { makeProgressHelpers, promptDuplicateMode, runDecomposeTextToTextLayers } from '../core';

(function BaramojiTxtWinEntry(this: unknown): void {
  const mode = promptDuplicateMode();
  if (mode === null) return;
  const progress = makeProgressHelpers({ title: 'Text decomposition in progress' });
  try {
    runDecomposeTextToTextLayers({ onProgress: progress.update, duplicateMode: mode });
  } finally {
    progress.close();
  }
})();
