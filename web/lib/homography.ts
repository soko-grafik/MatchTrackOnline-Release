/**
 * Utility functions for 2D Football Pitch Homography & Coordinate Transformation.
 * Maps perspective-distorted camera coordinates to a standardized 2D football pitch (105m x 68m).
 */

export interface Point2D {
  x: number;
  y: number;
  ground_x?: number;
  ground_y?: number;
  team?: 'home' | 'away' | 'neutral' | string;
  tracker_id?: number;
  jersey_color?: string;
}

export interface TrackedPlayer {
  tracker_id: number;
  team: string;
  jersey_color: string;
  count: number;
  percentage: number;
  avg_x: number;
  avg_y: number;
}

export interface TeamSummary {
  id: 'home' | 'away';
  name: string;
  color: string;
  count: number;
  percentage: number;
}

export interface ZoneStats {
  total_points: number;
  thirds: {
    defensive: number; // 0% - 33.3% X
    midfield: number;  // 33.3% - 66.6% X
    attacking: number; // 66.6% - 100% X
  };
  channels: {
    left_flank: number;  // 0% - 33.3% Y (Top/Left sideline)
    center: number;      // 33.3% - 66.6% Y (Center lane)
    right_flank: number; // 66.6% - 100% Y (Bottom/Right sideline)
  };
  halves: {
    own_half: number;       // 0% - 50% X
    opponent_half: number;  // 50% - 100% X
  };
}

/**
 * Returns destination points on the standardized 2D pitch based on pitch type.
 * Standard coordinate space: X from 0 (Left Goal) to 1 (Right Goal), Y from 0 (Top sideline) to 1 (Bottom sideline).
 * Order: [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
 */
export function getDestinationCorners(pitchType: string = 'full'): Point2D[] {
  const pt = pitchType.toLowerCase();
  if (pt === 'half_left') {
    return [
      { x: 0.0, y: 0.0 },
      { x: 0.5, y: 0.0 },
      { x: 0.5, y: 1.0 },
      { x: 0.0, y: 1.0 }
    ];
  } else if (pt === 'half_right') {
    return [
      { x: 0.5, y: 0.0 },
      { x: 1.0, y: 0.0 },
      { x: 1.0, y: 1.0 },
      { x: 0.5, y: 1.0 }
    ];
  } else if (pt === 'penalty_box_left') {
    return [
      { x: 0.0, y: 0.22 },
      { x: 0.16, y: 0.22 },
      { x: 0.16, y: 0.78 },
      { x: 0.0, y: 0.78 }
    ];
  } else if (pt === 'penalty_box_right') {
    return [
      { x: 0.84, y: 0.22 },
      { x: 1.0, y: 0.22 },
      { x: 1.0, y: 0.78 },
      { x: 0.84, y: 0.78 }
    ];
  }
  // Full Pitch (Standard)
  return [
    { x: 0.0, y: 0.0 },
    { x: 1.0, y: 0.0 },
    { x: 1.0, y: 1.0 },
    { x: 0.0, y: 1.0 }
  ];
}

/**
 * Heckbert algorithm: computes the 3x3 projective transformation matrix
 * mapping the unit square (0..1)^2 to an arbitrary quad [p0, p1, p2, p3].
 * Matrix representation: row-major [m00, m01, m02, m10, m11, m12, m20, m21, m22]
 */
function squareToQuad(pts: Point2D[]): number[] {
  const p0 = pts[0];
  const p1 = pts[1];
  const p2 = pts[2];
  const p3 = pts[3];

  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sy = p0.y - p1.y + p2.y - p3.y;

  const det = dx1 * dy2 - dx2 * dy1;

  if (Math.abs(det) < 1e-8) {
    // Affine degenerate case
    return [
      p1.x - p0.x, p3.x - p0.x, p0.x,
      p1.y - p0.y, p3.y - p0.y, p0.y,
      0, 0, 1
    ];
  }

  const g = (sx * dy2 - sy * dx2) / det;
  const h = (dx1 * sy - dy1 * sx) / det;
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  const f = p0.y;

  return [
    a, b, c,
    d, e, f,
    g, h, 1
  ];
}

