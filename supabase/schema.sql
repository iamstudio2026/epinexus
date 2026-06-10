-- ============================================================
-- EPINEXUS · Esquema Supabase
-- Aplicar en orden: ejecuta el archivo completo en el SQL editor
-- o como migración con `supabase db push`.
-- ============================================================

-- Cada usuario solo ve sus proyectos; los hijos heredan visibilidad por project_id.
-- Diseñado para multi-tenant single-user (un investigador = sus proyectos),
-- ampliable luego a colaboradores con una tabla `project_members`.

create extension if not exists "pgcrypto";

-- ----- 1. Proyectos -----------------------------------------
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists projects_owner_idx on public.projects(owner_id);

-- ----- 2. DAGs causales -------------------------------------
create table if not exists public.dags (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  name            text not null,
  exposure        text,                     -- id del nodo X
  outcome         text,                     -- id del nodo Y
  nodes           jsonb not null default '[]'::jsonb,
  edges           jsonb not null default '[]'::jsonb,
  adjustment_set  jsonb not null default '[]'::jsonb,  -- array de ids
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists dags_project_idx on public.dags(project_id);

-- ----- 3. Revisiones paraguas y RS hijas --------------------
create table if not exists public.umbrella_reviews (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  question     text not null,
  pico         jsonb,                       -- {P,I,C,O}
  -- Métricas globales
  cca_value    numeric,
  cca_level    text,
  credibility  jsonb,                       -- {cl, col, casos, p, i2, ...}
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists umbrella_project_idx on public.umbrella_reviews(project_id);

create table if not exists public.systematic_reviews (
  id            uuid primary key default gen_random_uuid(),
  umbrella_id   uuid not null references public.umbrella_reviews(id) on delete cascade,
  name          text not null,             -- p.ej. "RS-A (2021)"
  authors       text,
  year          int,
  pmid          text,
  doi           text,
  studies       text[] not null default '{}',  -- IDs de estudios primarios
  amstar_crit   int not null default 0,    -- fallas críticas
  amstar_noncrit int not null default 0,   -- debilidades
  amstar_label  text,                       -- "Confianza alta", etc.
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists sr_umbrella_idx on public.systematic_reviews(umbrella_id);

-- ----- 4. Cohortes / gemelos digitales ----------------------
create table if not exists public.cohorts (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  kind          text not null check (kind in ('seir', 'renal', 'custom')),
  name          text not null,
  params        jsonb not null,            -- {N, R0, ...} o {egfr0, slopeCtrl, ...}
  results_cache jsonb,                      -- opcional: última corrida (rows + KPIs)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists cohorts_project_idx on public.cohorts(project_id);

-- ----- 5. Caché del RAG (opcional) --------------------------
-- Evita gastar tokens en preguntas repetidas. TTL controlado en lectura.
create table if not exists public.rag_cache (
  question_hash text primary key,            -- sha256(lower(trim(pregunta))) || ':' || usePubmed
  question      text not null,
  use_pubmed    boolean not null,
  answer        text not null,
  sources       jsonb,
  created_at    timestamptz not null default now()
);

-- ----- 6. updated_at automático -----------------------------
create or replace function public._touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'projects_touch';
  if not found then
    create trigger projects_touch  before update on public.projects          for each row execute procedure public._touch_updated_at();
    create trigger dags_touch      before update on public.dags              for each row execute procedure public._touch_updated_at();
    create trigger umbrella_touch  before update on public.umbrella_reviews  for each row execute procedure public._touch_updated_at();
    create trigger cohorts_touch   before update on public.cohorts           for each row execute procedure public._touch_updated_at();
  end if;
end $$;

-- ============================================================
-- Row Level Security: cada usuario solo ve lo suyo
-- ============================================================
alter table public.projects           enable row level security;
alter table public.dags               enable row level security;
alter table public.umbrella_reviews   enable row level security;
alter table public.systematic_reviews enable row level security;
alter table public.cohorts            enable row level security;
alter table public.rag_cache          enable row level security;  -- compartido pero protegido

-- Función auxiliar: ¿el usuario actual es dueño de este proyecto?
create or replace function public.is_project_owner(p uuid)
returns boolean language sql stable as $$
  select exists(select 1 from public.projects where id = p and owner_id = auth.uid())
$$;

-- Projects
drop policy if exists projects_select on public.projects;
drop policy if exists projects_cud    on public.projects;
create policy projects_select on public.projects for select using (owner_id = auth.uid());
create policy projects_cud    on public.projects for all    using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- DAGs / umbrella / cohorts: por proyecto
drop policy if exists dags_rw on public.dags;
create policy dags_rw on public.dags for all
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

drop policy if exists umb_rw on public.umbrella_reviews;
create policy umb_rw on public.umbrella_reviews for all
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

drop policy if exists coh_rw on public.cohorts;
create policy coh_rw on public.cohorts for all
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

-- Systematic reviews: por umbrella -> proyecto
drop policy if exists sr_rw on public.systematic_reviews;
create policy sr_rw on public.systematic_reviews for all
  using (exists (
    select 1 from public.umbrella_reviews u
    where u.id = umbrella_id and public.is_project_owner(u.project_id)
  ))
  with check (exists (
    select 1 from public.umbrella_reviews u
    where u.id = umbrella_id and public.is_project_owner(u.project_id)
  ));

-- Caché del RAG: lectura para todos los autenticados; escritura solo por backend (service_role).
drop policy if exists rag_select on public.rag_cache;
create policy rag_select on public.rag_cache for select using (auth.role() = 'authenticated');
