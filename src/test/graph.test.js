import { describe, it, expect } from "vitest";
import {
  buildAdj, ancestors, descendants, hasEdge,
  allUndirectedPaths, isBackdoor, pathBlocked,
  classifyRoles, analyzeAdjustment, toDagitty,
  minimalAdjustmentSet, instrumentalVariables,
} from "../lib/graph.js";

// DAG semilla del módulo: tabaquismo (X) -> enf. coronaria (Y)
const NODES = [
  { id: "X" }, { id: "Y" }, { id: "AGE" }, { id: "FAM" }, { id: "HTA" }, { id: "HOSP" },
];
const EDGES = [
  { from: "AGE", to: "X" }, { from: "AGE", to: "Y" },
  { from: "FAM", to: "X" }, { from: "FAM", to: "Y" },
  { from: "X",   to: "HTA" }, { from: "HTA", to: "Y" },
  { from: "X",   to: "Y" },
  { from: "X",   to: "HOSP" }, { from: "Y", to: "HOSP" },
];

describe("graph básicos", () => {
  it("adyacencias entrantes/salientes", () => {
    const { out, inc } = buildAdj(NODES, EDGES);
    expect(out.X.sort()).toEqual(["HOSP", "HTA", "Y"]);
    expect(inc.Y.sort()).toEqual(["AGE", "FAM", "HTA", "X"]);
  });
  it("ancestros y descendientes", () => {
    const { out, inc } = buildAdj(NODES, EDGES);
    expect([...ancestors("Y", inc)].sort()).toEqual(["AGE", "FAM", "HTA", "X"]);
    expect([...descendants("X", out)].sort()).toEqual(["HOSP", "HTA", "Y"]);
  });
  it("hasEdge respeta dirección", () => {
    expect(hasEdge(EDGES, "X", "Y")).toBe(true);
    expect(hasEdge(EDGES, "Y", "X")).toBe(false);
  });
});

describe("clasificación de roles", () => {
  it("identifica confusores, mediador y colisionador", () => {
    const r = classifyRoles(NODES, EDGES, "X", "Y");
    expect(r.X).toBe("exposure");
    expect(r.Y).toBe("outcome");
    expect(r.AGE).toBe("confounder");
    expect(r.FAM).toBe("confounder");
    expect(r.HTA).toBe("mediator");
    expect(r.HOSP).toBe("collider");
  });
});

describe("trayectorias y puerta trasera", () => {
  it("la trayectoria X<-AGE->Y es puerta trasera", () => {
    const path = ["X", "AGE", "Y"];
    expect(isBackdoor(path, EDGES)).toBe(true);
  });
  it("la trayectoria X->HTA->Y NO es puerta trasera (sale por la frontera)", () => {
    const path = ["X", "HTA", "Y"];
    expect(isBackdoor(path, EDGES)).toBe(false);
  });
});

describe("d-separación", () => {
  const { out } = buildAdj(NODES, EDGES);
  it("condicionar AGE bloquea X<-AGE->Y (horquilla)", () => {
    expect(pathBlocked(["X", "AGE", "Y"], new Set(["AGE"]), EDGES, out)).toBe(true);
  });
  it("colisionador HOSP cerrado por defecto", () => {
    expect(pathBlocked(["X", "HOSP", "Y"], new Set(), EDGES, out)).toBe(true);
  });
  it("condicionar HOSP abre la trayectoria del colisionador", () => {
    expect(pathBlocked(["X", "HOSP", "Y"], new Set(["HOSP"]), EDGES, out)).toBe(false);
  });
});

describe("veredicto de identificabilidad", () => {
  it("{AGE, FAM} satisface el criterio de puerta trasera", () => {
    const a = analyzeAdjustment(NODES, EDGES, "X", "Y", new Set(["AGE", "FAM"]));
    expect(a.valid).toBe(true);
    expect(a.openBackdoor.length).toBe(0);
    expect(a.adjDescX.length).toBe(0);
  });
  it("ajustar por HTA (mediador) NO bloquea puerta trasera y mete descendiente de X", () => {
    const a = analyzeAdjustment(NODES, EDGES, "X", "Y", new Set(["HTA"]));
    expect(a.adjDescX).toContain("HTA");
    expect(a.valid).toBe(false);
  });
  it("recomienda los confusores AGE y FAM", () => {
    const a = analyzeAdjustment(NODES, EDGES, "X", "Y", new Set());
    expect(a.recommended.sort()).toEqual(["AGE", "FAM"]);
  });
  it("ajustar por HOSP (colisionador) induce sesgo de colisión", () => {
    const a = analyzeAdjustment(NODES, EDGES, "X", "Y", new Set(["AGE", "FAM", "HOSP"]));
    expect(a.openedColliders).toContain("HOSP");
    expect(a.valid).toBe(false);
  });
});

describe("conjunto de ajuste mínimo (Perković)", () => {
  it("devuelve {AGE, FAM} en el DAG semilla", () => {
    const m = minimalAdjustmentSet(NODES, EDGES, "X", "Y");
    expect(m.sort()).toEqual(["AGE", "FAM"]);
  });
});

describe("variables instrumentales", () => {
  // IV: Z -> X -> Y, U confunde a X-Y; Z no llega a Y salvo por X.
  const N2 = [{ id: "Z" }, { id: "X" }, { id: "Y" }, { id: "U" }];
  const E2 = [
    { from: "Z", to: "X" }, { from: "X", to: "Y" },
    { from: "U", to: "X" }, { from: "U", to: "Y" },
  ];
  it("identifica Z como IV cuando solo afecta a Y vía X", () => {
    const ivs = instrumentalVariables(N2, E2, "X", "Y");
    expect(ivs).toContain("Z");
    expect(ivs).not.toContain("U");
  });
  it("descarta IV si tiene arista directa a Y", () => {
    const E3 = [...E2, { from: "Z", to: "Y" }];
    const ivs = instrumentalVariables(N2, E3, "X", "Y");
    expect(ivs).not.toContain("Z");
  });
});

describe("export dagitty", () => {
  it("emite el bloque con [exposure] y [outcome]", () => {
    const txt = toDagitty(NODES.map((n) => ({ ...n, label: n.id })), EDGES, "X", "Y");
    expect(txt).toMatch(/"X" \[exposure\]/);
    expect(txt).toMatch(/"Y" \[outcome\]/);
    expect(txt).toMatch(/"X" -> "Y"/);
  });
});
