-- ============================================================
-- HYPE Tracking System — Migration 003
-- 1. Storage bucket proof-files + policies
-- 2. Update proof_files RLS (tambah DELETE)
-- 3. Fungsi transition_claim_status (semua Fase 1 & 2)
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

-- ── Storage bucket ────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proof-files',
  'proof-files',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Upload: hanya pemilik claim
DROP POLICY IF EXISTS "proof_files_storage_insert" ON storage.objects;
CREATE POLICY "proof_files_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'proof-files'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.claims
      WHERE claim_id::text = split_part(name, '/', 1)
        AND user_id = auth.uid()
    )
  );

-- Read: pemilik claim + internal
DROP POLICY IF EXISTS "proof_files_storage_select" ON storage.objects;
CREATE POLICY "proof_files_storage_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'proof-files'
    AND (
      public.get_my_role() = 'internal'
      OR EXISTS (
        SELECT 1 FROM public.claims
        WHERE claim_id::text = split_part(name, '/', 1)
          AND user_id = auth.uid()
      )
    )
  );

-- Delete: pemilik claim & hanya saat status belum final
DROP POLICY IF EXISTS "proof_files_storage_delete" ON storage.objects;
CREATE POLICY "proof_files_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'proof-files'
    AND EXISTS (
      SELECT 1 FROM public.claims
      WHERE claim_id::text = split_part(name, '/', 1)
        AND user_id = auth.uid()
        AND claim_status IN ('in_progress', 'semi_dealing', 'nomor_invalid')
    )
  );


-- ── Update proof_files RLS (tambah DELETE + perkuat INSERT) ───────────────
DROP POLICY IF EXISTS "proof_files_insert" ON public.proof_files;
CREATE POLICY "proof_files_insert"
  ON public.proof_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.claims
      WHERE claim_id = proof_files.claim_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "proof_files_delete" ON public.proof_files;
CREATE POLICY "proof_files_delete"
  ON public.proof_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.claims
      WHERE claim_id = proof_files.claim_id
        AND user_id = auth.uid()
        AND claim_status IN ('in_progress', 'semi_dealing', 'nomor_invalid')
    )
  );


