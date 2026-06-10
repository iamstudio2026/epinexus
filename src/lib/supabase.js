/**
 * Capa de persistencia para EPINEXUS.
 * El cliente solo se crea si VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY existen,
 * para no romper el modo "sin sesión" (estado en memoria) durante desarrollo.
 *
 * Para activar:
 *   npm i @supabase/supabase-js
 *   .env:
 *     VITE_SUPABASE_URL=https://<proyecto>.supabase.co
 *     VITE_SUPABASE_ANON_KEY=eyJ...
 */
// Importación dinámica para que el bundle no rompa si la dep no está instalada.
const URL = import.meta.env?.VITE_SUPABASE_URL;
const KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;

let _supabase = null;
if (URL && KEY) {
  try {
    const mod = await import(/* @vite-ignore */ "@supabase/supabase-js");
    _supabase = mod.createClient(URL, KEY);
  } catch (_) { /* dep ausente → modo memoria */ }
}
export const supabase = _supabase;
export const supabaseEnabled = !!_supabase;

// ---------- Projects ----------
export async function listProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function createProject({ name, description }) {
  const { data: u } = await supabase.auth.getUser();
  const owner_id = u.user?.id;
  if (!owner_id) throw new Error("Sesión no iniciada");
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description, owner_id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- DAGs ----------
export async function saveDag({ id, project_id, name, exposure, outcome, nodes, edges, adjustment_set, notes }) {
  const payload = { project_id, name, exposure, outcome, nodes, edges, adjustment_set, notes };
  const q = id
    ? supabase.from("dags").update(payload).eq("id", id).select().single()
    : supabase.from("dags").insert(payload).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
export async function loadDags(project_id) {
  const { data, error } = await supabase
    .from("dags").select("*").eq("project_id", project_id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ---------- Umbrella ----------
export async function saveUmbrella({ id, project_id, question, pico, cca_value, cca_level, credibility }) {
  const payload = { project_id, question, pico, cca_value, cca_level, credibility };
  const q = id
    ? supabase.from("umbrella_reviews").update(payload).eq("id", id).select().single()
    : supabase.from("umbrella_reviews").insert(payload).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
export async function loadUmbrellaReviews(project_id) {
  const { data, error } = await supabase
    .from("umbrella_reviews").select("*, systematic_reviews(*)")
    .eq("project_id", project_id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ---------- Cohortes ----------
export async function saveCohort({ id, project_id, kind, name, params, results_cache }) {
  const payload = { project_id, kind, name, params, results_cache };
  const q = id
    ? supabase.from("cohorts").update(payload).eq("id", id).select().single()
    : supabase.from("cohorts").insert(payload).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// ---------- Caché del RAG (lectura) ----------
export async function lookupRagCache(question, usePubmed) {
  if (!supabase) return null;
  const hash = await sha256(`${question.trim().toLowerCase()}:${usePubmed ? 1 : 0}`);
  const { data, error } = await supabase
    .from("rag_cache").select("*").eq("question_hash", hash).maybeSingle();
  if (error) return null;
  return data;
}

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
