-- ============================================================
-- HYPE Tracking System — Migration 018
-- Fix delete_claim: notifications.claim_id FK ke claims belum
-- dibersihkan. Sejak migration 014 menambah notifikasi untuk
-- hampir semua transisi status, tiap klaim pasti punya banyak
-- baris notifications yang menunjuk ke claim_id-nya -- belum
-- pernah dihapus sebelum DELETE FROM claims, jadi kena FK violation.
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

  -- Aktifkan bypass trigger (lokal untuk transaksi ini saja)
  PERFORM set_config('app.bypass_history_protection', 'on', true);

  -- 1. Nullify FK di status_history supaya claim bisa dihapus
  UPDATE status_history SET claim_id = NULL WHERE claim_id = p_claim_id;

  -- 2. Hapus catatan
  DELETE FROM notes WHERE claim_id = p_claim_id;

  -- 3. Hapus referensi proof_files (file storage dihapus dari server action)
  DELETE FROM proof_files WHERE claim_id = p_claim_id;

  -- 4. Hapus histori round campaign (kalau klaim ini pernah repeat_campaign)
  DELETE FROM campaign_rounds WHERE claim_id = p_claim_id;

  -- 5. Hapus notifikasi yang menunjuk ke klaim ini
  DELETE FROM notifications WHERE claim_id = p_claim_id;

  -- 6. Putus FK poi → claim sebelum hapus claim
  UPDATE pois SET current_claim_id = NULL WHERE poi_id = v_poi_id;

  -- 7. Hapus klaim
  DELETE FROM claims WHERE claim_id = p_claim_id;

  -- 8. Tangani POI
  SELECT COUNT(*) INTO v_other_claims FROM claims WHERE poi_id = v_poi_id;

  IF v_poi_source = 'freelancer' AND v_other_claims = 0 THEN
    -- POI freelancer tanpa klaim lain: hapus POI + history-nya
    DELETE FROM status_history WHERE poi_id = v_poi_id;
    DELETE FROM pois WHERE poi_id = v_poi_id;
  ELSE
    -- POI internal atau masih ada klaim lain: kembalikan ke available
    UPDATE pois SET status = 'available' WHERE poi_id = v_poi_id;
  END IF;

  -- Matikan bypass (opsional, sudah local per transaksi)
  PERFORM set_config('app.bypass_history_protection', 'off', true);

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_claim TO authenticated;
