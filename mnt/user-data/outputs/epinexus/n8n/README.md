# Workflow n8n — RAG de EPINEXUS

Endpoint público que el frontend consume vía `VITE_RAG_ENDPOINT`.
Llama a la API de Anthropic con `web_search` + MCP de PubMed y devuelve
`{ text, sources }`.

## Importar en tu n8n (https://n8n.iamstudio.cloud)

1. **Workflows → Import from File** → selecciona `rag-workflow.json`.
2. Abre **Settings → Variables (env)** y define:
   - `ANTHROPIC_API_KEY = sk-ant-...`
   (n8n inyecta `$env.*` en las cabeceras HTTP en el nodo *Anthropic Messages API*).
3. Activa el workflow.
4. La URL final será:
   `https://n8n.iamstudio.cloud/webhook/epinexus-rag`
   Ponla en `.env` del front:
   ```
   VITE_RAG_ENDPOINT=https://n8n.iamstudio.cloud/webhook/epinexus-rag
   ```

## Contrato

**Request**
```json
POST /webhook/epinexus-rag
{ "pregunta": "string", "usePubmed": true }
```

**Response**
```json
{
  "text": "Hallazgo principal: ...\nCalidad: ...\nLimitaciones: ...\nFuentes: ...",
  "sources": [{ "pmid": "12345678", "text": "..." }]
}
```

## Hardening recomendado (siguiente iteración)

- Añadir un nodo **IF** que rechace requests sin `pregunta` o > 4000 caracteres.
- Insertar un nodo **Supabase** entre `Webhook` y `Construir payload` para
  hacer *cache lookup* en `rag_cache` (clave = `sha256(pregunta:usePubmed)`)
  y devolver respuesta cacheada sin llamar a Anthropic. Tras `Extraer texto
  y fuentes`, otro nodo Supabase escribe el resultado en `rag_cache`
  (usa la **service_role key**, nunca la anon).
- Si publicas la URL, añade un header `x-epinexus-token` y valida en el
  workflow para evitar abuso.

## Alternativa local (sin n8n)

`server/rag.js` implementa exactamente el mismo contrato en Node. Útil para
desarrollo local antes de subir el workflow.
