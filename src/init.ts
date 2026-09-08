// ExtendScript ES3 polyfills.
//
// ExtendScript's JavaScript engine is based on ES3 and is missing several
// standard methods. Loading this file at the top of every entry guarantees
// those methods exist before any user code runs.
//
// Rollup inlines this into every output .jsx, so the polyfills are baked in
// without changing the runtime semantics of any later code.
//
// We use `any` here deliberately: TypeScript's lib knows about Array.prototype.indexOf etc.
// (because it's an ES5 type), but ExtendScript's runtime doesn't have them.
// The whole point of this file is to install them.

/* eslint-disable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line no-var
var ArrayProto: any = Array.prototype;
// eslint-disable-next-line no-var
var StringProto: any = String.prototype;

// Array.prototype.indexOf — ES5
if (typeof ArrayProto.indexOf !== 'function') {
  ArrayProto.indexOf = function (searchElement: any, fromIndex?: number): number {
    var start: number = fromIndex || 0;
    var len: number = this.length;
    if (start < 0) start = Math.max(len + start, 0);
    for (var i: number = start; i < len; i++) {
      if (this[i] === searchElement) return i;
    }
    return -1;
  };
}

// Array.prototype.forEach — ES5 (ExtendScript often ships this, but guard)
if (typeof ArrayProto.forEach !== 'function') {
  ArrayProto.forEach = function (callback: (v: any, i: number, a: any[]) => void, thisArg?: any): void {
    for (var i: number = 0; i < this.length; i++) {
      callback.call(thisArg, this[i], i, this);
    }
  };
}

// Array.prototype.map — ES5
if (typeof ArrayProto.map !== 'function') {
  ArrayProto.map = function (callback: (v: any, i: number, a: any[]) => any, thisArg?: any): any[] {
    var result: any[] = [];
    for (var i: number = 0; i < this.length; i++) {
      result.push(callback.call(thisArg, this[i], i, this));
    }
    return result;
  };
}

// Array.prototype.filter — ES5
if (typeof ArrayProto.filter !== 'function') {
  ArrayProto.filter = function (callback: (v: any, i: number, a: any[]) => boolean, thisArg?: any): any[] {
    var result: any[] = [];
    for (var i: number = 0; i < this.length; i++) {
      if (callback.call(thisArg, this[i], i, this)) result.push(this[i]);
    }
    return result;
  };
}

// String.prototype.trim — ES5
if (typeof StringProto.trim !== 'function') {
  StringProto.trim = function (): string {
    return this.replace(/^\s+|\s+$/g, '');
  };
}

// Object.keys — ES5
if (typeof (Object as any).keys !== 'function') {
  (Object as any).keys = function (obj: any): string[] {
    var keys: string[] = [];
    for (var k in obj) {
      if ((Object.prototype as any).hasOwnProperty.call(obj, k)) keys.push(k);
    }
    return keys;
  };
}

// Note: src/types/*.d.ts are picked up by tsconfig include, so no runtime
// import is needed (and .d.ts files don't generate runtime code anyway).