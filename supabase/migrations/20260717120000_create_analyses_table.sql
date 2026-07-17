-- Analysis history foundation (analysis-history-database PR).
--
-- Creates public.analyses: one row per saved script analysis, owned by
-- exactly one authenticated user. Anonymous analysis (app/api/analyze-v2)
-- is unaffected — nothing here is written until a signed-in user explicitly
-- saves a result (a later PR adds the Save action and the real My Analyses
-- list). Rerun always inserts a new row; it never overwrites an existing
-- one, so history stays append-only from the app's point of view.
--
-- Deliberately excluded from this MVP table: folders, teams, billing,
-- publishing, generated videos, search infrastructure, version chains,
-- improved-script output, analytics events. Add those later, if ever,
-- as their own migrations.
--
-- Idempotent: safe to re-run (create ... if not exists / create or
-- replace / drop ... if exists then create).

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),

  -- Ownership. Deliberately no `default auth.uid()`: the app must pass the
  -- signed-in user's id explicitly when saving, via the RLS-aware client
  -- (lib/supabase/browser.ts or lib/supabase/server.ts) — see
  -- analyses_insert_own below, which independently enforces the same
  -- constraint. Explicit assignment in application code is more auditable
  -- than an implicit column default, and it fails loudly (not-null
  -- violation) rather than silently if a future service-role code path
  -- ever tried to insert without a real signed-in user.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Human-readable title (rename is a planned follow-up step). Length
  -- mirrors engine/analysis-v2-schema.ts's
  -- ANALYSIS_V2_LIMITS.maxTitleCharacters — keep these in sync if that
  -- limit ever changes.
  title text not null,

  -- The exact original script that was analyzed, unmodified. Length
  -- mirrors ANALYSIS_V2_LIMITS.maxScriptCharacters.
  script text not null,

  -- UI locale the analysis explanations were generated in. Constrained to
  -- engine/analysis-v2-schema.ts's AnalysisV2Locale ("en" | "ru") — the
  -- only locales Analysis V2 ever actually writes explanations in. This is
  -- narrower than lib/i18n.ts's SUPPORTED_LOCALES, which also lists
  -- locales the UI exposes but Analysis V2 doesn't generate explanations
  -- in yet (es, pt-BR, fr). Widen this check if Analysis V2 ever does.
  locale text not null,

  -- The complete validated AnalysisV2Result (scriptType, verdict, scores,
  -- scoreBreakdown, hookDecision, riskyParts, suggestedFixes, scenes,
  -- mainTakeaway, ...) as returned by app/api/analyze-v2, stored verbatim
  -- so a saved analysis can be reopened without re-running the AI.
  result_json jsonb not null,

  -- Model identifier used for this analysis (e.g. "gpt-4.1-mini"). Free-form
  -- text rather than a fixed enum: ANALYSIS_V2_MODEL is env-configurable,
  -- and the value actually used is returned per-request as modelUsed.
  model_used text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint analyses_title_not_blank check (char_length(btrim(title)) > 0),
  constraint analyses_title_length check (char_length(title) <= 200),
  constraint analyses_script_not_blank check (char_length(btrim(script)) > 0),
  constraint analyses_script_length check (char_length(script) <= 1000),
  constraint analyses_locale_allowed check (locale in ('en', 'ru')),
  constraint analyses_result_json_is_object check (jsonb_typeof(result_json) = 'object'),
  constraint analyses_model_used_not_blank check (char_length(btrim(model_used)) > 0)
);

comment on table public.analyses is
  'One row per saved script analysis. Rerun inserts a new row; never overwrites an existing one.';

-- Chronological "My Analyses" queries: newest-first, scoped to one owner.
create index if not exists analyses_user_id_created_at_idx
  on public.analyses (user_id, created_at desc);

-- updated_at maintenance ---------------------------------------------------
--
-- No existing timestamp-trigger function in the repo to reuse (this is the
-- first SQL migration), so this defines a narrowly-scoped one for this
-- table only, rather than a generic reusable trigger. No dynamic SQL.
create or replace function public.set_analyses_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists analyses_set_updated_at on public.analyses;

create trigger analyses_set_updated_at
  before update on public.analyses
  for each row
  execute function public.set_analyses_updated_at();

-- Row Level Security --------------------------------------------------------
--
-- Anonymous analysis stays anonymous: RLS denies every anonymous request by
-- default (no policy below matches the anon role), and the grants further
-- down revoke anon's table-level privileges explicitly rather than relying
-- on that default alone. Ownership is never enforced only in the frontend.
alter table public.analyses enable row level security;

drop policy if exists analyses_select_own on public.analyses;
create policy analyses_select_own
  on public.analyses
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists analyses_insert_own on public.analyses;
create policy analyses_insert_own
  on public.analyses
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Both using and with check are required: using restricts which existing
-- rows may be targeted (must already be owned by the caller), and with
-- check restricts the resulting row (must still be owned by the caller).
-- Together they make ownership transfer impossible in either direction — a
-- user can neither give a row away nor take over someone else's row by
-- updating user_id.
drop policy if exists analyses_update_own on public.analyses;
create policy analyses_update_own
  on public.analyses
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists analyses_delete_own on public.analyses;
create policy analyses_delete_own
  on public.analyses
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Explicit grants/revokes ----------------------------------------------------
--
-- Belt-and-suspenders alongside RLS: even if a policy were ever
-- misconfigured, anon has no table-level privilege to fall back on.
-- service_role (lib/supabase.ts's trusted backend client, used by
-- app/api/feedback and the admin panel) already bypasses RLS by role
-- attribute in Supabase; the explicit grant below just keeps that
-- unweakened and documented rather than left implicit.
revoke all on table public.analyses from anon;
revoke all on table public.analyses from authenticated;
grant select, insert, update, delete on table public.analyses to authenticated;
grant all on table public.analyses to service_role;
