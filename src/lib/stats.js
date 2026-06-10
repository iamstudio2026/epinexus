/** Inversa de la normal estándar (algoritmo de Acklam). */
export function invNorm(p) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425, ph = 1 - pl; let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p <= ph) {
    q = p - 0.5; r = q*q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
}

export const fmt = (x, n = 2) => (isFinite(x) ? Number(x).toFixed(n) : "—");

/** Medidas para tabla 2x2 (a=exp+enf+, b=exp+enf-, c=exp-enf+, d=exp-enf-). */
export function twoByTwo({ a, b, c, d }) {
  const or  = (a * d) / (b * c);
  const seOR = Math.sqrt(1/a + 1/b + 1/c + 1/d);
  const orL  = Math.exp(Math.log(or) - 1.96 * seOR);
  const orH  = Math.exp(Math.log(or) + 1.96 * seOR);
  const re = a / (a + b), ru = c / (c + d);
  const rr = re / ru;
  const seRR = Math.sqrt(1/a - 1/(a+b) + 1/c - 1/(c+d));
  const rrL  = Math.exp(Math.log(rr) - 1.96 * seRR);
  const rrH  = Math.exp(Math.log(rr) + 1.96 * seRR);
  const rd  = re - ru, nnt = 1 / Math.abs(rd);
  const sens = a / (a + c), spec = d / (b + d);
  const ppv  = a / (a + b), npv = d / (c + d);
  return { or, orL, orH, rr, rrL, rrH, rd, nnt, sens, spec, ppv, npv };
}

/** Tamaño muestral para comparar dos proporciones. Devuelve n por grupo. */
export function sampleSizeTwoProps({ p1, p2, alpha = 0.05, power = 0.8 }) {
  const za = invNorm(1 - alpha / 2);
  const zb = invNorm(power);
  const pbar = (p1 + p2) / 2;
  const n = Math.pow(za * Math.sqrt(2*pbar*(1-pbar)) + zb * Math.sqrt(p1*(1-p1)+p2*(1-p2)), 2)
          / Math.pow(p1 - p2, 2);
  return Math.ceil(n);
}

/** Tamaño muestral para estimar una prevalencia con precisión absoluta d. */
export function sampleSizePrevalence({ p, d, conf = 0.95 }) {
  const z = invNorm(1 - (1 - conf) / 2);
  return Math.ceil((z * z * p * (1 - p)) / (d * d));
}
