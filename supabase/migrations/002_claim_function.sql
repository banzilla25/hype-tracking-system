-- ============================================================
-- HYPE Tracking System — Migration 002
-- 1. Update RLS pois (tambah visibility in_progress untuk pool)
-- 2. Fungsi claim_poi atomik
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

-- ── Update RLS pois ────────────────────────────────────────────────────────
-- Pool perlu lihat in_progress POI (untuk tampilkan yang terkunci)
DROP POLICY IF EXISTS "pois_select" ON public.pois;
CREATE POLICY "pois_select"
  ON public.pois FOR SELECT
  USING (
    public.get_my_role() = 'internal'
    OR status IN ('available', 'in_progress')           -- pool: available + terkunci
    OR current_claim_id IN (                            -- tugas saya: semua milik user
      SELECT claim_id FROM public.claims WHERE user_id = auth.uid()
    )
  );


-- ── Fungsi klaim atomik ────────────────────────────────────────────────────
-- SECURITY DEFINER agar UPDATE berjalan atomik tanpa race condition
CREATE OR REPLACE FUNCTION public.claim_poi(
  p_poi_id  text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim_id      bigint;
  v_active_claims int;
BEGIN
  -- Cek limit: maks 10 POI aktif per freelancer
  -- Aktif = belum selesai/dilepas
  SELECT COUNT(*) INTO v_active_claims
  FROM public.claims
  WHERE user_id = p_user_id
    AND claim_status NOT IN (
      'gagal', 'poi_mati', 'declined', 'campaign_selesai', 'repeat_campaign'
    );

  IF v_active_claims >= 10 THEN
    RETURN jsonb_build_object(
      'error',
      'Batas maksimal 10 POI aktif sudah tercapai. Selesaikan atau lepas salah satu dulu.'
    );
  END IF;

  -- Atomic check-and-update: hanya berhasil kalau POI masih 'available'
  -- Kalau dua user klik bersamaan, hanya satu yang menang (row lock)
  UPDATE public.pois
  SET status = 'in_progress'
  WHERE poi_id = p_poi_id
    AND status = 'available';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'POI sudah tidak tersedia. Coba pilih yang lain.'
    );
  END IF;

  -- Buat claim record
  INSERT INTO public.claims (poi_id, user_id, claim_status, last_activity_at)
  VALUES (p_poi_id, p_user_id, 'in_progress', now())
  RETURNING claim_id INTO v_claim_id;

  -- Simpan referensi ke claim aktif di pois
  UPDATE public.pois
  SET current_claim_id = v_claim_id
  WHERE poi_id = p_poi_id;

  -- Audit trail
  INSERT INTO public.status_history (
    poi_id, claim_id, from_status, to_status, changed_by, changed_by_role
  )
  VALUES (p_poi_id, v_claim_id, 'available', 'in_progress', p_user_id, 'freelancer');

  RETURN jsonb_build_object('success', true, 'claim_id', v_claim_id);
END;
$$;
