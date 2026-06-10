import React, { useState, useMemo } from "react";
import { Card, Slider, Kpi, Row } from "../components/ui.jsx";
import { fmt, twoByTwo, sampleSizeTwoProps, sampleSizePrevalence } from "../lib/stats.js";

export default function ToolsModule() {
  const [t, setT] = useState("pico");
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {[["pico", "PICO + ecuación"], ["twobytwo", "Tabla 2×2"], ["ss", "Tamaño muestral"]].map(([m, l]) => (
          <button key={m} onClick={() => setT(m)}
            className={`px-3 py-1.5 rounded-md text-xs ring-1 ${t === m ? "bg-cyan-500/15 ring-cyan-400/50 text-cyan-300" : "bg-slate-900 ring-slate-700 text-slate-300"}`}>
            {l}
          </button>
        ))}
      </div>
      {t === "pico" && <PicoTool />}
      {t === "twobytwo" && <TwoByTwoTool />}
      {t === "ss" && <SampleSizeTool />}
    </div>
  );
}

function PicoTool() {
  const [pico, setPico] = useState({ P: "adultos con ERC estadio 3", I: "inhibidores SGLT2", C: "placebo o cuidado estándar", O: "progresión a diálisis" });
  const set = (k, v) => setPico((s) => ({ ...s, [k]: v }));
  const eq = useMemo(() => {
    const cl = (s) => s.split(/\s+/).filter(Boolean);
    return {
      pubmed: `("${pico.P}"[tiab] OR ${cl(pico.P).join("[tiab] OR ")}[tiab]) AND ("${pico.I}"[tiab]) AND ("${pico.O}"[tiab])`,
      scopus: `TITLE-ABS-KEY("${pico.P}") AND TITLE-ABS-KEY("${pico.I}") AND TITLE-ABS-KEY("${pico.O}")`,
    };
  }, [pico]);
  return (
    <div className="max-w-3xl space-y-4">
      <Card title="Marco PICO / PECO">
        <div className="grid sm:grid-cols-2 gap-3">
          {[["P", "Población / Problema"], ["I", "Intervención / Exposición"], ["C", "Comparador"], ["O", "Desenlace (Outcome)"]].map(([k, l]) => (
            <div key={k}>
              <label className="text-[11px] text-slate-400">{l}</label>
              <input value={pico[k]} onChange={(e) => set(k, e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm mt-1" />
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800">
          <p className="text-sm text-slate-200">
            <span className="text-cyan-300">Pregunta:</span> En {pico.P}, ¿{pico.I} comparado con {pico.C} modifica {pico.O}?
          </p>
        </div>
      </Card>
      <Card title="Ecuaciones de búsqueda (borrador)">
        <p className="text-[11px] text-slate-400 mb-1">PubMed</p>
        <pre className="text-[11px] bg-slate-950 border border-slate-800 rounded p-2 whitespace-pre-wrap text-emerald-300 mb-3">{eq.pubmed}</pre>
        <p className="text-[11px] text-slate-400 mb-1">Scopus</p>
        <pre className="text-[11px] bg-slate-950 border border-slate-800 rounded p-2 whitespace-pre-wrap text-emerald-300">{eq.scopus}</pre>
        <p className="text-[10px] text-slate-500 mt-2">Borrador base: ajusta términos MeSH/Emtree, truncamientos y operadores de proximidad antes de ejecutar.</p>
      </Card>
    </div>
  );
}

function TwoByTwoTool() {
  const [c, setC] = useState({ a: 90, b: 60, c: 40, d: 110 });
  const set = (k, v) => setC((s) => ({ ...s, [k]: Math.max(0, +v || 0) }));
  const r = useMemo(() => twoByTwo(c), [c]);
  return (
    <div className="max-w-3xl grid md:grid-cols-2 gap-5">
      <Card title="Tabla 2×2">
        <div className="grid grid-cols-3 gap-1.5 text-center text-sm">
          <div></div>
          <div className="text-[11px] text-slate-400 py-1">Enf. +</div>
          <div className="text-[11px] text-slate-400 py-1">Enf. −</div>
          <div className="text-[11px] text-slate-400 flex items-center justify-end pr-1">Exp +</div>
          <input value={c.a} onChange={(e) => set("a", e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-center" />
          <input value={c.b} onChange={(e) => set("b", e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-center" />
          <div className="text-[11px] text-slate-400 flex items-center justify-end pr-1">Exp −</div>
          <input value={c.c} onChange={(e) => set("c", e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-center" />
          <input value={c.d} onChange={(e) => set("d", e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-center" />
        </div>
        <p className="text-[10px] text-slate-500 mt-3">Para uso diagnóstico: a=VP, b=FP, c=FN, d=VN.</p>
      </Card>
      <Card title="Medidas">
        <div className="space-y-1.5 text-sm">
          <Row k="OR" v={`${fmt(r.or)} (IC95% ${fmt(r.orL)}–${fmt(r.orH)})`} />
          <Row k="RR" v={`${fmt(r.rr)} (IC95% ${fmt(r.rrL)}–${fmt(r.rrH)})`} />
          <Row k="Diferencia de riesgo" v={fmt(r.rd * 100, 1) + " pp"} />
          <Row k="NNT/NNH" v={fmt(r.nnt, 1)} />
          <div className="h-px bg-slate-800 my-2" />
          <Row k="Sensibilidad"  v={fmt(r.sens * 100, 1) + "%"} />
          <Row k="Especificidad" v={fmt(r.spec * 100, 1) + "%"} />
          <Row k="VPP" v={fmt(r.ppv * 100, 1) + "%"} />
          <Row k="VPN" v={fmt(r.npv * 100, 1) + "%"} />
        </div>
      </Card>
    </div>
  );
}

function SampleSizeTool() {
  const [c, setC] = useState({ p1: 50, p2: 35, alpha: 5, power: 80, prev: 30, prec: 5, conf: 95 });
  const set = (k, v) => setC((s) => ({ ...s, [k]: +v || 0 }));
  const nTwo = useMemo(() => sampleSizeTwoProps({ p1: c.p1 / 100, p2: c.p2 / 100, alpha: c.alpha / 100, power: c.power / 100 }), [c]);
  const nPrev = useMemo(() => sampleSizePrevalence({ p: c.prev / 100, d: c.prec / 100, conf: c.conf / 100 }), [c]);
  return (
    <div className="max-w-3xl grid md:grid-cols-2 gap-5">
      <Card title="Comparación de dos proporciones">
        <Slider label="Proporción grupo 1 (%)" v={c.p1} min={1} max={99} step={1} on={(v) => set("p1", v)} />
        <Slider label="Proporción grupo 2 (%)" v={c.p2} min={1} max={99} step={1} on={(v) => set("p2", v)} />
        <Slider label="α (%)" v={c.alpha} min={1} max={10} step={1} on={(v) => set("alpha", v)} />
        <Slider label="Potencia (%)" v={c.power} min={70} max={99} step={1} on={(v) => set("power", v)} />
        <Kpi label="n por grupo" value={isFinite(nTwo) ? nTwo.toLocaleString() : "—"} hint={`total ${isFinite(nTwo) ? (nTwo * 2).toLocaleString() : "—"}`} />
      </Card>
      <Card title="Estimación de una prevalencia">
        <Slider label="Prevalencia esperada (%)" v={c.prev} min={1} max={99} step={1} on={(v) => set("prev", v)} />
        <Slider label="Precisión absoluta ± (%)" v={c.prec} min={1} max={15} step={0.5} on={(v) => set("prec", v)} />
        <Slider label="Confianza (%)" v={c.conf} min={80} max={99} step={1} on={(v) => set("conf", v)} />
        <Kpi label="Tamaño muestral" value={nPrev.toLocaleString()} hint="sin corrección por población finita" />
      </Card>
    </div>
  );
}
