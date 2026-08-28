-- ============================================================================
-- Relevé Connect — Migration: Dance Team Concentration/Focus options
-- ----------------------------------------------------------------------------
-- Kathleen's Dance Team editor cleanup (2026-08-28): the Concentration/Focus
-- picker showed studio-only options (Competition, Technique/Recreational,
-- Conservatory/Pre-Professional) to a Dance Team too. Rather than a new
-- taxonomy table, this tags the EXISTING studio_concentrations rows with which
-- org type they apply to, and adds a small (4-row) Dance-Team-appropriate set.
-- Reuses the exact same table/join (employer_concentrations →
-- studio_concentrations) — no new architecture.
-- ============================================================================

begin;

alter table public.studio_concentrations
  add column if not exists applies_to text not null default 'studio';

do $$ begin
  alter table public.studio_concentrations
    add constraint studio_concentrations_applies_to_check
    check (applies_to in ('studio', 'dance_team'));
exception when duplicate_object then null; end $$;

-- The 3 existing rows keep applies_to='studio' (the column default) — no
-- studio behavior changes.

insert into public.studio_concentrations (slug, label, sort_order, applies_to)
values
  ('team-competition', 'Competition', 1, 'dance_team'),
  ('team-performance-exhibition', 'Performance / Exhibition', 2, 'dance_team'),
  ('team-spirit-game-day', 'Spirit / Game Day', 3, 'dance_team'),
  ('team-recreational-club', 'Recreational / Club', 4, 'dance_team')
on conflict (slug) do nothing;

commit;

-- ============================================================================
-- END. Additive only. ROLLBACK (if ever needed):
--   begin;
--   delete from public.studio_concentrations where applies_to = 'dance_team';
--   alter table public.studio_concentrations drop constraint if exists studio_concentrations_applies_to_check;
--   alter table public.studio_concentrations drop column if exists applies_to;
--   commit;
-- ============================================================================
