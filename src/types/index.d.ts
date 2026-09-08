// Type entry point for the entire project.
//
// We pin to After Effects 24.0 because it ships the AfterEffects globals we
// need (executeCommand, sourceRectAtTime, TextLayer, ShapeLayer) without the
// churn of newer versions. Bump this when AE adds APIs we want.

/// <reference path="../../node_modules/types-for-adobe/AfterEffects/24.0/index.d.ts" />

// Local type augmentations for APIs that types-for-adobe misses or under-types.
import './extendscript-shims';

export {};