-- ============================================================
-- HYPE Tracking System — Migration 017
-- Fix trigger bypass status_history: untuk BEFORE UPDATE trigger,
-- RETURN OLD itu artinya "batalkan perubahan, tulis balik nilai
-- lama" -- bukan "izinkan perubahan". Migration 009 salah pakai
-- RETURN OLD untuk kasus bypass UPDATE, jadi UPDATE status_history
-- SET claim_id = NULL di delete_claim() selama ini SELALU gagal
-- diam-diam (baris tidak benar-benar berubah), bikin DELETE FROM
-- claims kena foreign key violation.
--
-- Untuk DELETE trigger, RETURN OLD memang benar (itu cara
-- mengizinkan delete-nya jalan), jadi behavior itu dibiarkan.
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_status_history_modification()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.bypass_history_protection', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;   -- izinkan delete jalan
    ELSE
      RETURN NEW;    -- izinkan update jalan (pakai nilai baru, bukan nilai lama)
    END IF;
  END IF;
  RAISE EXCEPTION 'status_history adalah append-only dan tidak bisa diubah atau dihapus';
END;
$$;
