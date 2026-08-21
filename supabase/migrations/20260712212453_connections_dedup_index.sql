-- ============================================================================
-- Relevé Connect — Migration: connection de-dup + lookup index (Step 4, slice 2)
-- ----------------------------------------------------------------------------
-- The hiring actions (save + the lean in-app intro request, CLAUDE.md Open
-- Decision 2) are recorded in the existing `connections` table — its RLS and the
-- connection_type enum ('view' | 'save' | 'message-request') already fit. This
-- migration only adds two things for correctness + speed:
--   1. A unique index on (from_user_id, to_profile_id, type) so a "save" is
--      idempotent and there's at most one connection of a given type per
--      (sender → target) pair — and so the server can UPSERT on it.
--   2. An index on from_user_id to make "my saved / my sent requests" fast (the
--      table already has one on to_profile_id for "requests I received").
--
-- Idempotent (create-index-if-not-exists). No data changes.
-- ============================================================================

begin;

create unique index if not exists connections_sender_target_type_uniq
  on public.connections (from_user_id, to_profile_id, type);

create index if not exists connections_from_user_idx
  on public.connections (from_user_id);

commit;
