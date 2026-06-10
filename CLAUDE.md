# CLAUDE.md — Guía de trabajo para Claude Code

> Lee este archivo completo antes de editar. Define arquitectura, invariantes
> que NO deben romperse y hoja de ruta.

## 1. Estado actual

EPINEXUS es una app de epidemiología computacional (Vite + React 18 + Tailwind +
recharts). Interfaz en **español**. Ya **refactorizada** desde el monolito
inicial a esta estructura:

```
src/
  App.jsx                      # shell + tabs
  main.jsx
  index.css
  lib/
    graph.js                   # DAG, d-separación, puerta trasera, dagitty
    stats.js                   # invNorm, 2x2, tamaño muestral
    epi-models.js              # SEIR, renal, CCA, AMSTAR, credibilidad
    supabase.js                # cliente + wrappers (opcional)
  components/
    ui.jsx                     # Card, Slider, Kpi, Row, Stat
  modules/
    DagModule.jsx
    RagModule.jsx
    TwinModule.jsx             # SeirTwin + RenalTwin
    UmbrellaModule.jsx
    ToolsModule.jsx
  test/
    graph.test.js
    stats.test.js
    epi-models.test.js
server/rag.js                   # proxy local del RAG
supabase/schema.sql             # esquema + RLS
n8n/rag-workflow.json           # workflow productivo del RAG
n8n/README.md
```

Comandos: `npm run dev`, `npm test`, `npm run rag`.

## 2. Convenciones

- Componentes funcionales con hooks.
- Solo utilidades base de Tailwind.
- Cálculos puros en `src/lib/` (testeables sin DOM).
- Nunca `localStorage` hasta que la persistencia sea real (Supabase).
- Nunca claves de API en el front; el RAG va por `server/rag.js` o n8n.

## 3. Invariantes científicas (NO ROMPER, hay tests)

- **d-separación** (`pathBlocked`, `isBackdoor` en `lib/graph.js`):
  cadena/horquilla → condicionar bloquea; colisionador → condicionarlo (o un
  descendiente) abre. Verificado con el DAG semilla:
  `{AGE, FAM}` identifica X→Y; `{HTA}` mete un descendiente de X;
  `{...HOSP}` induce sesgo de colisión.
- **CCA de Pieper** (`cca` en `lib/epi-models.js`): `(N−r)/(r·c−r)`.
- **Credibilidad tipo Ioannidis/Fusar-Poli**: Clase I→IV con `cases > 1000`,
  p, I², intervalo de predicción y sesgos.
- **2×2**: OR e IC por método log (SE = √(1/a+1/b+1/c+1/d)).
- **Tamaño muestral**: dos proporciones con z y prevalencia con z² · p(1−p)/d².
- **SEIR**: Euler dt=0.25; R efectivo = R₀·(1−NPI). La población se conserva
  con error <0.1% en 50 días.

Cualquier PR que altere estos números debe explicar la fuente y mantener los
tests en verde (`npm test`).

## 4. Persistencia (Supabase) — listo para encender

- Esquema en `supabase/schema.sql`: `projects`, `dags`, `umbrella_reviews`,
  `systematic_reviews`, `cohorts`, `rag_cache`, con **RLS por dueño**.
- Cliente en `src/lib/supabase.js`. Se activa cuando existan
  `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (en su ausencia, modo memoria).
- Próximo paso aquí: cablear cada módulo a sus wrappers (`saveDag`,
  `saveUmbrella`, `saveCohort`) tras añadir un selector de proyecto en el
  header de `App.jsx`. Mantener el modo sin sesión.

## 5. RAG en producción

- `server/rag.js` para desarrollo local (Node 18+).
- `n8n/rag-workflow.json` para producción en `n8n.iamstudio.cloud`. Mismo
  contrato `{pregunta, usePubmed} -> {text, sources}`. Ver `n8n/README.md`.
- El front (`modules/RagModule.jsx`) ya pinta `sources` con enlaces a
  PubMed cuando el proxy las devuelve.

## 6. Backlog científico

- DAG: algoritmo formal de **conjunto de ajuste mínimo** (Perković et al.) y
  detección de **variables instrumentales**.
- Microsimulación renal a nivel individuo (heterogeneidad de pendientes y
  riesgo competitivo muerte vs. diálisis), no solo trayectoria media.
- Meta-análisis dentro del módulo paraguas (DerSimonian-Laird, I²,
  intervalo de predicción) en vez de capturar p e I² a mano.
- Exportación: paraguas → Excel con matriz CCA y PRISMA de flujo;
  DAG → PNG/SVG del lienzo.

## 7. Calidad

- Responsive hasta móvil; foco visible por teclado; respetar
  `prefers-reduced-motion`.
- Commits pequeños y descriptivos; un PR por bullet de §6.
