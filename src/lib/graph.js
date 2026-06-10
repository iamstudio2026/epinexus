/**
 * Utilidades de inferencia causal sobre DAGs.
 *
 * Convenciones:
 *  - nodes: [{ id, label, x, y }]
 *  - edges: [{ from, to }]
 *  - Z: Set<id> — conjunto de ajuste
 *
 * d-separación (resumen):
 *  - cadena/horquilla (no-colisionador): condicionar BLOQUEA.
 *  - colisionador: condicionarlo (o a un descendiente suyo) ABRE.
 */

export function buildAdj(nodes, edges) {
  const out = {}, inc = {};
  nodes.forEach((n) => { out[n.id] = []; inc[n.id] = []; });
  edges.forEach((e) => {
    if (out[e.from] && inc[e.to]) { out[e.from].push(e.to); inc[e.to].push(e.from); }
  });
  return { out, inc };
}

function reach(start, adjMap) {
  const seen = new Set(), stack = [start];
  while (stack.length) {
    const cur = stack.pop();
    (adjMap[cur] || []).forEach((nx) => {
      if (!seen.has(nx)) { seen.add(nx); stack.push(nx); }
    });
  }
  return seen; // no incluye start
}
export const descendants = (id, out) => reach(id, out);
export const ancestors   = (id, inc) => reach(id, inc);

export function hasEdge(edges, a, b) {
  return edges.some((e) => e.from === a && e.to === b);
}

/** Todas las trayectorias simples no dirigidas entre x e y. */
export function allUndirectedPaths(x, y, nodes, edges) {
  const neigh = {};
  nodes.forEach((n) => (neigh[n.id] = new Set()));
  edges.forEach((e) => { neigh[e.from].add(e.to); neigh[e.to].add(e.from); });
  const paths = [];
  (function dfs(cur, path, visited) {
    if (cur === y) { paths.push([...path]); return; }
    neigh[cur].forEach((nx) => {
      if (!visited.has(nx)) {
        visited.add(nx); path.push(nx);
        dfs(nx, path, visited);
        path.pop(); visited.delete(nx);
      }
    });
  })(x, [x], new Set([x]));
  return paths;
}

/** ¿La trayectoria sale de X por su "puerta trasera"? (1.ª flecha entra a X) */
export function isBackdoor(path, edges) {
  if (path.length < 2) return false;
  const x = path[0], n1 = path[1];
  return hasEdge(edges, n1, x);
}

/** ¿Está bloqueada la trayectoria dado Z? (d-separación) */
export function pathBlocked(path, Z, edges, out) {
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1], m = path[i], b = path[i + 1];
    const intoM_a = hasEdge(edges, a, m);
    const intoM_b = hasEdge(edges, b, m);
    const collider = intoM_a && intoM_b;
    const desc = descendants(m, out);
    const condOnColliderOrDesc = Z.has(m) || [...desc].some((d) => Z.has(d));
    if (collider) {
      if (!condOnColliderOrDesc) return true;
    } else {
      if (Z.has(m)) return true;
    }
  }
  return false;
}

/** Clasifica el rol de cada nodo respecto a (X, Y). */
export function classifyRoles(nodes, edges, X, Y) {
  const { out, inc } = buildAdj(nodes, edges);
  const ancX = ancestors(X, inc), ancY = ancestors(Y, inc);
  const descX = descendants(X, out), descY = descendants(Y, out);
  const map = {};
  nodes.forEach((n) => {
    if (n.id === X) return (map[n.id] = "exposure");
    if (n.id === Y) return (map[n.id] = "outcome");
    const mediator   = descX.has(n.id) && ancY.has(n.id);
    const confounder = ancX.has(n.id) && ancY.has(n.id);
    const collider   = descX.has(n.id) && descY.has(n.id);
    if (collider)        map[n.id] = "collider";
    else if (confounder) map[n.id] = "confounder";
    else if (mediator)   map[n.id] = "mediator";
    else if (descX.has(n.id)) map[n.id] = "descX";
    else map[n.id] = "neutral";
  });
  return map;
}

