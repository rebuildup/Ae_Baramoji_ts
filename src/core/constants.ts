// Shared constants for the Baramoji decomposition algorithms.

/** AE internal menu command that converts the selected TextLayer into ShapeLayers. */
export const CMD_CREATE_TEXT_SHAPE = 3781;

// ADBE match names (stable across AE versions; "matchName" / "matchNames").
export const ADBE = {
  TransformGroup: 'ADBE Transform Group',
  Position: 'ADBE Position',
  Position_0: 'ADBE Position_0',
  Position_1: 'ADBE Position_1',
  Position_2: 'ADBE Position_2',
  AnchorPoint: 'ADBE Anchor Point',
  Scale: 'ADBE Scale',
  RotateZ: 'ADBE Rotate Z',
  XRotation: 'ADBE X Rotation',
  YRotation: 'ADBE Y Rotation',
  ZRotation: 'ADBE Z Rotation',
  Orientation: 'ADBE Orientation',
  RootVectorsGroup: 'ADBE Root Vectors Group',
  VectorGroup: 'ADBE Vector Group',
  VectorMaterialsGroup: 'ADBE Vector Materials Group',
  VectorShapeGroup: 'ADBE Vector Shape - Group',
  VectorFilterMerge: 'ADBE Vector Filter - Merge',
  VectorAnchor: 'ADBE Vector Anchor',
  Contents: 'Contents',
  SourceText: 'Source Text',
  EffectParade: 'ADBE Effect Parade',
  PEDG: 'PEDG',
  PEDG2: 'PEDG2',
} as const;

// Undo group names — used for AE's undo system.
export const UNDO = {
  DecomposeTextToText: 'DecomposeTextLayers',
  DecomposeTextToShape: 'DecomposeTextToShapeLayers',
  DecomposeTextToParts: 'Text to Parts Decompose',
} as const;

/** User-selectable handling for layers that have already been decomposed. */
export type DuplicateMode = 'skip' | 'overwrite' | 'cancel';

export const DUPLICATE_MODE = {
  Skip: 'skip',
  Overwrite: 'overwrite',
  Cancel: 'cancel',
} as const;

/** Localised label / description for each DuplicateMode (used by palette + _win modal). */
export const DUPLICATE_MODE_LABEL: Record<DuplicateMode, { name: string; description: string }> = {
  skip: {
    name: 'Skip existing',
    description: 'Skip source layers that already have a decomposition in this comp.',
  },
  overwrite: {
    name: 'Overwrite',
    description: 'Delete the previous decomposition and re-run from scratch.',
  },
  cancel: {
    name: 'Cancel (do nothing)',
    description: 'Abort the run if any selected layer already has a decomposition.',
  },
};

// Default alert / dialog text.
export const ALERT = {
  NoCompositionText:
    'No composition is active. Please open a composition and select text layers.',
  NoCompositionShape:
    'No composition is active. Please open a composition and select text layers.',
  NoCompositionParts:
    'No composition is active. Please open a composition and select text layers or shape layers.',
  NoLayersText: 'No layers selected. Please select one or more text layers.',
  NoLayersShape: 'No layers selected. Please select one or more text layers.',
  NoLayersParts:
    'No layers selected. Please select one or more text layers or shape layers.',
  FailedShapesFromText: 'Failed to create shapes from text for layer: ',
  FailedShapesFromTextA: 'Failed to create shapes from text for a layer.',
  FailedShapesNoVector: 'Selected layer does not contain vector content: ',
  NoValidForParts:
    'No valid text layers or shape layers found in selection. Please select layers with vector content.',
  RemoveDeepGlow:
    'Please temporarily remove the Deep Glow effect from the layer: ',
} as const;