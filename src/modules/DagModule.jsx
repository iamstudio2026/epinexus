import React, { useState, useRef, useMemo } from "react";
import { Plus, Trash2, Link2, MousePointer, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, Stat } from "../components/ui.jsx";
import { analyzeAdjustment, hasEdge, descendants, buildAdj, toDagitty, minimalAdjustmentSet, instrumentalVariables } from "../lib/graph.js";
import { exportSvg, exportSvgAsPng } from "../lib/exporters.js";
import { useProject } from "../components/ProjectContext.jsx";
import { saveDag, supabaseEnabled } from "../lib/supabase.js";

const ROLE_COLOR = {
  exposure: "#22d3ee", outcome: "#a78bfa", confounder: "#fbbf24",
  mediator: "#38bdf8", collider: "#fb7185", descX: "#fb923c", neutral: "#94a3b8",
};
const ROLE_ES = {
  exposure: "Exposición (X)", outcome: "Desenlace (Y)", confounder: "Confusor (causa común)",
  mediator: "Mediador (vía causal)", collider: "Colisionador (efecto común)",
  descX: "Descendiente de X", neutral: "Covariable",
};

const SEED_NODES = [
  { id: "X",    label: "Tabaquismo",     x: 180, y: 300 },
  { id: "Y",    label: "Enf. coronaria", x: 620, y: 300 },
  { id: "AGE",  label: "Edad",           x: 250, y:  90 },
  { id: "FAM",  label: "Antec. familiar",x: 550, y:  90 },
  { id: "HTA",  label: "Hipertensión",   x: 400, y: 230 },
  { id: "HOSP", label: "Hospitalización",x: 400, y: 440 },
];
const SEED_EDGES = [
  { from: "AGE", to: "X" }, { from: "AGE", to: "Y" },
  { from: "FAM", to: "X" }, { from: "FAM", to: "Y" },
  { from: "X", to: "HTA" }, { from: "HTA", to: "Y" },
  { from: "X", to: "Y" },
  { from: "X", to: "HOSP" }, { from: "Y", to: "HOSP" },
];

