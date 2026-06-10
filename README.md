# EPINEXUS

Plataforma de epidemiología computacional. Cinco módulos:

- **DAG causal** — clasificación de roles, trayectorias de puerta trasera y
  verificación del criterio backdoor con d-separación. Exporta a **dagitty**.
- **RAG científico** — síntesis de evidencia con PubMed/NCBI (vía proxy).
- **Gemelo digital** — brote SEIR y cohorte renal (TFGe / tiempo a diálisis).
- **Revisión paraguas (2º orden)** — solapamiento CCA, AMSTAR-2, credibilidad
  tipo Ioannidis.
- **Herramientas** — PICO, tabla 2×2 con IC95%, tamaño muestral.

## Arranque rápido

```bash
npm install
cp .env.example .env       # configurar VITE_RAG_ENDPOINT
npm run dev                # http://localhost:5173
npm test                   # corre las pruebas de las invariantes científicas
```

El proxy del RAG en local:
```bash
ANTHROPIC_API_KEY=sk-ant-... npm run rag   # http://localhost:8787/rag
```

O importa `n8n/rag-workflow.json` en tu n8n y apunta `VITE_RAG_ENDPOINT` al
webhook resultante (ver `n8n/README.md`).

## Persistencia opcional (Supabase)

```bash
npm i @supabase/supabase-js
```
En `.env`:
```
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
Ejecuta `supabase/schema.sql` en el SQL editor o con `supabase db push`.

## Estructura

```
src/
  App.jsx                  # shell + tabs
  lib/                     # graph, stats, epi-models, supabase  (puro y testeable)
  components/ui.jsx
  modules/                 # 5 módulos
  test/                    # pruebas con vitest
server/rag.js              # proxy local del RAG
supabase/schema.sql        # esquema + RLS
n8n/rag-workflow.json      # workflow productivo del RAG
CLAUDE.md                  # guía para Claude Code
```

Lee `CLAUDE.md` antes de modificar: ahí están las invariantes científicas
que las pruebas cuidan.
