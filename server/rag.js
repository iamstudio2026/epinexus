/**
 * Proxy mínimo para el módulo RAG de EPINEXUS.
 * Protege ANTHROPIC_API_KEY (nunca debe vivir en el navegador) y llama a la
 * API de Anthropic con la herramienta web_search y el servidor MCP de PubMed.
 *
 * Uso local:  ANTHROPIC_API_KEY=sk-ant-... node server/rag.js
 * Luego en .env del front:  VITE_RAG_ENDPOINT=http://localhost:8787/rag
 *
 * En producción puedes replicar esta misma lógica como nodo HTTP en n8n.
 * Requiere Node 18+ (fetch nativo).
 */
import http from "node:http";

const KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 8787;
const MODEL = process.env.RAG_MODEL || "claude-sonnet-4-20250514";

const SYSTEM = `Eres un asistente de síntesis de evidencia para epidemiólogos. Busca en PubMed/NCBI y fuentes revisadas por pares. Responde SIEMPRE en español, conciso y estructurado: (1) Hallazgo principal, (2) Calidad/diseño de la evidencia, (3) Limitaciones, (4) Fuentes con autor/año/PMID o DOI cuando existan. No inventes citas; si no hay evidencia clara, dilo.`;

const send = (res, code, obj) => {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(obj));
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST" || !req.url.startsWith("/rag")) return send(res, 404, { error: "not found" });
  if (!KEY) return send(res, 500, { error: "Falta ANTHROPIC_API_KEY en el entorno del servidor" });

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    try {
      const { pregunta, usePubmed } = JSON.parse(raw || "{}");
      const body = {
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: String(pregunta || "") }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      };
      if (usePubmed) {
        body.mcp_servers = [{ type: "url", url: "https://pubmed.mcp.claude.com/mcp", name: "pubmed" }];
      }
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "mcp-client-2025-04-04",
        },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data?.error) return send(res, 502, { error: data.error.message || "Error de API" });
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      send(res, 200, { text });
    } catch (e) {
      send(res, 500, { error: String(e.message || e) });
    }
  });
});

server.listen(PORT, () => console.log(`EPINEXUS RAG proxy en http://localhost:${PORT}/rag`));
