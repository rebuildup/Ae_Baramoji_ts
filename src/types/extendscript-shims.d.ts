// ExtendScript shims and type augmentations for After Effects APIs that
// types-for-adobe@7.2.6 doesn't cover (or covers loosely).
//
// We declare types in BOTH `declare global` (so they're available as bare
// globals in script contexts) AND re-export them (so other modules can
// `import type { Layer } from '../types/extendscript-shims'`).

declare global {
  interface Application {
    beginUndoGroup(name: string): void;
    endUndoGroup(): void;
  }

  interface CompItem {
    time: number;
    selectedLayers: Layer[];
    layers: LayerCollection;
  }

  interface LayerCollection {
    length: number;
    [index: number]: Layer;
  }

  interface Layer {
    name: string;
    index: number;
    selected: boolean;
    enabled: boolean;
    solo: boolean;
    shy: boolean;
    locked: boolean;
    label: number;
    comment: string;
    inPoint: number;
    outPoint: number;
    threeDLayer: boolean;
    blendingMode: number;
    parent: Layer | null;
    transform: TransformGroup;
    // Many algorithms call layer.text.sourceText even on Layer (the runtime
    // throws if it's not a TextLayer, so callers gate with instanceof). Make
    // the field optional+any to satisfy TS without weakening the signature.
    text: any;
    property(propertyName: string): any;
    property(depth: number): any;
    sourceRectAtTime(
      timeT: number,
      extents?: boolean,
    ): { top: number; left: number; width: number; height: number };
    duplicate(): Layer;
    remove(): void;
    moveBefore(other: Layer): void;
    moveAfter(other: Layer): void;
  }

  interface TransformGroup {
    anchorPoint: Property;
    position: Property;
    scale: Property;
    rotation: Property;
    opacity: Property;
    xRotation: Property;
    yRotation: Property;
    zRotation: Property;
    orientation: Property;
    property(matchName: string): Property | null;
    property(depth: number): Property | null;
  }

  interface PropertyBase {
    name: string;
    matchName: string;
    numKeys: number;
    value: any;
    dimensionsSeparated: boolean;
    setValue(v: any): void;
  }

  interface Property extends PropertyBase {
    property(matchName: string): Property | null;
    property(depth: number): Property | null;
  }

  interface PropertyGroup extends PropertyBase {
    numProperties: number;
    property(matchName: string): Property | null;
    property(depth: number): Property | null;
    addProperty(name: string): Property;
    canAddProperty(name: string): boolean;
    moveTo(index: number): Property;
    remove(): void;
  }

  class TextLayer extends Layer {
    text: {
      sourceText: Property & {
        value: TextDocument;
        valueAtTime(time: number, preExpression: boolean): TextDocument;
        getValue(): TextDocument;
        setValue(v: TextDocument): void;
      };
    };
  }

  class ShapeLayer extends Layer {
    property(name: string): PropertyGroup | null;
  }

  interface TextDocument {
    text: string;
    font: string;
    fontSize: number;
    fillColor: number[] | string[];
    strokeColor: number[] | string[];
    applyFill: boolean;
    applyStroke: boolean;
    strokeWidth: number;
    tracking: number;
    baselineShift: number;
    allCaps: boolean;
    smallCaps: boolean;
    strokeOverFill: boolean;
    fauxBold: boolean;
    fauxItalic: boolean;
    tsume: number;
    horizontalScale: number;
    verticalScale: number;
    [key: string]: any; // allow assignment to any field TS doesn't know about
  }

  interface ProgressDialog {
    setTitle(title: string): void;
    setMessage(msg: string): void;
    update(percent: number): void;
    close(): void;
  }

  interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
  }

  interface ScriptUIWindow {
    text: string;
    add(type: string, bounds?: number[]): ScriptUIElement;
    layout?: { layout: boolean };
    show(): void;
    close(): void;
    center(): void;
  }

  interface ScriptUIElement {
    text?: string;
    onClick?: (...args: any[]) => void;
    size?: number[];
  }
}

declare var app: Application;
declare var Window: (type: string, title: string, bounds?: number[]) => ScriptUIWindow;

// Re-export the global types so module imports work. The aliases point at
// the global interfaces declared above.
export type Layer = Layer;
export type CompItem = CompItem;
export type LayerCollection = LayerCollection;
export type TransformGroup = TransformGroup;
export type Property = Property;
export type PropertyBase = PropertyBase;
export type PropertyGroup = PropertyGroup;
export type TextLayer = TextLayer;
export type ShapeLayer = ShapeLayer;
export type TextDocument = TextDocument;
export type ProgressDialog = ProgressDialog;
export type Rect = Rect;
export type ScriptUIWindow = ScriptUIWindow;
export type ScriptUIElement = ScriptUIElement;