-- ── Fungsi transisi status (semua fase) ───────────────────────────────────
-- SECURITY DEFINER: bypass RLS agar update atomic, validasi manual di dalam fungsi
CREATE OR REPLACE FUNCTION public.transition_claim_status(
  p_claim_id     bigint,
  p_to_status    text,
  p_user_id      uuid,
  p_note         text    DEFAULT NULL,
  p_fail_reason  text    DEFAULT NULL,
  p_pic_name     text    DEFAULT NULL,
  p_wa_number    text    DEFAULT NULL,
  p_pic_position text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim       claims%ROWTYPE;
  v_user_role   text;
  v_proof_count int;
  v_from        text;
  v_note_text   text;
BEGIN
  -- Fetch klaim
  SELECT * INTO v_claim FROM claims WHERE claim_id = p_claim_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Klaim tidak ditemukan');
  END IF;

  v_from := v_claim.claim_status;

  -- Fetch role user
  SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pengguna tidak ditemukan');
  END IF;

  -- Otorisasi: freelancer hanya ubah klaim sendiri & transisi Fase 1
  IF v_user_role = 'freelancer' THEN
    IF v_claim.user_id != p_user_id THEN
      RETURN jsonb_build_object('error', 'Tidak berwenang mengubah klaim ini');
    END IF;
    IF p_to_status NOT IN ('semi_dealing', 'gagal', 'poi_mati', 'submitted', 'in_progress') THEN
      RETURN jsonb_build_object('error', 'Freelancer tidak berwenang melakukan transisi ini');
    END IF;
  END IF;

  -- Validasi aturan transisi (state machine)
  IF NOT (
    (v_from = 'in_progress'        AND p_to_status IN ('semi_dealing', 'gagal', 'poi_mati')) OR
    (v_from = 'semi_dealing'       AND p_to_status = 'submitted')                             OR
    (v_from = 'submitted'          AND p_to_status = 'validasi_nomor')                        OR
    (v_from = 'validasi_nomor'     AND p_to_status IN ('fiksasi_kerjasama', 'nomor_invalid')) OR
    (v_from = 'nomor_invalid'      AND p_to_status = 'in_progress')                           OR
    (v_from = 'fiksasi_kerjasama'  AND p_to_status IN ('disetujui_diklaim', 'declined'))      OR
    (v_from = 'disetujui_diklaim'  AND p_to_status = 'koordinasi_kreator')                    OR
    (v_from = 'koordinasi_kreator' AND p_to_status = 'campaign_jalan')                        OR
    (v_from = 'campaign_jalan'     AND p_to_status = 'campaign_selesai')                      OR
    (v_from = 'campaign_selesai'   AND p_to_status = 'repeat_campaign')
  ) THEN
    RETURN jsonb_build_object(
      'error', format('Transisi %s → %s tidak diizinkan', v_from, p_to_status)
    );
  END IF;

  -- Validasi data per transisi
  IF p_to_status IN ('gagal', 'poi_mati') THEN
    IF p_fail_reason IS NULL OR trim(p_fail_reason) = '' THEN
      RETURN jsonb_build_object('error', 'Alasan wajib diisi');
    END IF;
  END IF;

  IF p_to_status = 'semi_dealing' THEN
    IF p_pic_name IS NULL OR trim(p_pic_name) = '' THEN
      RETURN jsonb_build_object('error', 'Nama PIC wajib diisi');
    END IF;
    IF p_wa_number IS NULL OR trim(p_wa_number) = '' THEN
      RETURN jsonb_build_object('error', 'Nomor WhatsApp wajib diisi');
    END IF;
  END IF;

  IF p_to_status = 'submitted' THEN
    IF COALESCE(trim(v_claim.pic_name), '') = '' THEN
      RETURN jsonb_build_object('error', 'Nama PIC belum diisi. Edit kontak dulu.');
    END IF;
    IF COALESCE(trim(v_claim.wa_number), '') = '' THEN
      RETURN jsonb_build_object('error', 'Nomor WhatsApp belum diisi. Edit kontak dulu.');
    END IF;
    SELECT COUNT(*) INTO v_proof_count FROM proof_files WHERE claim_id = p_claim_id;
    IF v_proof_count = 0 THEN
      RETURN jsonb_build_object('error', 'Upload minimal 1 bukti foto/screenshot sebelum submit');
    END IF;
  END IF;

  -- Tentukan teks note untuk history
  v_note_text := CASE
    WHEN p_to_status IN ('gagal', 'poi_mati') THEN p_fail_reason
    ELSE p_note
  END;

  -- Update klaim
  UPDATE claims SET
    claim_status               = p_to_status,
    fail_reason                = CASE WHEN p_fail_reason  IS NOT NULL THEN p_fail_reason  ELSE fail_reason  END,
    pic_name                   = CASE WHEN p_pic_name     IS NOT NULL THEN p_pic_name     ELSE pic_name     END,
    wa_number                  = CASE WHEN p_wa_number    IS NOT NULL THEN p_wa_number    ELSE wa_number    END,
    pic_position               = CASE WHEN p_pic_position IS NOT NULL THEN p_pic_position ELSE pic_position END,
    submitted_at               = CASE WHEN p_to_status = 'submitted'  THEN now()          ELSE submitted_at END,
    wa_validated_by_freelancer = CASE WHEN p_to_status = 'submitted'  THEN true           ELSE wa_validated_by_freelancer END,
    is_retryable               = CASE
                                   WHEN p_to_status = 'gagal'    THEN true
                                   WHEN p_to_status = 'poi_mati' THEN false
                                   ELSE is_retryable
                                 END,
    last_activity_at           = now()
  WHERE claim_id = p_claim_id;

  -- Tulis status_history
  INSERT INTO status_history (poi_id, claim_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (v_claim.poi_id, p_claim_id, v_from, p_to_status, p_user_id, v_user_role, v_note_text);

  -- Update status POI
  IF p_to_status = 'gagal' THEN
    -- POI balik ke available + catat transisi ganda di history
    UPDATE pois SET status = 'available', current_claim_id = NULL WHERE poi_id = v_claim.poi_id;
    INSERT INTO status_history (poi_id, claim_id, from_status, to_status, changed_by, changed_by_role)
    VALUES (v_claim.poi_id, p_claim_id, 'gagal', 'available', p_user_id, v_user_role);

  ELSIF p_to_status = 'poi_mati' THEN
    -- POI mati permanen
    UPDATE pois SET status = 'poi_mati', current_claim_id = NULL WHERE poi_id = v_claim.poi_id;

  ELSE
    -- Semua transisi lain: POI ikuti status klaim
    UPDATE pois SET status = p_to_status WHERE poi_id = v_claim.poi_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
