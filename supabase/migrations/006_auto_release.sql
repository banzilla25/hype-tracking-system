-- ============================================================
-- HYPE Tracking System — Migration 006
-- Auto-Release: POI dengan last_activity_at > 7 hari + status
-- in_progress / semi_dealing → balik ke available.
-- Dipanggil via supabase.rpc() saat load pool / tasks page.
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_release_stale_claims()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim    claims%ROWTYPE;
  v_released int := 0;
  v_poi_name text;
BEGIN
  FOR v_claim IN
    SELECT *
    FROM claims
    WHERE claim_status IN ('in_progress', 'semi_dealing')
      AND last_activity_at < now() - interval '7 days'
  LOOP
    -- Ambil nama POI untuk pesan notifikasi
    SELECT name INTO v_poi_name FROM pois WHERE poi_id = v_claim.poi_id;

    -- Update klaim → gagal (auto-release)
    UPDATE claims SET
      claim_status     = 'gagal',
      fail_reason      = 'Auto-release: tidak ada aktivitas lebih dari 7 hari',
      release_reason   = 'inactivity',
      is_retryable     = true,
      last_activity_at = now()
    WHERE claim_id = v_claim.claim_id;

    -- Update POI → available
    UPDATE pois SET
      status           = 'available',
      current_claim_id = NULL
    WHERE poi_id = v_claim.poi_id;

    -- History: in_progress/semi_dealing → gagal (oleh sistem)
    INSERT INTO status_history (poi_id, claim_id, from_status, to_status, changed_by, changed_by_role, note)
    VALUES (
      v_claim.poi_id, v_claim.claim_id,
      v_claim.claim_status, 'gagal',
      NULL, 'system',
      'Auto-release: tidak ada aktivitas lebih dari 7 hari'
    );

    -- History: gagal → available (oleh sistem)
    INSERT INTO status_history (poi_id, claim_id, from_status, to_status, changed_by, changed_by_role)
    VALUES (v_claim.poi_id, v_claim.claim_id, 'gagal', 'available', NULL, 'system');

    -- Buat notifikasi untuk freelancer
    INSERT INTO notifications (user_id, claim_id, poi_id, type, message)
    VALUES (
      v_claim.user_id,
      v_claim.claim_id,
      v_claim.poi_id,
      'auto_release',
      'POI ' || COALESCE(v_poi_name, v_claim.poi_id) ||
      ' otomatis dilepas karena tidak ada aktivitas selama 7 hari. POI kembali ke pool.'
    );

    v_released := v_released + 1;
  END LOOP;

  RETURN v_released;
END;
$$;