/** Analiza el conjunto de ajuste: identificabilidad, puertas traseras, sesgos. */
export function analyzeAdjustment(nodes, edges, X, Y, Z) {
  const { out } = buildAdj(nodes, edges);
  const roles = classifyRoles(nodes, edges, X, Y);
  const paths = allUndirectedPaths(X, Y, nodes, edges).filter((p) => p.length > 1);
  const backdoor = paths.filter((p) => isBackdoor(p, edges));
  const openBackdoor = backdoor.filter((p) => !pathBlocked(p, Z, edges, out));
  const openedColliders = [];
  paths.forEach((p) => {
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[i - 1], m = p[i], b = p[i + 1];
      if (hasEdge(edges, a, m) && hasEdge(edges, b, m)) {
        const desc = descendants(m, out);
        if (Z.has(m) || [...desc].some((d) => Z.has(d))) openedColliders.push(m);
      }
    }
  });
  const adjDescX = [...Z].filter((z) => descendants(X, out).has(z));
  const recommended = nodes.filter((n) => roles[n.id] === "confounder").map((n) => n.id);
  const valid = openBackdoor.length === 0 && adjDescX.length === 0;
  return { roles, paths, backdoor, openBackdoor, openedColliders: [...new Set(openedColliders)], adjDescX, recommended, valid };
}

/**
 * Conjunto de ajuste mínimo (heurística tipo Perković et al. 2018).
 * 1) Construye el conjunto canónico: ancestros(X) ∪ ancestros(Y), excluyendo
 *    {X, Y} y descendientes de X (forbidden set, evita mediadores y colisión).
 * 2) Greedy: intenta eliminar cada elemento; se queda solo si su eliminación
 *    rompe la validez por puerta trasera.
 * Devuelve el conjunto mínimo (Array<string>) o null si no hay identificación.
 */
export function minimalAdjustmentSet(nodes, edges, X, Y) {
  const { out, inc } = buildAdj(nodes, edges);
  const ancX = ancestors(X, inc), ancY = ancestors(Y, inc);
  const descX = descendants(X, out);
  const forbidden = new Set([X, Y, ...descX]);
  // Candidatos: ancestros de X o Y, no en forbidden.
  const cand = nodes
    .map((n) => n.id)
    .filter((id) => !forbidden.has(id) && (ancX.has(id) || ancY.has(id)));
  // Comprobación: ¿el set Z bloquea todas las puertas traseras?
  const validZ = (Z) => {
    const a = analyzeAdjustment(nodes, edges, X, Y, Z);
    return a.openBackdoor.length === 0 && a.adjDescX.length === 0 && a.openedColliders.length === 0;
  };
  let Z = new Set(cand);
  if (!validZ(Z)) return null;
  // Greedy: ordena por nº de trayectorias en las que aparece (los más "centrales" se prueban al final).
  for (const id of [...cand]) {
    const trial = new Set(Z); trial.delete(id);
    if (validZ(trial)) Z = trial;
  }
  return [...Z];
}

/**
 * Variables instrumentales candidatas para el efecto X→Y.
 * Heurística: I es un IV si (i) I→X o existe trayectoria dirigida I→…→X,
 * (ii) NO existe arista directa I→Y, (iii) toda trayectoria de I a Y queda
 * bloqueada si condicionamos en X (no hay puerta trasera I—Y).
 */
export function instrumentalVariables(nodes, edges, X, Y) {
  const { out } = buildAdj(nodes, edges);
  // DAG modificado G_X̄: eliminamos las aristas SALIENTES de X.
  const edgesNoOutX = edges.filter((e) => e.from !== X);
  const { out: outMod } = buildAdj(nodes, edgesNoOutX);
  const ivs = [];
  for (const n of nodes) {
    const id = n.id;
    if (id === X || id === Y) continue;
    // (i) Z afecta a X: existe trayectoria dirigida Z→…→X en el DAG original.
    if (!descendants(id, out).has(X)) continue;
    // (ii) Z y Y d-separados en G_X̄ con W=∅ (sin condicionar).
    const paths = allUndirectedPaths(id, Y, nodes, edgesNoOutX).filter((p) => p.length > 1);
    if (paths.length === 0) { ivs.push(id); continue; }
    const allBlocked = paths.every((p) => pathBlocked(p, new Set(), edgesNoOutX, outMod));
    if (allBlocked) ivs.push(id);
  }
  return ivs;
}

/** Exporta el DAG a sintaxis dagitty (texto). */
export function toDagitty(nodes, edges, X, Y) {
  const lines = ["dag {"];
  nodes.forEach((n) => {
    const tag = n.id === X ? ' [exposure]' : n.id === Y ? ' [outcome]' : '';
    lines.push(`  "${n.label || n.id}"${tag}`);
  });
  edges.forEach((e) => {
    const a = nodes.find((n) => n.id === e.from)?.label || e.from;
    const b = nodes.find((n) => n.id === e.to)?.label || e.to;
    lines.push(`  "${a}" -> "${b}"`);
  });
  lines.push("}");
  return lines.join("\n");
}
