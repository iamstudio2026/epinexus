# Despliegue en Easypanel (srv1234148 · 72.60.164.54)

EPINEXUS se publica como **Static Site** en el mismo VPS de producción que ya
sirve `n8n.iamstudio.cloud`. Easypanel + Traefik se encargan de HTTPS
(Let's Encrypt) automáticamente. CI/CD: cada `git push` a `main` dispara
el rebuild en Easypanel y los tests en GitHub Actions.

## 1. DNS (panel Hostinger)

Crea un registro **A** apuntando al VPS de producción:

```
Tipo: A   Nombre: epinexus   Valor: 72.60.164.54   TTL: 3600
```

Verifica:

```bash
dig +short epinexus.iamstudio.cloud   # → 72.60.164.54
```

## 2. Crear el servicio en Easypanel

1. Abre `https://<tu-easypanel>:3000` y entra al proyecto de producción.
2. **+ Service → App**.
3. Configura así:

| Campo                    | Valor                                                                 |
|--------------------------|-----------------------------------------------------------------------|
| Service name             | `epinexus`                                                            |
| **Source**               | GitHub                                                                |
| Owner / Repo             | `iamstudio2026/epinexus`                                              |
| Branch                   | `main`                                                                |
| Build path               | `/`                                                                   |
| **Build type**           | Nixpacks (autodetecta Node) — alternativa: Dockerfile (incluido)      |
| Install command          | `npm ci`                                                              |
| Build command            | `npm run build`                                                       |
| Start command            | *(vacío — es static)*                                                 |
| Static output dir        | `dist`                                                                |
| **Environment vars**     | ver tabla más abajo                                                   |
| **Domains** → Add domain | `epinexus.iamstudio.cloud` · Port `80` · HTTPS · Force redirect       |

Si Easypanel pide explícitamente "Static site", elige esa plantilla y
pega los mismos valores; el publish dir es `dist`.

### Environment variables

| Nombre                     | Valor                                                |
|----------------------------|------------------------------------------------------|
| `VITE_RAG_ENDPOINT`        | `https://n8n.iamstudio.cloud/webhook/epinexus-rag`   |
| `VITE_SUPABASE_URL`        | (lo provees)                                         |
| `VITE_SUPABASE_ANON_KEY`   | (lo provees — anon key, NO service role)             |

> Vite necesita las variables `VITE_*` en **build time**, no en runtime. Si
> cambias estos valores, dispara *Rebuild* en Easypanel.

4. **Deploy**. Easypanel clona el repo, instala, compila y sirve `dist/`.
   Traefik emite el cert Let's Encrypt para `epinexus.iamstudio.cloud` en
   ~30 s.

## 3. Auto-deploy en cada push

En la página del servicio en Easypanel → **Source → Auto deploy: ON**.
Easypanel registra un webhook en GitHub y reconstruye cada push a `main`.

GitHub Actions (`ci.yml`) además corre tests + build en cada PR/push, así
una rotura no llega a producción si bloqueas el merge.

## 4. RAG vía n8n (importante)

El workflow está en `n8n/rag-workflow.json`. Impórtalo en
`https://n8n.iamstudio.cloud` y al webhook resultante apunta
`VITE_RAG_ENDPOINT`. Contrato:

```
POST /webhook/epinexus-rag
{ "pregunta": "...", "usePubmed": true }
→ { "text": "...", "sources": [{ "title": "...", "url": "..." }] }
```

El front (`RagModule.jsx`) renderiza `text` y los enlaces de `sources`.

## 5. Supabase (opcional pero activado)

1. Crea el proyecto en `https://supabase.com`.
2. SQL Editor → pega `supabase/schema.sql` → Run. Crea `projects`, `dags`,
   `umbrella_reviews`, `systematic_reviews`, `cohorts`, `rag_cache` con RLS
   por dueño.
3. Authentication → habilita Email/Magic Link (mínimo) para que `owner_id`
   exista al crear proyectos.
4. Pon `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en las env vars de
   Easypanel. Rebuild.

> Cuando ambas envs estén presentes y el paquete esté instalado,
> `supabase.js` carga el cliente dinámicamente. Sin ellas, el modo memoria
> sigue funcionando.

Easypanel autodescubre dependencias de `package.json`, así que
`@supabase/supabase-js` se instala en el build sin tocar nada más si lo
añades:

```bash
npm i @supabase/supabase-js
git commit -am "deps: @supabase/supabase-js"
git push
```

## 6. Comprobaciones

```bash
curl -I https://epinexus.iamstudio.cloud            # 200 OK, vía Traefik
curl -I https://epinexus.iamstudio.cloud/ruta-falsa # 200 (SPA fallback)
```

En Easypanel: **Logs** del servicio para ver build y deploys.
En GitHub: pestaña **Actions** para los tests.

## 7. Rollback

Easypanel guarda historial de deploys. **Service → Deployments → ⋯ → Redeploy**
sobre el deploy anterior. Cero downtime.
