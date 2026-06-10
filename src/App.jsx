import React, { useState, lazy, Suspense } from "react";
import { GitBranch, BookOpen, Activity, Layers, Wrench, Microscope } from "lucide-react";
const DagModule      = lazy(() => import("./modules/DagModule.jsx"));
const RagModule      = lazy(() => import("./modules/RagModule.jsx"));
const TwinModule     = lazy(() => import("./modules/TwinModule.jsx"));
const UmbrellaModule = lazy(() => import("./modules/UmbrellaModule.jsx"));
const ToolsModule    = lazy(() => import("./modules/ToolsModule.jsx"));
import { ProjectProvider, ProjectSelector } from "./components/ProjectContext.jsx";

const TABS = [
  { id: "dag",      label: "Análisis Causal",   icon: GitBranch, Comp: DagModule },
  { id: "rag",      label: "RAG Científico",    icon: BookOpen,  Comp: RagModule },
  { id: "twin",     label: "Gemelo Digital",    icon: Activity,  Comp: TwinModule },
  { id: "umbrella", label: "Revisión Paraguas", icon: Layers,    Comp: UmbrellaModule },
  { id: "tools",    label: "Herramientas",      icon: Wrench,    Comp: ToolsModule },
];

export default function App() {
  const [tab, setTab] = useState("dag");
  const Current = TABS.find((t) => t.id === tab).Comp;
  return (
    <ProjectProvider><AppInner tab={tab} setTab={setTab} Current={Current} /></ProjectProvider>
  );
}

function AppInner({ tab, setTab, Current }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 ring-1 ring-cyan-400/40 flex items-center justify-center">
            <Microscope className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white leading-none">EPINEXUS</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Epidemiología computacional · evidencia de segundo orden</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ProjectSelector />
            <span className="text-[10px] uppercase tracking-widest text-slate-500 hidden sm:block">prototipo</span>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-2 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const I = t.icon, on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${on ? "border-cyan-400 text-cyan-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
                <I className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Suspense fallback={<div className="text-slate-500 text-sm">Cargando módulo…</div>}>
          <Current />
        </Suspense>
      </main>
      <footer className="max-w-7xl mx-auto px-4 py-6 text-[11px] text-slate-500 border-t border-slate-800 mt-8">
        Herramienta de apoyo metodológico. Los cálculos causales, de simulación y de síntesis no sustituyen el juicio del investigador ni la revisión por pares.
      </footer>
    </div>
  );
}
