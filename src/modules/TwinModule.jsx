import React, { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Beaker, Brain } from "lucide-react";
import { Card, Slider, Kpi } from "../components/ui.jsx";
import { fmt } from "../lib/stats.js";
import { seir, renalTrajectory, timeToDialysis } from "../lib/epi-models.js";

export default function TwinModule() {
  const [sub, setSub] = useState("seir");
  return (
    <div>
      <div className="flex gap-2 mb-4">
        {[["seir", "Brote (SEIR)", Beaker], ["renal", "Cohorte renal (TFG)", Brain]].map(([m, l, Ic]) => (
          <button key={m} onClick={() => setSub(m)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs ring-1 ${sub === m ? "bg-cyan-500/15 ring-cyan-400/50 text-cyan-300" : "bg-slate-900 ring-slate-700 text-slate-300"}`}>
            <Ic className="w-3.5 h-3.5" />{l}
          </button>
        ))}
      </div>
      {sub === "seir" ? <SeirTwin /> : <RenalTwin />}
    </div>
  );
}

function SeirTwin() {
  const [p, setP] = useState({ N: 100000, R0: 2.5, latent: 5, infectious: 7, I0: 10, days: 200, npi: 0, npiDay: 40 });
  const data = useMemo(() => seir(p), [p]);
  const peak = useMemo(() => data.reduce((a, r) => (r.I > a.I ? r : a), { I: 0 }), [data]);
  const attack = useMemo(() => (data.length ? (data[data.length - 1].R / p.N) * 100 : 0), [data, p.N]);
  const Rt = p.R0 * (1 - p.npi / 100);
  const set = (k, v) => setP((s) => ({ ...s, [k]: v }));
  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-5">
      <Card title="Parámetros del brote">
        <Slider label="R₀ basal" v={p.R0} min={0.5} max={8} step={0.1} on={(v) => set("R0", v)} />
        <Slider label="Periodo latente (días)" v={p.latent} min={1} max={14} step={1} on={(v) => set("latent", v)} />
        <Slider label="Periodo infeccioso (días)" v={p.infectious} min={1} max={21} step={1} on={(v) => set("infectious", v)} />
        <Slider label="Población" v={p.N} min={1000} max={1000000} step={1000} on={(v) => set("N", v)} fmtFn={(x) => x.toLocaleString()} />
        <Slider label="Reducción por MSP/NPI (%)" v={p.npi} min={0} max={90} step={5} on={(v) => set("npi", v)} />
        <Slider label="Día de intervención" v={p.npiDay} min={0} max={p.days} step={1} on={(v) => set("npiDay", v)} />
        <Slider label="Horizonte (días)" v={p.days} min={60} max={400} step={10} on={(v) => set("days", v)} />
      </Card>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="R efectivo" value={fmt(Rt, 2)} hint={Rt < 1 ? "control" : "epidemia"} good={Rt < 1} />
          <Kpi label="Pico de infectados" value={peak.I.toLocaleString()} hint={`día ${peak.t}`} />
          <Kpi label="Tasa de ataque" value={fmt(attack, 1) + "%"} hint="acumulada" />
        </div>
        <Card title="Trayectoria del compartimento (SEIR)">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="t" stroke="#64748b" tick={{ fontSize: 11 }}
                label={{ value: "días", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? (v / 1000) + "k" : v} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {p.npiDay > 0 && p.npi > 0 && (
                <ReferenceLine x={p.npiDay} stroke="#fbbf24" strokeDasharray="4 4"
                  label={{ value: "NPI", fill: "#fbbf24", fontSize: 10 }} />
              )}
              <Line dataKey="S" name="Susceptibles" stroke="#38bdf8" dot={false} strokeWidth={2} />
              <Line dataKey="E" name="Expuestos"    stroke="#fbbf24" dot={false} strokeWidth={2} />
              <Line dataKey="I" name="Infectados"   stroke="#fb7185" dot={false} strokeWidth={2} />
              <Line dataKey="R" name="Recuperados"  stroke="#34d399" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function RenalTwin() {
  const [p, setP] = useState({ egfr0: 65, slopeCtrl: -3.5, slopeInt: -1.8, years: 15 });
  const data = useMemo(() => renalTrajectory(p), [p]);
  const tCtrl = timeToDialysis({ egfr0: p.egfr0, slope: p.slopeCtrl, horizon: p.years });
  const tInt  = timeToDialysis({ egfr0: p.egfr0, slope: p.slopeInt,  horizon: p.years });
  const set = (k, v) => setP((s) => ({ ...s, [k]: v }));
  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-5">
      <Card title="Gemelo clínico — función renal">
        <p className="text-[11px] text-slate-400 mb-3">
          Proyección de TFGe (eGFR) bajo cuidado estándar vs nefroprotección. Diálisis ≈ TFGe &lt; 15.
        </p>
        <Slider label="TFGe basal (mL/min)" v={p.egfr0} min={20} max={120} step={1} on={(v) => set("egfr0", v)} />
        <Slider label="Pendiente estándar (mL/min/año)" v={p.slopeCtrl} min={-8} max={-0.5} step={0.1} on={(v) => set("slopeCtrl", v)} />
        <Slider label="Pendiente con intervención" v={p.slopeInt} min={-6} max={0} step={0.1} on={(v) => set("slopeInt", v)} />
        <Slider label="Horizonte (años)" v={p.years} min={5} max={25} step={1} on={(v) => set("years", v)} />
      </Card>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Tiempo a diálisis (estándar)"      value={tCtrl ? fmt(tCtrl, 1) + " años" : "> horizonte"} good={!tCtrl} />
          <Kpi label="Tiempo a diálisis (intervención)"  value={tInt  ? fmt(tInt,  1) + " años" : "> horizonte"} good={!tInt} />
        </div>
        <Card title="Trayectoria de TFGe">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="y" stroke="#64748b" tick={{ fontSize: 11 }}
                label={{ value: "años", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, "dataMax"]} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={15} stroke="#fb7185" strokeDasharray="4 4"
                label={{ value: "diálisis", fill: "#fb7185", fontSize: 10 }} />
              <Line dataKey="ctrl" name="Cuidado estándar" stroke="#fb7185" dot={false} strokeWidth={2} />
              <Line dataKey="int"  name="Nefroprotección"  stroke="#34d399" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
