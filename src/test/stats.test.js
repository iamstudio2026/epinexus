import { describe, it, expect } from "vitest";
import { invNorm, twoByTwo, sampleSizeTwoProps, sampleSizePrevalence } from "../lib/stats.js";

describe("invNorm", () => {
  it("z_{0.975} ≈ 1.96", () => {
    expect(invNorm(0.975)).toBeCloseTo(1.96, 2);
  });
  it("z_{0.80} ≈ 0.8416", () => {
    expect(invNorm(0.80)).toBeCloseTo(0.8416, 3);
  });
});

describe("tabla 2×2", () => {
  // Ejemplo clásico: a=90 b=60 c=40 d=110 -> OR = 90*110 / (60*40) = 4.125
  const r = twoByTwo({ a: 90, b: 60, c: 40, d: 110 });
  it("OR correcto y dentro de su IC", () => {
    expect(r.or).toBeCloseTo(4.125, 3);
    expect(r.orL).toBeLessThan(r.or);
    expect(r.orH).toBeGreaterThan(r.or);
  });
  it("sensibilidad y especificidad", () => {
    expect(r.sens).toBeCloseTo(90 / (90 + 40), 4);
    expect(r.spec).toBeCloseTo(110 / (110 + 60), 4);
  });
});

describe("tamaño muestral", () => {
  it("dos proporciones devuelve entero positivo", () => {
    const n = sampleSizeTwoProps({ p1: 0.5, p2: 0.35, alpha: 0.05, power: 0.8 });
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(100);
    expect(n).toBeLessThan(300); // típicamente ~165–170
  });
  it("prevalencia con z≈1.96, p=0.5, d=0.05 -> ~385", () => {
    const n = sampleSizePrevalence({ p: 0.5, d: 0.05, conf: 0.95 });
    expect(n).toBe(385);
  });
});
