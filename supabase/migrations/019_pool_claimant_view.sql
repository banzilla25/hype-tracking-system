-- ============================================================
-- HYPE Tracking System — Migration 019
-- View pool_claimants: tampilkan nama freelancer yang sedang
-- mengerjakan POI tertentu di Pool, TANPA bocorkan data sensitif
-- klaim lain (wa_number, pic_name, dst) ke freelancer lain.
--
-- RLS claims_select cuma izinkan user lihat klaim sendiri (atau
-- internal lihat semua) -- itu sengaja, supaya kontak merchant
-- tidak bocor antar freelancer. View ini cuma expose 2 kolom
-- (claim_id, nickname) untuk klaim yang masih aktif dikerjakan,
-- pakai SECURITY INVOKER=false (security_barrier via fungsi) agar
-- bisa dibaca semua authenticated user tanpa lewat RLS claims.
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pool_claimants()
RETURNS TABLE (claim_id bigint, nickname text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT c.claim_id, p.nickname
  FROM claims c
  JOIN profiles p ON p.id = c.user_id
  WHERE c.claim_status IN ('in_progress', 'semi_dealing', 'nomor_invalid');
$$;

GRANT EXECUTE ON FUNCTION public.get_pool_claimants TO authenticated;
