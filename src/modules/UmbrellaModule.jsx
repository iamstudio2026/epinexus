import React, { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, Slider, Kpi } from "../components/ui.jsx";
import { fmt } from "../lib/stats.js";
import { cca, amstarRating, credibilityClass, metaDL } from "../lib/epi-models.js";
import { exportUmbrellaExcel } from "../lib/exporters.js";
import { useProject } from "../components/ProjectContext.jsx";
import { saveUmbrella, supabaseEnabled } from "../lib/supabase.js";

export default function UmbrellaModule() {
  const [reviews, setReviews] = useState([
    { id: 1, name: "RS-A (2021)", studies: "S1,S2,S3,S4,S5", critFlaws: 0, nonCrit: 1 },
    { id: 2, name: "RS-B (2022)", studies: "S3,S4,S5,S6,S7", critFlaws: 1, nonCrit: 0 },
    { id: 3, name: "RS-C (2023)", studies: "S1,S5,S6,S8",    critFlaws: 0, nonCrit: 3 },
  ]);
  const add = () => setReviews((r) => [...r, { id: Date.now(), name: "RS nueva", studies: "", critFlaws: 0, nonCrit: 0 }]);
  const upd = (id, k, v) => setReviews((r) => r.map((x) => x.id === id ? { ...x, [k]: v } : x));
  const del = (id) => setReviews((r) => r.filter((x) => x.id !== id));

  const ccaRes = useMemo(() => cca(reviews), [reviews]);

  const [cred, setCred] = useState({ cases: 1500, p: 1e-7, i2: 35, largestSig: true, predNull: true, smallBias: false, excess: false });
  const credCl = useMemo(() => credibilityClass(cred), [cred]);
  const setC = (k, v) => setCred((s) => ({ ...s, [k]: v }));

  // ----- Meta-análisis DerSimonian-Laird (log OR e IC95% por estudio) -----
  const [metaStudies, setMetaStudies] = useState([
    { id: 1, name: "Estudio 1", logOR: 0.40, seLogOR: 0.15 },
    { id: 2, name: "Estudio 2", logOR: 0.32, seLogOR: 0.18 },
    { id: 3, name: "Estudio 3", logOR: 0.55, seLogOR: 0.20 },
    { id: 4, name: "Estudio 4", logOR: 0.10, seLogOR: 0.25 },
  ]);
  const meta = useMemo(() => metaDL(metaStudies.map((s) => ({ yi: +s.logOR, vi: (+s.seLogOR) ** 2 }))), [metaStudies]);
  const addStudy = () => setMetaStudies((m) => [...m, { id: Date.now(), name: "Nuevo", logOR: 0, seLogOR: 0.2 }]);
  const updStudy = (id, k, v) => setMetaStudies((m) => m.map((s) => s.id === id ? { ...s, [k]: v } : s));
  const delStudy = (id) => setMetaStudies((m) => m.filter((s) => s.id !== id));

  // ----- Persistencia opcional -----
  const { current, enabled } = useProject();
  const save = async () => {
    if (!enabled || !current) return alert("Conecta Supabase y elige un proyecto.");
    try {
      await saveUmbrella({
        project_id: current.id,
        question: "Revisión paraguas",
        pico: {},
        cca_value: ccaRes.val,
        cca_level: ccaRes.lvl,
        credibility: { ...cred, class: credCl.cl, meta: meta && { pooled: meta.pooled, I2: meta.I2, tau2: meta.tau2 } },
      });
      alert("Guardado en proyecto «" + current.name + "».");
    } catch (e) { alert("Error: " + e.message); }
  };

  const onExport = () => exportUmbrellaExcel({ reviews, cca: ccaRes, meta, credibility: { ...cred, class: credCl.cl } });

  return (
    <div className="space-y-5">
    <div className="flex flex-wrap gap-2 justify-end">
      <button onClick={onExport} className="text-xs px-3 py-1.5 rounded-md ring-1 ring-slate-700 text-slate-300 hover:ring-slate-500">
        Exportar a Excel
      </button>
      {supabaseEnabled && (
        <button onClick={save} className="text-xs px-3 py-1.5 rounded-md bg-cyan-500/15 ring-1 ring-cyan-400/40 text-cyan-300">
          Guardar en proyecto
        </button>
      )}
    </div>
    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Revisiones incluidas y solapamiento (CCA)">
        <div className="space-y-2 mb-3">
          {reviews.map((r) => {
            const am = amstarRating(r.critFlaws, r.nonCrit);
            return (
              <div key={r.id} className="border border-slate-800 rounded-lg p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <input value={r.name} onChange={(e) => upd(r.id, "name", e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs flex-1" />
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: am.color + "22", color: am.color }}>{am.label}</span>
                  <button onClick={() => del(r.id)} className="text-slate-500 hover:text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input value={r.studies} onChange={(e) => upd(r.id, "studies", e.target.value)}
                  placeholder="IDs estudios: S1,S2,S3"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs mb-1.5" />
                <div className="flex gap-3 text-[11px] text-slate-400">
                  <label className="flex items-center gap-1">Fallas críticas
                    <input type="number" min={0} max={7} value={r.critFlaws} onChange={(e) => upd(r.id, "critFlaws", +e.target.value)}
                      className="w-12 bg-slate-950 border border-slate-700 rounded px-1" />
                  </label>
                  <label className="flex items-center gap-1">Debilidades
                    <input type="number" min={0} max={9} value={r.nonCrit} onChange={(e) => upd(r.id, "nonCrit", +e.target.value)}
                      className="w-12 bg-slate-950 border border-slate-700 rounded px-1" />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={add} className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 mb-4">
          <Plus className="w-3.5 h-3.5" />Agregar revisión
        </button>
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="CCA (solapamiento)" value={fmt(ccaRes.val, 1) + "%"} hint={ccaRes.lvl} good={ccaRes.val <= 10} />
          <Kpi label="Estudios primarios" value={ccaRes.r} hint={`${ccaRes.c} revisiones · ${ccaRes.N} inclusiones`} />
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          CCA de Pieper: 0–5 leve · 6–10 moderado · 11–15 alto · &gt;15 muy alto. El solapamiento alto puede inflar la certeza si las RS comparten estudios primarios.
        </p>
      </Card>

      <Card title="Clasificación de credibilidad (criterios de umbrella review)">
        <Slider label="Nº de casos / eventos" v={cred.cases} min={0} max={5000} step={50} on={(v) => setC("cases", v)} />
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>p (meta-análisis aleatorios)</span><span className="text-cyan-300">{cred.p.toExponential(1)}</span>
          </div>
          <input type="range" min={-9} max={-1} step={0.5} value={Math.log10(cred.p)}
            onChange={(e) => setC("p", Math.pow(10, +e.target.value))} className="w-full accent-cyan-400" />
        </div>
        <Slider label="Heterogeneidad I² (%)" v={cred.i2} min={0} max={100} step={5} on={(v) => setC("i2", v)} />
        <div className="space-y-1.5 mb-3">
          {[
            ["largestSig", "El estudio más grande es significativo"],
            ["predNull",   "Intervalo de predicción 95% excluye el nulo"],
            ["smallBias",  "Indicios de sesgo de estudios pequeños"],
            ["excess",     "Sesgo por exceso de significancia"],
          ].map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={cred[k]} onChange={(e) => setC(k, e.target.checked)} className="accent-cyan-400" />{l}
            </label>
          ))}
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: credCl.col + "18", border: `1px solid ${credCl.col}55` }}>
          <p className="text-[11px] text-slate-400">Nivel de evidencia</p>
          <p className="text-lg font-semibold" style={{ color: credCl.col }}>{credCl.cl}</p>
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          Esquema tipo Ioannidis: Clase I (convincente) → IV (débil), según casos, p, I², intervalo de predicción y sesgos.
        </p>
      </Card>

      <Card title="Meta-análisis de efectos aleatorios (DerSimonian-Laird)">
        <p className="text-[11px] text-slate-400 mb-2">
          Introduce el efecto en escala log (log OR o log RR) y su error estándar por estudio. El pooled, IC, τ², I² y el intervalo de predicción se recalculan en vivo.
        </p>
        <div className="space-y-1.5 mb-3 max-h-56 overflow-auto pr-1">
          {metaStudies.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <input value={s.name} onChange={(e) => updStudy(s.id, "name", e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs flex-1" />
              <label className="text-[11px] text-slate-400">log:
                <input type="number" step="0.01" value={s.logOR} onChange={(e) => updStudy(s.id, "logOR", e.target.value)}
                  className="w-16 ml-1 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs" />
              </label>
              <label className="text-[11px] text-slate-400">SE:
                <input type="number" step="0.01" min="0.001" value={s.seLogOR} onChange={(e) => updStudy(s.id, "seLogOR", e.target.value)}
                  className="w-16 ml-1 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs" />
              </label>
              <button onClick={() => delStudy(s.id)} className="text-slate-500 hover:text-rose-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addStudy} className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 mb-3">
          <Plus className="w-3.5 h-3.5" />Agregar estudio
        </button>
        {meta && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Kpi label="Pooled (log)" value={fmt(meta.pooled, 3)} hint={`OR ≈ ${fmt(Math.exp(meta.pooled), 2)}`} />
            <Kpi label="IC95% (log)" value={`[${fmt(meta.ci[0], 2)}; ${fmt(meta.ci[1], 2)}]`} hint={`OR: [${fmt(Math.exp(meta.ci[0]),2)}; ${fmt(Math.exp(meta.ci[1]),2)}]`} />
            <Kpi label="I²" value={fmt(meta.I2, 1) + "%"} hint={`Q=${fmt(meta.Q,2)}, p=${meta.pQ.toExponential(1)}`} good={meta.I2 < 50} />
            <Kpi label="τ²" value={fmt(meta.tau2, 3)} hint={`IP95: [${fmt(meta.predInt[0],2)}; ${fmt(meta.predInt[1],2)}]`} />
          </div>
        )}
        <p className="text-[10px] text-slate-500 mt-2">
          τ² ≈ 0 e I² &lt; 25% → consistencia entre estudios. Intervalo de predicción 95% que excluye el nulo (0 en escala log) apoya credibilidad Clase I-II.
        </p>
      </Card>
    </div>
    </div>
  );
}
