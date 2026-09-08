// Build the ScriptUI palette shown by Baramoji.jsx (the unified entry).
//
// Three buttons — Texts, Shapes, Parts — each wired to one of the three
// decomposition algorithms via the onProgress stub passed by the entry file.
// A dropdown above the buttons selects how existing decomposition artifacts
// should be handled (see DUPLICATE_MODE_LABEL).

import { DUPLICATE_MODE_LABEL, type DuplicateMode } from './constants';

export interface PaletteCallbacks {
  onTexts: (mode: DuplicateMode) => void;
  onShapes: (mode: DuplicateMode) => void;
  onParts: (mode: DuplicateMode) => void;
}

export interface PaletteOptions {
  initialDuplicateMode?: DuplicateMode;
}

const MODE_ORDER: DuplicateMode[] = ['skip', 'overwrite', 'cancel'];

function modeLabels(): string[] {
  const out: string[] = [];
  for (let i = 0; i < MODE_ORDER.length; i++) {
    out.push(DUPLICATE_MODE_LABEL[MODE_ORDER[i]].name);
  }
  return out;
}

function indexOfMode(mode: DuplicateMode): number {
  for (let i = 0; i < MODE_ORDER.length; i++) {
    if (MODE_ORDER[i] === mode) return i;
  }
  return -1;
}

export function buildPalette(cb: PaletteCallbacks, opts: PaletteOptions = {}): ScriptUIWindow {
  // ExtendScript's Window is a global constructor. We access via any to avoid
  // the strict signature mismatch.
  const Win: any = (globalThis as any).Window;
  const win = new Win('palette', 'Baramoji', undefined) as ScriptUIWindow;
  win.layout = { layout: true } as any;

  const dupRow = win.add('group') as any;
  dupRow.orientation = 'row';
  dupRow.alignChildren = ['left', 'center'];
  (dupRow.add('statictext', undefined, 'Existing:') as any);
  const dropdown = dupRow.add('dropdown', undefined, modeLabels()) as any;
  const initialIdx = indexOfMode(opts.initialDuplicateMode || 'skip');
  dropdown.selection = initialIdx >= 0 ? initialIdx : 0;

  function currentMode(): DuplicateMode {
    return MODE_ORDER[dropdown.selection] || 'skip';
  }

  const colGroup = win.add('group') as any;
  colGroup.orientation = 'column';

  const btnTexts = colGroup.add('button', undefined, 'Texts') as ScriptUIElement;
  btnTexts.onClick = () => cb.onTexts(currentMode());

  const btnShapes = colGroup.add('button', undefined, 'Shapes') as ScriptUIElement;
  btnShapes.onClick = () => cb.onShapes(currentMode());

  const btnParts = colGroup.add('button', undefined, 'Parts') as ScriptUIElement;
  btnParts.onClick = () => cb.onParts(currentMode());

  return win;
}

/**
 * Standalone modal dialog for the per-algorithm `_win` variants. Shows a
 * radio button group for the duplicate mode. Returns null if the user
 * cancels.
 */
export function promptDuplicateMode(initial: DuplicateMode = 'skip'): DuplicateMode | null {
  const Win: any = (globalThis as any).Window;
  const dlg = new Win('dialog', 'Baramoji', undefined);
  dlg.orientation = 'column';
  dlg.alignChildren = ['fill', 'top'];
  (dlg.add('statictext', undefined, 'How should existing decomposition be handled?') as any);

  const radios: any[] = [];
  for (const mode of MODE_ORDER) {
    const rb = dlg.add('radiobutton', undefined, DUPLICATE_MODE_LABEL[mode].name);
    rb.value = mode === initial;
    radios.push(rb);
  }

  const buttonRow = dlg.add('group') as any;
  buttonRow.orientation = 'row';
  buttonRow.alignChildren = ['center', 'center'];
  const okBtn = buttonRow.add('button', undefined, 'OK') as any;
  const cancelBtn = buttonRow.add('button', undefined, 'Cancel') as any;
  okBtn.onClick = () => {
    (dlg as any)._result = 'ok';
    dlg.close();
  };
  cancelBtn.onClick = () => {
    (dlg as any)._result = 'cancel';
    dlg.close();
  };

  dlg.center();
  dlg.show();
  if ((dlg as any)._result !== 'ok') return null;
  for (let i = 0; i < radios.length; i++) {
    if (radios[i].value) return MODE_ORDER[i];
  }
  return initial;
}
