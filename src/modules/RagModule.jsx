import React, { useState } from "react";
import { Search, Loader2, AlertTriangle } from "lucide-react";
import { Card } from "../components/ui.jsx";

const EJEMPLOS = [
  "¿Reduce la metformina la progresión de ERC en diabéticos tipo 2?",
  "Citología líquida vs convencional: tasa de muestras insatisfactorias",
  "Eficacia de la vacuna contra dengue Qdenga en seronegativos",
];

export default function RagModule() {
  const [q, setQ] = useState("");
  const [usePubmed, setUsePubmed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [sources, setSources] = useState([]);
  const [err, setErr] = useState("");

  // Proxy de backend (server/rag.js o webhook n8n). NUNCA la API key en el front.
  const ENDPOINT = import.meta.env.VITE_RAG_ENDPOINT;

  const consultar = async () => {
    if (!q.trim()) return;
    if (!ENDPOINT) {
      setErr("Falta configurar VITE_RAG_ENDPOINT en .env (proxy de backend). Ver CLAUDE.md → módulo RAG.");
      return;
    }
    setLoading(true); setErr(""); setResult(""); setSources([]);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: q, usePubmed }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const text = data.text
        || (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      setResult(text || "No se obtuvo síntesis. Reformula la pregunta o desactiva PubMed.");
      if (Array.isArray(data.sources)) setSources(data.sources);
    } catch (e) {
      setErr("No se pudo completar la síntesis. Revisa el endpoint del proxy (VITE_RAG_ENDPOINT) y su conexión.");
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card title="Consulta de evidencia (RAG · NCBI/PubMed)">
        <p className="text-[12px] text-slate-400 mb-3">
          Recuperación aumentada conectada a PubMed (MCP de NCBI) y búsqueda web. Formula una pregunta clínica o epidemiológica.
        </p>
        <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3}
          placeholder="Ej.: ¿La cribado con VPH reduce la incidencia de cáncer cervical frente a citología?"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm resize-y" />
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={usePubmed} onChange={(e) => setUsePubmed(e.target.checked)} className="accent-cyan-400" />
            Conectar a PubMed (NCBI)
          </label>
          <button onClick={consultar} disabled={loading}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 ring-1 ring-cyan-400/50 text-cyan-200 text-sm disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Sintetizando…" : "Consultar evidencia"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {EJEMPLOS.map((e, i) => (
            <button key={i} onClick={() => setQ(e)} className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700">{e}</button>
          ))}
        </div>
      </Card>

      {err && <div className="text-amber-300 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{err}</div>}

      {result && (
        <Card title="Síntesis de evidencia">
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200">{result}</div>
          {sources.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800">
              <p className="text-[11px] text-slate-400 mb-2">Fuentes recuperadas</p>
              <ul className="space-y-1 text-xs">
                {sources.map((s, i) => (
                  <li key={i} className="text-slate-300">
                    {s.pmid && <a className="text-cyan-300 hover:underline mr-1" href={`https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`} target="_blank" rel="noreferrer">PMID {s.pmid}</a>}
                    {s.title || s.text || ""}
                    {s.year ? <span className="text-slate-500"> ({s.year})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