export default function DagModule() {
  const [nodes, setNodes] = useState(SEED_NODES);
  const [edges, setEdges] = useState(SEED_EDGES);
  const [X, setX] = useState("X");
  const [Y, setY] = useState("Y");
  const [Z, setZ] = useState(new Set(["AGE", "FAM"]));
  const [mode, setMode] = useState("move");
  const [connectFrom, setConnectFrom] = useState(null);
  const [sel, setSel] = useState(null);
  const svgRef = useRef(null);
  const drag = useRef(null);

  const analysis = useMemo(() => analyzeAdjustment(nodes, edges, X, Y, Z), [nodes, edges, X, Y, Z]);
  const roles = analysis.roles;
  const minSet = useMemo(() => minimalAdjustmentSet(nodes, edges, X, Y), [nodes, edges, X, Y]);
  const ivs    = useMemo(() => instrumentalVariables(nodes, edges, X, Y), [nodes, edges, X, Y]);
  const { current, enabled } = useProject();
  const label = (id) => nodes.find((n) => n.id === id)?.label || id;

  const svgPoint = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (800 / r.width), y: (e.clientY - r.top) * (520 / r.height) };
  };
  const onNodeDown = (e, id) => {
    e.stopPropagation();
    if (mode === "delete") {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((x) => x.from !== id && x.to !== id));
      return;
    }
    if (mode === "connect") {
      if (!connectFrom) setConnectFrom(id);
      else {
        if (connectFrom !== id && !hasEdge(edges, connectFrom, id))
          setEdges((es) => [...es, { from: connectFrom, to: id }]);
        setConnectFrom(null);
      }
      return;
    }
    setSel(id);
    if (mode === "move") {
      const p = svgPoint(e); const n = nodes.find((x) => x.id === id);
      drag.current = { id, dx: p.x - n.x, dy: p.y - n.y };
    }
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const p = svgPoint(e);
    setNodes((ns) => ns.map((n) => n.id === drag.current.id ? { ...n, x: p.x - drag.current.dx, y: p.y - drag.current.dy } : n));
  };
  const onUp = () => (drag.current = null);
  const onCanvas = (e) => {
    if (mode !== "add") return;
    const p = svgPoint(e);
    const id = "N" + Date.now().toString().slice(-5);
    setNodes((ns) => [...ns, { id, label: "Nueva", x: p.x, y: p.y }]);
    setSel(id);
  };
  const toggleZ = (id) => setZ((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const exportDagitty = () => {
    const txt = toDagitty(nodes, edges, X, Y);
    navigator.clipboard?.writeText(txt);
    alert("Sintaxis dagitty copiada al portapapeles.\n\n" + txt);
  };
  const saveToProject = async () => {
    if (!enabled || !current) return alert("Conecta Supabase y elige un proyecto.");
    try {
      await saveDag({ project_id: current.id, name: `${label(X)} → ${label(Y)}`,
        exposure: X, outcome: Y, nodes, edges, adjustment_set: [...Z], notes: "" });
      alert("DAG guardado en proyecto «" + current.name + "».");
    } catch (e) { alert("Error: " + e.message); }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-5">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {[["move", "Mover", MousePointer], ["add", "Nodo", Plus], ["connect", "Conectar", Link2], ["delete", "Borrar", Trash2]].map(([m, l, Ic]) => (
            <button key={m} onClick={() => { setMode(m); setConnectFrom(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs ring-1 ${mode === m ? "bg-cyan-500/15 ring-cyan-400/50 text-cyan-300" : "bg-slate-900 ring-slate-700 text-slate-300 hover:ring-slate-500"}`}>
              <Ic className="w-3.5 h-3.5" />{l}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button onClick={exportDagitty} className="text-xs px-3 py-1.5 rounded-md ring-1 ring-slate-700 text-slate-300 hover:ring-slate-500">dagitty</button>
            <button onClick={() => exportSvg(svgRef.current, "dag.svg")} className="text-xs px-3 py-1.5 rounded-md ring-1 ring-slate-700 text-slate-300 hover:ring-slate-500">SVG</button>
            <button onClick={() => exportSvgAsPng(svgRef.current, "dag.png")} className="text-xs px-3 py-1.5 rounded-md ring-1 ring-slate-700 text-slate-300 hover:ring-slate-500">PNG</button>
            {supabaseEnabled && (
              <button onClick={saveToProject} className="text-xs px-3 py-1.5 rounded-md bg-cyan-500/15 ring-1 ring-cyan-400/40 text-cyan-300">Guardar</button>
            )}
          </div>
          {connectFrom && <span className="text-xs text-cyan-300 w-full">Origen: {label(connectFrom)} → elige destino</span>}
        </div>
        <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden">
          <svg ref={svgRef} viewBox="0 0 800 520" className="w-full touch-none select-none"
            onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onClick={onCanvas}
            style={{ cursor: mode === "add" ? "crosshair" : "default" }}>
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L9,3 L0,6 Z" fill="#64748b" />
              </marker>
              <marker id="arrowHi" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L9,3 L0,6 Z" fill="#fbbf24" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const a = nodes.find((n) => n.id === e.from), b = nodes.find((n) => n.id === e.to);
              if (!a || !b) return null;
              const onOpen = analysis.openBackdoor.some((p) => {
                for (let k = 0; k < p.length - 1; k++)
                  if ((p[k] === e.from && p[k + 1] === e.to) || (p[k] === e.to && p[k + 1] === e.from)) return true;
                return false;
              });
              const ang = Math.atan2(b.y - a.y, b.x - a.x);
              const r1 = 34, r2 = 40;
              const x1 = a.x + r1 * Math.cos(ang), y1 = a.y + r1 * Math.sin(ang);
              const x2 = b.x - r2 * Math.cos(ang), y2 = b.y - r2 * Math.sin(ang);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={onOpen ? "#fbbf24" : "#475569"} strokeWidth={onOpen ? 2.4 : 1.6}
                strokeDasharray={onOpen ? "6 4" : "0"} markerEnd={`url(#${onOpen ? "arrowHi" : "arrow"})`} />;
            })}
            {nodes.map((n) => {
              const role = roles[n.id], col = ROLE_COLOR[role];
              const adj = Z.has(n.id);
              return (
                <g key={n.id} onPointerDown={(e) => onNodeDown(e, n.id)} style={{ cursor: "pointer" }}>
                  <circle cx={n.x} cy={n.y} r="34" fill={`${col}22`} stroke={col} strokeWidth={sel === n.id ? 3 : 2} />
                  {adj && <circle cx={n.x} cy={n.y} r="40" fill="none" stroke={col} strokeWidth="1.5" strokeDasharray="3 3" />}
                  <text x={n.x} y={n.y - 1} textAnchor="middle" fontSize="11" fontWeight="600" fill="#e2e8f0">
                    {n.label.length > 11 ? n.label.slice(0, 10) + "…" : n.label}
                  </text>
                  <text x={n.x} y={n.y + 12} textAnchor="middle" fontSize="8" fill={col}>
                    {n.id === X ? "X" : n.id === Y ? "Y" : role === "confounder" ? "confusor" : role === "mediator" ? "mediador" : role === "collider" ? "colisión" : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-400">
          {Object.entries(ROLE_ES).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: ROLE_COLOR[k] }} />{v}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block" style={{ background: "#fbbf24" }} />puerta trasera abierta
          </span>
        </div>
      </div>

      <aside className="space-y-4">
        {sel && (
          <Card title={`Nodo: ${label(sel)}`}>
            <input value={label(sel)} onChange={(e) => setNodes((ns) => ns.map((n) => n.id === sel ? { ...n, label: e.target.value } : n))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm mb-2" />
            <div className="flex gap-2">
              <button onClick={() => setX(sel)} className="flex-1 text-xs py-1.5 rounded bg-cyan-500/15 ring-1 ring-cyan-400/40 text-cyan-300">Marcar X</button>
              <button onClick={() => setY(sel)} className="flex-1 text-xs py-1.5 rounded bg-violet-500/15 ring-1 ring-violet-400/40 text-violet-300">Marcar Y</button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Rol calculado: <span style={{ color: ROLE_COLOR[roles[sel]] }}>{ROLE_ES[roles[sel]]}</span>
            </p>
          </Card>
        )}

        <Card title="Conjunto de ajuste (Z)">
          <p className="text-[11px] text-slate-400 mb-2">Selecciona las covariables a controlar:</p>
          <div className="space-y-1.5 max-h-44 overflow-auto pr-1">
            {nodes.filter((n) => n.id !== X && n.id !== Y).map((n) => (
              <label key={n.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={Z.has(n.id)} onChange={() => toggleZ(n.id)} className="accent-cyan-400" />
                <span className="w-2 h-2 rounded-full" style={{ background: ROLE_COLOR[roles[n.id]] }} />
                {n.label}
              </label>
            ))}
          </div>
        </Card>

        <Card title="Veredicto del criterio de puerta trasera">
          {analysis.valid ? (
            <div className="flex items-start gap-2 text-emerald-300 text-sm">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>El conjunto Z identifica el efecto causal: bloquea todas las trayectorias de puerta trasera y no incluye descendientes de X.</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-amber-300 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>El conjunto Z aún no es suficiente para identificación insesgada.</span>
            </div>
          )}
          <div className="mt-3 space-y-2 text-[11px]">
            <Stat ok={analysis.openBackdoor.length === 0} label={`Puertas traseras abiertas: ${analysis.openBackdoor.length}`} />
            {analysis.openBackdoor.map((p, i) => (
              <div key={i} className="pl-5 text-amber-400/90">{p.map(label).join(" — ")}</div>
            ))}
            <Stat ok={analysis.adjDescX.length === 0} label={`Descendientes de X en Z: ${analysis.adjDescX.length}`}
              detail={analysis.adjDescX.map(label).join(", ")} />
            <Stat ok={analysis.openedColliders.length === 0} label={`Sesgo de colisión inducido: ${analysis.openedColliders.length}`}
              detail={analysis.openedColliders.map(label).join(", ")} />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800">
            <p className="text-[11px] text-slate-400">Conjunto mínimo (Perković, greedy):</p>
            <p className="text-sm text-cyan-300">{minSet === null ? "no identificable" : (minSet.length ? minSet.map(label).join(", ") : "vacío (no se requieren ajustes)")}</p>
            {minSet !== null && (
              <button onClick={() => setZ(new Set(minSet))}
                className="mt-2 text-xs px-2.5 py-1 rounded bg-cyan-500/15 ring-1 ring-cyan-400/40 text-cyan-300">
                Aplicar mínimo
              </button>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800">
            <p className="text-[11px] text-slate-400">Variables instrumentales candidatas:</p>
            <p className="text-sm text-violet-300">{ivs.length ? ivs.map(label).join(", ") : "ninguna detectada"}</p>
            <p className="text-[10px] text-slate-500 mt-1">Heurística: I→…→X, sin arista directa I→Y y sin puerta trasera I–Y al condicionar en X.</p>
          </div>
        </Card>
      </aside>
    </div>
  );
}
