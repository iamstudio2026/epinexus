/** SEIR con intervención no farmacológica (Euler, dt=0.25). */
export function seir({ N, R0, latent, infectious, I0, days, npi = 0, npiDay = 0 }) {
  const sigma = 1 / latent, gamma = 1 / infectious, beta0 = R0 * gamma;
  let S = N - I0, E = 0, I = I0, R = 0;
  const dt = 0.25; const rows = [];
  for (let t = 0; t <= days; t += dt) {
    const beta = t >= npiDay ? beta0 * (1 - npi / 100) : beta0;
    const newE = (beta * S * I) / N, newI = sigma * E, newR = gamma * I;
    S -= newE * dt; E += (newE - newI) * dt; I += (newI - newR) * dt; R += newR * dt;
    if (Math.abs(t - Math.round(t)) < 1e-9) {
      rows.push({ t: Math.round(t), S: Math.round(S), E: Math.round(E), I: Math.round(I), R: Math.round(R) });
    }
  }
  return rows;
}

/** Trayectoria lineal de TFGe (eGFR) en años. */
export function renalTrajectory({ egfr0, slopeCtrl, slopeInt, years }) {
  const rows = [];
  for (let y = 0; y <= years; y++) {
    rows.push({
      y,
      ctrl: Math.max(0, +(egfr0 + slopeCtrl * y).toFixed(1)),
      int:  Math.max(0, +(egfr0 + slopeInt  * y).toFixed(1)),
    });
  }
  return rows;
}

/** Tiempo (años) hasta alcanzar el umbral (15 mL/min por defecto). */
export function timeToDialysis({ egfr0, slope, dialysisAt = 15, horizon = Infinity }) {
  if (slope >= 0) return null;
  const t = (egfr0 - dialysisAt) / -slope;
  return t > 0 && t <= horizon ? t : null;
}

/**
 * Corrected Covered Area (Pieper) entre revisiones sistemáticas.
 * reviews: [{ studies: "S1,S2,...", ... }]
 */
export function cca(reviews) {
  const sets = reviews.map((r) => r.studies.split(",").map((s) => s.trim()).filter(Boolean));
  const distinct = new Set(sets.flat());
  const r = distinct.size, c = reviews.length, N = sets.reduce((a, s) => a + s.length, 0);
  if (r === 0 || c === 0 || r * c - r === 0) return { val: 0, r, c, N, lvl: "—" };
  const val = ((N - r) / (r * c - r)) * 100;
  const lvl = val <= 5 ? "Leve" : val <= 10 ? "Moderado" : val <= 15 ? "Alto" : "Muy alto";
  return { val, r, c, N, lvl };
}

/** Veredicto AMSTAR-2 simplificado por nº de fallas críticas y debilidades. */
export function amstarRating(critFlaws, nonCrit) {
  if (critFlaws >= 2) return { label: "Confianza críticamente baja", color: "#fb7185" };
  if (critFlaws === 1) return { label: "Confianza baja", color: "#fb923c" };
  if (nonCrit > 1)    return { label: "Confianza moderada", color: "#fbbf24" };
  return { label: "Confianza alta", color: "#34d399" };
}

/**
 * Meta-análisis de efectos aleatorios (DerSimonian-Laird).
 * Entrada: studies = [{ yi, vi, n? }] con yi = efecto (log OR/RR o media) y vi = varianza intra-estudio.
 * Devuelve: pooled, se, ci95, Q, df, p, I², tau², intervalo de predicción 95%, pesos.
 *
 * Fórmulas:
 *   wi(FE) = 1/vi
 *   pooled_FE = Σ wi·yi / Σ wi
 *   Q = Σ wi·(yi − pooled_FE)²
 *   df = k − 1
 *   C  = Σ wi − Σ wi² / Σ wi
 *   τ² = max(0, (Q − df)/C)
 *   wi*= 1/(vi + τ²)
 *   pooled = Σ wi*·yi / Σ wi*; SE = 1/√Σ wi*
 *   IC95 = pooled ± 1.96·SE
 *   I²   = max(0, (Q − df)/Q)·100
 *   IP95 = pooled ± t(df, .975)·√(τ² + SE²)   (aprox. con z para df≥30)
 */
export function metaDL(studies) {
  const k = studies.length;
  if (k < 2) return null;
  const w = studies.map((s) => 1 / s.vi);
  const sumW = w.reduce((a, b) => a + b, 0);
  const fe = studies.reduce((a, s, i) => a + w[i] * s.yi, 0) / sumW;
  const Q  = studies.reduce((a, s, i) => a + w[i] * (s.yi - fe) ** 2, 0);
  const df = k - 1;
  const sumW2 = w.reduce((a, b) => a + b * b, 0);
  const C  = sumW - sumW2 / sumW;
  const tau2 = C > 0 ? Math.max(0, (Q - df) / C) : 0;
  const wStar = studies.map((s) => 1 / (s.vi + tau2));
  const sumWs = wStar.reduce((a, b) => a + b, 0);
  const pooled = studies.reduce((a, s, i) => a + wStar[i] * s.yi, 0) / sumWs;
  const se = 1 / Math.sqrt(sumWs);
  const z = 1.959963984540054;
  const ci = [pooled - z * se, pooled + z * se];
  const I2 = Q > df ? ((Q - df) / Q) * 100 : 0;
  // p-valor del efecto agrupado (z-test)
  const pPooled = 2 * (1 - normCdf(Math.abs(pooled / se)));
  // p del Q (χ² con df gl) — aproximación de Wilson-Hilferty
  const pQ = 1 - chi2Cdf(Q, df);
  // intervalo de predicción (aprox. con t≈2 para k pequeño, z para k grande)
  const tCrit = df >= 30 ? z : 2.0;
  const sePred = Math.sqrt(tau2 + se * se);
  const predInt = [pooled - tCrit * sePred, pooled + tCrit * sePred];
  return { k, pooled, se, ci, Q, df, pQ, pPooled, I2, tau2, predInt, weights: wStar.map((x) => x / sumWs) };
}

// CDF normal estándar (Abramowitz & Stegun 26.2.17, error < 7.5e-8)
function normCdf(x) {
  const b1 = 0.319381530, b2 = -0.356563782, b3 = 1.781477937,
        b4 = -1.821255978, b5 = 1.330274429, p = 0.2316419, c = 0.3989422804014327;
  const ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const f = c * Math.exp(-ax * ax / 2);
  const phi = 1 - f * (b1 * t + b2 * t ** 2 + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5);
  return x >= 0 ? phi : 1 - phi;
}
// Aproximación Wilson-Hilferty para χ² CDF (decente para df ≥ 1).
function chi2Cdf(x, df) {
  if (x <= 0) return 0;
  const z = (Math.cbrt(x / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return normCdf(z);
}

/**
 * Clasificación de credibilidad (Ioannidis / Fusar-Poli) para revisión paraguas.
 * Devuelve clase y color.
 */
export function credibilityClass({ cases, p, i2, largestSig, predNull, smallBias, excess }) {
  if (p >= 0.05) return { cl: "No significativo", col: "#64748b" };
  if (cases > 1000 && p < 1e-6 && i2 < 50 && predNull && !smallBias && !excess && largestSig)
    return { cl: "Clase I — Convincente", col: "#34d399" };
  if (cases > 1000 && p < 1e-6 && largestSig)
    return { cl: "Clase II — Altamente sugestiva", col: "#38bdf8" };
  if (cases > 1000 && p < 1e-3)
    return { cl: "Clase III — Sugestiva", col: "#fbbf24" };
  return { cl: "Clase IV — Débil", col: "#fb923c" };
}
