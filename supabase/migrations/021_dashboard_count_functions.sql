-- ============================================================
-- HYPE Tracking System — Migration 021
-- Fungsi aggregate untuk dashboard agar tidak kena limit 1000 baris Supabase
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

-- ── 1. Hitung POI per status ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_poi_status_counts()
RETURNS TABLE(status text, cnt bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status::text, COUNT(*)::bigint
  FROM public.pois
  GROUP BY status;
$$;

-- ── 2. Ringkasan klaim (total, submitted, selesai) ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_claims_summary()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total',             COUNT(*),
    'submitted',         COUNT(*) FILTER (WHERE submitted_at IS NOT NULL),
    'campaign_selesai',  COUNT(*) FILTER (WHERE claim_status = 'campaign_selesai')
  )
  FROM public.claims;
$$;

-- ── 3. Statistik per freelancer (untuk rapor kinerja) ─────────────────────
-- DROP dulu karena return type berubah (tambah kolom fee_aman)
DROP FUNCTION IF EXISTS public.get_freelancer_stats();
CREATE OR REPLACE FUNCTION public.get_freelancer_stats()
RETURNS TABLE(
  user_id          uuid,
  nickname         text,
  total            bigint,
  submitted        bigint,
  gagal            bigint,
  auto_release     bigint,
  campaign_selesai bigint,
  fee_aman         bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.user_id,
    COALESCE(p.nickname, '(akun dihapus)')                                  AS nickname,
    COUNT(*)                                                                 AS total,
    COUNT(*) FILTER (WHERE c.submitted_at IS NOT NULL)                      AS submitted,
    COUNT(*) FILTER (WHERE c.claim_status = 'gagal'
                       AND (c.release_reason IS NULL OR c.release_reason = '')) AS gagal,
    COUNT(*) FILTER (WHERE c.claim_status = 'gagal'
                       AND c.release_reason = 'inactivity')                 AS auto_release,
    COUNT(*) FILTER (WHERE c.claim_status = 'campaign_selesai')             AS campaign_selesai,
    -- Fee aman = lolos validasi nomor (status sudah melewati tahap validasi internal)
    COUNT(*) FILTER (WHERE c.claim_status IN (
      'fiksasi_kerjasama', 'declined', 'disetujui_diklaim',
      'koordinasi_kreator', 'campaign_jalan', 'campaign_selesai', 'repeat_campaign'
    ))                                                                       AS fee_aman
  FROM public.claims c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  GROUP BY c.user_id, p.nickname
  ORDER BY submitted DESC;
$$;
