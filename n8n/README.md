# RAG productivo en n8n

`rag-workflow.json` implementa el endpoint que consume `RagModule.jsx`.
Contrato:

```
POST /webhook/epinexus-rag
Body: { "pregunta": "...", "usePubmed": true }
Resp: { "text": "...", "sources": [{ "title": "...", "url": "..." }] }
```

Internamente: Webhook → Code (construye payload Anthropic con web_search y
opcionalmente MCP de PubMed) → HTTP POST a `api.anthropic.com/v1/messages`
→ Code (extrae `text` y `sources` con PMID/DOI cuando hay) → Respond.

## Importar en `n8n.iamstudio.cloud`

1. Entra a n8n → **Workflows → Import from File** → sube
   `n8n/rag-workflow.json`.
2. Abre el nodo **HTTP Request "Anthropic"** y:
   - Method: POST · URL: `https://api.anthropic.com/v1/messages`
   - Headers:
     - `x-api-key: {{$credentials.anthropic.apiKey}}` (o pega tu key directa
       como secret credential — recomendado)
     - `anthropic-version: 2023-06-01`
     - `anthropic-beta: web-search-2025-03-05,mcp-client-2025-04-04`
   - Body: `={{ $json.payload }}` (JSON)
3. **Activate** el workflow (toggle arriba a la derecha).
4. Anota la URL del webhook (botón "Production URL" en el nodo Webhook):
   debería ser `https://n8n.iamstudio.cloud/webhook/epinexus-rag`.

## Conectar el front

En Easypanel → servicio `epinexus` → Environment vars:

```
VITE_RAG_ENDPOINT = https://n8n.iamstudio.cloud/webhook/epinexus-rag
```

Rebuild. El módulo RAG ya muestra `text` y los enlaces de `sources`.

## Probar sin el front

```bash
curl -sS -X POST https://n8n.iamstudio.cloud/webhook/epinexus-rag \
  -H 'Content-Type: application/json' \
  -d '{"pregunta":"¿metformina y mortalidad en diabetes tipo 2?","usePubmed":true}' \
  | jq
```

## Caching opcional (Supabase)

Si activas Supabase, la tabla `rag_cache` ya tiene esquema preparado
(`question_hash`, `answer_text`, `sources_json`, `created_at`). Para activar
caché, añade dos pasos en el workflow:

- Antes del HTTP a Anthropic: SELECT desde `rag_cache` por hash de la
  pregunta normalizada; si hit, devuelve la respuesta directamente.
- Después de Anthropic: UPSERT en `rag_cache` con la respuesta.

(Implementación detallada en el backlog de §6 de `CLAUDE.md`.)