/**
 * Inverts a 3x3 matrix. Returns null if singular.
 */
export function invert3x3(m: number[]): number[] | null {
  const a = m[0], b = m[1], c = m[2];
  const d = m[3], e = m[4], f = m[5];
  const g = m[6], h = m[7], i = m[8];

  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;

  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;

  const invDet = 1.0 / det;
  return [
    A * invDet, D * invDet, G * invDet,
    B * invDet, E * invDet, H * invDet,
    C * invDet, F * invDet, I * invDet
  ];
}

/**
 * Multiplies two 3x3 matrices (A * B).
 */
function multiply3x3(a: number[], b: number[]): number[] {
  const res = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      res[r * 3 + c] =
        a[r * 3 + 0] * b[0 * 3 + c] +
        a[r * 3 + 1] * b[1 * 3 + c] +
        a[r * 3 + 2] * b[2 * 3 + c];
    }
  }
  return res;
}

/**
 * Computes forward homography matrix H mapping source video quad [src0..src3]
 * to target pitch coordinates [dst0..dst3].
 */
export function computeHomographyMatrix(src: Point2D[], pitchType: string = 'full'): number[] | null {
  if (!src || src.length < 4) return null;

  const sqToSrc = squareToQuad(src);
  const srcToSq = invert3x3(sqToSrc);
  if (!srcToSq) return null;

  const dst = getDestinationCorners(pitchType);
  const sqToDst = squareToQuad(dst);

  // H = sqToDst * srcToSq
  return multiply3x3(sqToDst, srcToSq);
}

/**
 * Projects a 2D source point (x, y) through the 3x3 homography matrix.
 */
export function projectPoint(h: number[], x: number, y: number): Point2D | null {
  const px = h[0] * x + h[1] * y + h[2];
  const py = h[3] * x + h[4] * y + h[5];
  const pw = h[6] * x + h[7] * y + h[8];

  if (Math.abs(pw) < 1e-7) return null;

  return {
    x: px / pw,
    y: py / pw
  };
}

/**
 * Calculates percentage breakdown for tactical thirds, flanks and halves.
 */
export function calculateZoneStats(pitchPoints: Point2D[]): ZoneStats {
  const total = pitchPoints.length;
  if (total === 0) {
    return {
      total_points: 0,
      thirds: { defensive: 33.3, midfield: 33.4, attacking: 33.3 },
      channels: { left_flank: 33.3, center: 33.4, right_flank: 33.3 },
      halves: { own_half: 50.0, opponent_half: 50.0 }
    };
  }

  let def = 0, mid = 0, att = 0;
  let left = 0, cen = 0, right = 0;
  let own = 0, opp = 0;

  for (let i = 0; i < total; i++) {
    const p = pitchPoints[i];
    // Thirds
    if (p.x < 0.333) def++;
    else if (p.x < 0.666) mid++;
    else att++;

    // Channels
    if (p.y < 0.333) left++;
    else if (p.y < 0.666) cen++;
    else right++;

    // Halves
    if (p.x < 0.5) own++;
    else opp++;
  }

  return {
    total_points: total,
    thirds: {
      defensive: Math.round((def / total) * 1000) / 10,
      midfield: Math.round((mid / total) * 1000) / 10,
      attacking: Math.round((att / total) * 1000) / 10
    },
    channels: {
      left_flank: Math.round((left / total) * 1000) / 10,
      center: Math.round((cen / total) * 1000) / 10,
      right_flank: Math.round((right / total) * 1000) / 10
    },
    halves: {
      own_half: Math.round((own / total) * 1000) / 10,
      opponent_half: Math.round((opp / total) * 1000) / 10
    }
  };
}
