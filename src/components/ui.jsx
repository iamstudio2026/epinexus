import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export function Card({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      {title && <h3 className="text-sm font-medium text-slate-300 mb-3">{title}</h3>}
      {children}
    </section>
  );
}

export function Slider({ label, v, min, max, step, on, fmtFn }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span className="text-cyan-300">{fmtFn ? fmtFn(v) : v}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => on(+e.target.value)}
        className="w-full accent-cyan-400"
      />
    </div>
  );
}

export function Kpi({ label, value, hint, good }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-xl font-semibold ${good === true ? "text-emerald-300" : good === false ? "text-rose-300" : "text-white"}`}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function Row({ k, v }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{k}</span>
      <span className="text-slate-100 font-medium">{v}</span>
    </div>
  );
}

export function Stat({ ok, label, detail }) {
  return (
    <div className="flex items-start gap-1.5">
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
        : <XCircle      className="w-3.5 h-3.5 text-amber-400  mt-0.5 shrink-0" />}
      <span className={ok ? "text-slate-400" : "text-amber-300"}>
        {label}{detail ? `: ${detail}` : ""}
      </span>
    </div>
  );
}
