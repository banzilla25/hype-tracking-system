-- ============================================================
-- HYPE Tracking System — Migration 008
-- Fungsi delete_claim: hapus pipeline klaim beserta data terkait
-- Hanya bisa dijalankan oleh internal
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_claim(
  p_claim_id bigint,
  p_user_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role    text;
  v_poi_id       text;
  v_poi_source   text;
  v_other_claims int;
BEGIN
  -- Hanya internal yang bisa delete
  SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
  IF v_user_role IS DISTINCT FROM 'internal' THEN
    RETURN jsonb_build_object('error', 'Hanya tim internal yang bisa menghapus pipeline');
  END IF;

  -- Ambil data klaim
  SELECT poi_id INTO v_poi_id FROM claims WHERE claim_id = p_claim_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Klaim tidak ditemukan');
  END IF;

  SELECT source INTO v_poi_source FROM pois WHERE poi_id = v_poi_id;

  -- 1. Nullify referensi claim_id di status_history (FK nullable)
  UPDATE status_history SET claim_id = NULL WHERE claim_id = p_claim_id;

  -- 2. Hapus catatan
  DELETE FROM notes WHERE claim_id = p_claim_id;

  -- 3. Hapus referensi proof_files (file storage dihapus dari server action)
  DELETE FROM proof_files WHERE claim_id = p_claim_id;

  -- 4. Putus FK poi → claim sebelum hapus claim
  UPDATE pois SET current_claim_id = NULL WHERE poi_id = v_poi_id;

  -- 5. Hapus klaim
  DELETE FROM claims WHERE claim_id = p_claim_id;

  -- 6. Tangani POI
  SELECT COUNT(*) INTO v_other_claims FROM claims WHERE poi_id = v_poi_id;

  IF v_poi_source = 'freelancer' AND v_other_claims = 0 THEN
    -- POI freelancer tanpa klaim lain: hapus POI + history-nya
    DELETE FROM status_history WHERE poi_id = v_poi_id;
    DELETE FROM pois WHERE poi_id = v_poi_id;
  ELSE
    -- POI internal atau masih ada klaim lain: kembalikan ke available
    UPDATE pois SET status = 'available' WHERE poi_id = v_poi_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_claim TO authenticated;
