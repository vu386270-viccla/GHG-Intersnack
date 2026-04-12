// ── Simple Linear Regression Engine ──────────────────────────
// Y = m*X + b   |   outlier removal: |residual| > 2σ

export interface DataPoint {
  x: number;   // RCN (MT)
  y: number;   // activity (kWh / tons / liters)
  label: string; // e.g. "2025-03"
  isOutlier?: boolean;
}

export interface RegressionResult {
  m: number;          // slope
  b: number;          // intercept
  r2: number;         // R² coefficient of determination
  rmse: number;       // Root Mean Square Error
  n: number;          // number of data points used (after outlier removal)
  outliers: number;   // number of points removed
  points: DataPoint[]; // all points, with isOutlier flag
  predict: (x: number) => number;
}

function linReg(pts: DataPoint[]): { m: number; b: number } {
  const n = pts.length;
  if (n < 2) return { m: 0, b: 0 };
  const sumX  = pts.reduce((s, p) => s + p.x, 0);
  const sumY  = pts.reduce((s, p) => s + p.y, 0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { m: 0, b: sumY / n };
  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;
  return { m, b };
}

function calcR2(pts: DataPoint[], m: number, b: number): number {
  const mean = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const ssTot = pts.reduce((s, p) => s + Math.pow(p.y - mean, 2), 0);
  const ssRes = pts.reduce((s, p) => s + Math.pow(p.y - (m * p.x + b), 2), 0);
  return ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
}

function calcRMSE(pts: DataPoint[], m: number, b: number): number {
  const mse = pts.reduce((s, p) => s + Math.pow(p.y - (m * p.x + b), 2), 0) / pts.length;
  return Math.sqrt(mse);
}

/**
 * Fit a linear regression on `allPoints`, automatically removing outliers
 * where |residual| > 2σ of the residual distribution.
 */
export function fitRegression(allPoints: DataPoint[]): RegressionResult {
  if (allPoints.length < 3) {
    return {
      m: 0, b: 0, r2: 0, rmse: 0, n: allPoints.length, outliers: 0,
      points: allPoints,
      predict: () => 0,
    };
  }

  // Step 1 — initial fit on all points
  const { m: m0, b: b0 } = linReg(allPoints);
  const residuals = allPoints.map(p => Math.abs(p.y - (m0 * p.x + b0)));
  const mean  = residuals.reduce((s, r) => s + r, 0) / residuals.length;
  const variance = residuals.reduce((s, r) => s + (r - mean) ** 2, 0) / residuals.length;
  const sigma = Math.sqrt(variance);
  const threshold = 2 * sigma;

  // Step 2 — tag outliers and refit
  const tagged: DataPoint[] = allPoints.map((p, i) => ({
    ...p,
    isOutlier: residuals[i] > threshold,
  }));
  const clean = tagged.filter(p => !p.isOutlier);

  if (clean.length < 2) {
    // All removed — fall back to unfiltered
    const r2 = calcR2(allPoints, m0, b0);
    return {
      m: m0, b: b0, r2, rmse: calcRMSE(allPoints, m0, b0),
      n: allPoints.length, outliers: 0,
      points: allPoints,
      predict: (x) => Math.max(0, m0 * x + b0),
    };
  }

  const { m, b } = linReg(clean);
  const r2   = calcR2(clean, m, b);
  const rmse = calcRMSE(clean, m, b);

  return {
    m, b, r2, rmse,
    n: clean.length,
    outliers: tagged.filter(p => p.isOutlier).length,
    points: tagged,
    predict: (x) => Math.max(0, m * x + b),
  };
}
