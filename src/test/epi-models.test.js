import { describe, it, expect } from "vitest";
import { seir, renalTrajectory, timeToDialysis, cca, amstarRating, credibilityClass, metaDL } from "../lib/epi-models.js";

describe("SEIR", () => {
  it("conserva la población total (S+E+I+R ≈ N) hasta tolerancia numérica", () => {
    const N = 100000;
    const rows = seir({ N, R0: 2.5, latent: 5, infectious: 7, I0: 10, days: 50 });
    const last = rows[rows.length - 1];
    const total = last.S + last.E + last.I + last.R;
    expect(Math.abs(total - N) / N).toBeLessThan(0.001); // ≤0.1%
  });
  it("R₀=0.5 no genera brote (tasa de ataque baja)", () => {
    const rows = seir({ N: 100000, R0: 0.5, latent: 5, infectious: 7, I0: 10, days: 200 });
    const last = rows[rows.length - 1];
    expect(last.R / 100000).toBeLessThan(0.05);
  });
});

describe("Gemelo renal", () => {
  it("la pendiente más negativa llega antes a diálisis", () => {
    const t1 = timeToDialysis({ egfr0: 60, slope: -5 });
    const t2 = timeToDialysis({ egfr0: 60, slope: -2 });
    expect(t1).toBeLessThan(t2);
  });
  it("pendiente positiva o cero no llega a diálisis", () => {
    expect(timeToDialysis({ egfr0: 60, slope: 0 })).toBeNull();
    expect(timeToDialysis({ egfr0: 60, slope: 0.5 })).toBeNull();
  });
  it("la trayectoria nunca es negativa", () => {
    const rows = renalTrajectory({ egfr0: 30, slopeCtrl: -5, slopeInt: -2, years: 15 });
    rows.forEach((r) => { expect(r.ctrl).toBeGreaterThanOrEqual(0); expect(r.int).toBeGreaterThanOrEqual(0); });
  });
});

describe("CCA de Pieper", () => {
  it("solapamiento nulo cuando las RS no comparten estudios", () => {
    const r = cca([{ studies: "A,B" }, { studies: "C,D" }]);
    // r = 4 distintos, c = 2, N = 4 -> (4 - 4)/(4*2 - 4) = 0
    expect(r.val).toBe(0);
    expect(r.lvl).toBe("Leve");
  });
  it("solapamiento total cuando todas las RS contienen los mismos estudios", () => {
    const r = cca([{ studies: "A,B" }, { studies: "A,B" }, { studies: "A,B" }]);
    // r = 2 distintos, c = 3, N = 6 -> (6 - 2)/(2*3 - 2) = 1.0 -> 100%
    expect(r.val).toBe(100);
    expect(r.lvl).toBe("Muy alto");
  });
});

describe("AMSTAR-2", () => {
  it("0 fallas críticas y pocas debilidades -> alta", () => {
    expect(amstarRating(0, 1).label).toBe("Confianza alta");
  });
  it("1 falla crítica -> baja", () => {
    expect(amstarRating(1, 0).label).toBe("Confianza baja");
  });
  it("≥2 fallas críticas -> críticamente baja", () => {
    expect(amstarRating(3, 0).label).toBe("Confianza críticamente baja");
  });
});

describe("meta-análisis DerSimonian-Laird", () => {
  it("efectos homogéneos: τ²≈0 e I²≈0, pooled ~ media ponderada", () => {
    const s = [
      { yi: 0.5, vi: 0.04 }, { yi: 0.5, vi: 0.04 }, { yi: 0.5, vi: 0.04 },
    ];
    const r = metaDL(s);
    expect(r.tau2).toBeCloseTo(0, 6);
    expect(r.I2).toBeCloseTo(0, 6);
    expect(r.pooled).toBeCloseTo(0.5, 6);
  });
  it("efectos heterogéneos: τ²>0 e I²>50%", () => {
    const s = [
      { yi: 0.2, vi: 0.02 }, { yi: 0.4, vi: 0.02 },
      { yi: 0.9, vi: 0.02 }, { yi: 1.1, vi: 0.02 },
    ];
    const r = metaDL(s);
    expect(r.tau2).toBeGreaterThan(0);
    expect(r.I2).toBeGreaterThan(50);
  });
  it("k<2 devuelve null", () => {
    expect(metaDL([{ yi: 0.1, vi: 0.01 }])).toBeNull();
  });
});

describe("clasificación de credibilidad", () => {
  it("p no significativo", () => {
    expect(credibilityClass({ cases: 5000, p: 0.2, i2: 30, largestSig: true, predNull: true, smallBias: false, excess: false }).cl).toMatch(/No significativo/);
  });
  it("Clase I con todas las condiciones", () => {
    expect(credibilityClass({ cases: 2000, p: 1e-8, i2: 30, largestSig: true, predNull: true, smallBias: false, excess: false }).cl).toMatch(/Clase I/);
  });
  it("Clase IV cuando los casos son pocos pese a p<0.05", () => {
    expect(credibilityClass({ cases: 200, p: 0.01, i2: 30, largestSig: true, predNull: false, smallBias: false, excess: false }).cl).toMatch(/Clase IV/);
  });
});
