// ProgressDialog — a small ScriptUI helper used by the _win variants.
//
// Extends AE's Window/palette with progressbar + status text + an
// updateProgress(value, text) method. Identical to what the original
// _win .jsx files built by hand.

// We don't actually use the ProgressDialog class — the makeProgressHelpers
// factory constructs a fresh ScriptUI palette inline. This keeps the
// runtime behaviour byte-identical to the original _win .jsx files.

/**
 * The original _win variants embed a 4-line helper directly into the IIFE.
 * This module-level helper mirrors that behaviour but is called from a
 * single place, so all _win entries get identical UX.
 */
export function makeProgressHelpers(opts: {
  title: string;
}): {
  show: () => void;
  update: (value: number, text?: string) => void;
  close: () => void;
} {
  let dlg: any = null;

  function show(): void {
    if (!dlg || !dlg.visible) {
      const Win: any = (globalThis as any).Window;
      dlg = new Win('palette', opts.title, undefined);
      dlg.orientation = 'column';
      dlg.alignChildren = ['fill', 'center'];
      dlg.bar = dlg.add('progressbar', undefined, 0, 100);
      dlg.bar.preferredSize = { width: 300 } as any;
      dlg.status = dlg.add('statictext', [0, 0, 300, 30], 'Preparing...');
      dlg.status.alignment = 'center';
      dlg.updateProgress = (target: number, text?: string) => {
        if (!dlg.bar) return;
        const cur = Math.round(dlg.bar.value) || 0;
        const tgt = Math.max(0, Math.min(100, Math.round(target || 0)));
        const next = Math.max(cur, tgt);
        dlg.bar.value = next;
        dlg.status.text = text || String(next) + '% complete';
        try {
          dlg.update();
        } catch (e) {
          void e;
        }
      };
      dlg.center();
      dlg.show();
    }
  }

  function update(value: number, text?: string): void {
    if (dlg && dlg.updateProgress) {
      dlg.updateProgress(value, text);
    }
  }

  function close(): void {
    if (dlg) {
      try {
        dlg.close();
      } catch (e) {
        void e;
      }
      dlg = null;
    }
  }

  return { show, update, close };
}