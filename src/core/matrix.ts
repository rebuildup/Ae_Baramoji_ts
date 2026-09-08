// 3D rotation math used by the text decomposition algorithm.
//
// AE text layers can be 3D, so positioning each decomposed character layer
// requires composing rotation matrices. The original Baramoji_txt.jsx
// inlines these helpers; we extract them here for sharing with other
// entries.

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export type Matrix3x3 = [[number, number, number], [number, number, number], [number, number, number]];

/**
 * Convert a 3D rotation vector (degrees) into a rotation matrix.
 * Standard Euler-angle convention: rot = [xDeg, yDeg, zDeg].
 */
export function rotationToMatrix(rot: [number, number, number]): Matrix3x3 {
  const rx = degToRad(rot[0]);
  const ry = degToRad(rot[1]);
  const rz = degToRad(rot[2]);

  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);

  return [
    [cosY * cosZ, -cosY * sinZ, sinY],
    [sinX * sinY * cosZ + cosX * sinZ, -sinX * sinY * sinZ + cosX * cosZ, -sinX * cosY],
    [-cosX * sinY * cosZ + sinX * sinZ, cosX * sinY * sinZ + sinX * cosZ, cosX * cosY],
  ];
}

export function multiplyMatrix3x3(a: Matrix3x3, b: Matrix3x3): Matrix3x3 {
  const r: Matrix3x3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    }
  }
  return r;
}

export function applyMatrixToOffset(
  matrix: Matrix3x3,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  return [
    x * matrix[0][0] + y * matrix[0][1] + z * matrix[0][2],
    x * matrix[1][0] + y * matrix[1][1] + z * matrix[1][2],
    x * matrix[2][0] + y * matrix[2][1] + z * matrix[2][2],
  ];
}