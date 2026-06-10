import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, supabaseEnabled, listProjects, createProject } from "../lib/supabase.js";

const Ctx = createContext({ projects: [], current: null, setCurrent: () => {}, refresh: async () => {}, enabled: false });

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [current, setCurrent] = useState(null);

  const refresh = useCallback(async () => {
    if (!supabaseEnabled) return;
    try {
      const ps = await listProjects();
      setProjects(ps || []);
      if (!current && ps?.length) setCurrent(ps[0]);
    } catch (_) { /* sin sesión: silencioso */ }
  }, [current]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Ctx.Provider value={{ projects, current, setCurrent, refresh, enabled: supabaseEnabled }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProject() { return useContext(Ctx); }

export function ProjectSelector() {
  const { projects, current, setCurrent, refresh, enabled } = useProject();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  if (!enabled) {
    return <span className="text-[10px] text-slate-500">modo memoria · sin persistencia</span>;
  }
  const create = async () => {
    if (!name.trim()) return;
    try {
      const p = await createProject({ name: name.trim(), description: "" });
      setName(""); setCreating(false); setCurrent(p); await refresh();
    } catch (e) { alert("No se pudo crear: " + e.message); }
  };
  return (
    <div className="flex items-center gap-2">
      <select
        value={current?.id || ""}
        onChange={(e) => setCurrent(projects.find((p) => p.id === e.target.value) || null)}
        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200">
        <option value="">— elegir proyecto —</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {creating ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="nombre"
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs w-32" />
          <button onClick={create} className="text-xs px-2 py-1 rounded bg-cyan-500/15 ring-1 ring-cyan-400/40 text-cyan-300">crear</button>
          <button onClick={() => setCreating(false)} className="text-xs text-slate-400">×</button>
        </>
      ) : (
        <button onClick={() => setCreating(true)} className="text-xs px-2 py-1 rounded ring-1 ring-slate-700 text-slate-300 hover:ring-slate-500">+ nuevo</button>
      )}
    </div>
  );
}
