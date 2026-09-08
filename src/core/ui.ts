// Build the ScriptUI palette shown by Baramoji.jsx (the unified entry).
//
// Three buttons — Texts, Shapes, Parts — each wired to one of the three
// decomposition algorithms via the onProgress stub passed by the entry file.

// ScriptUIWindow / ScriptUIElement are global types (see types/extendscript-shims.d.ts).

export interface PaletteCallbacks {
  onTexts: () => void;
  onShapes: () => void;
  onParts: () => void;
}

export function buildPalette(cb: PaletteCallbacks): ScriptUIWindow {
  // ExtendScript's Window is a global constructor. We access via any to avoid
  // the strict signature mismatch.
  const Win: any = (globalThis as any).Window;
  const win = new Win('palette', 'Baramoji', undefined) as ScriptUIWindow;
  win.layout = { layout: true } as any;
  const colGroup = win.add('group') as any;
  colGroup.orientation = 'column';

  const btnTexts = colGroup.add('button', undefined, 'Texts') as ScriptUIElement;
  btnTexts.onClick = cb.onTexts;

  const btnShapes = colGroup.add('button', undefined, 'Shapes') as ScriptUIElement;
  btnShapes.onClick = cb.onShapes;

  const btnParts = colGroup.add('button', undefined, 'Parts') as ScriptUIElement;
  btnParts.onClick = cb.onParts;

  return win;
}