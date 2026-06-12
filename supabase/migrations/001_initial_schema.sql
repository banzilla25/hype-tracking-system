-- ============================================================
-- HYPE Tracking System — Initial Schema Migration v1
-- Supabase / PostgreSQL
--
-- Cara menjalankan:
--   Supabase Dashboard → SQL Editor → paste seluruh file → Run
-- ============================================================


-- =============================================
-- SECTION 1: Tables
-- =============================================

-- ── profiles (extends auth.users) ───────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname       text        NOT NULL,
  role           text        NOT NULL DEFAULT 'freelancer'
                             CHECK (role IN ('freelancer', 'internal')),
  account_status text        NOT NULL DEFAULT 'pending'
                             CHECK (account_status IN ('pending', 'active', 'inactive')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- SECTION 0: Helper Function
-- =============================================

-- Dibuat setelah profiles agar relasi sudah ada saat fungsi dikompilasi
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ── pois ─────────────────────────────────────
-- current_claim_id FK ditambahkan setelah tabel claims dibuat (circular ref)
CREATE TABLE IF NOT EXISTS public.pois (
  poi_id           text        PRIMARY KEY,
  name             text        NOT NULL,
  category         text        NOT NULL,
  city             text        NOT NULL,
  area             text        NOT NULL,
  aov              numeric,
  is_undersupplied boolean,
  priority_tag     text,
  status           text        NOT NULL DEFAULT 'available'
                               CHECK (status IN (
                                 'available', 'in_progress', 'gagal', 'poi_mati',
                                 'semi_dealing', 'submitted', 'validasi_nomor',
                                 'nomor_invalid', 'fiksasi_kerjasama', 'declined',
                                 'disetujui_diklaim', 'koordinasi_kreator',
                                 'campaign_jalan', 'campaign_selesai', 'repeat_campaign'
                               )),
  current_claim_id bigint,
  source           text        NOT NULL DEFAULT 'freelancer'
                               CHECK (source IN ('freelancer', 'internal')),
  source_campaign  text,
  latitude         numeric,
  longitude        numeric,
  full_address     text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── claims ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claims (
  claim_id                   bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  poi_id                     text        NOT NULL REFERENCES public.pois(poi_id),
  user_id                    uuid        NOT NULL REFERENCES public.profiles(id),
  claim_status               text        NOT NULL,
  pic_name                   text,
  pic_position               text,
  wa_number                  text,
  wa_validated_by_freelancer boolean     NOT NULL DEFAULT false,
  wa_validated_by_bd         boolean     NOT NULL DEFAULT false,
  fail_reason                text,
  is_retryable               boolean,
  deal_type                  text,
  cooperation_result         text,
  campaign_target_videos     int,
  campaign_uploaded_videos   int         NOT NULL DEFAULT 0,
  creator_visit_date         timestamptz,
  claimed_at                 timestamptz NOT NULL DEFAULT now(),
  submitted_at               timestamptz,
  validated_at               timestamptz,
  fixed_at                   timestamptz,
  campaign_started_at        timestamptz,
  completed_at               timestamptz,
  last_activity_at           timestamptz NOT NULL DEFAULT now(),
  release_reason             text
);

-- Tambah FK setelah claims dibuat
ALTER TABLE public.pois
  ADD CONSTRAINT pois_current_claim_id_fkey
  FOREIGN KEY (current_claim_id) REFERENCES public.claims(claim_id);

-- ── status_history (append-only) ─────────────
CREATE TABLE IF NOT EXISTS public.status_history (
  history_id      bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  poi_id          text        NOT NULL REFERENCES public.pois(poi_id),
  claim_id        bigint      REFERENCES public.claims(claim_id),
  from_status     text,
  to_status       text        NOT NULL,
  changed_by      uuid        REFERENCES public.profiles(id),
  changed_by_role text        NOT NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── notes ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notes (
  note_id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id         bigint      NOT NULL REFERENCES public.claims(claim_id),
  author_id        uuid        NOT NULL REFERENCES public.profiles(id),
  phase            text        NOT NULL CHECK (phase IN ('akuisisi', 'campaign')),
  is_internal_only boolean     NOT NULL DEFAULT false,
  note_text        text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── proof_files ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.proof_files (
  file_id     bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id    bigint      NOT NULL REFERENCES public.claims(claim_id),
  file_type   text        NOT NULL CHECK (file_type IN ('proof_chat', 'proof_visit')),
  file_url    text        NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);


-- =============================================
-- SECTION 2: Append-Only Enforcement
-- =============================================

-- status_history tidak boleh diupdate atau dihapus sama sekali
CREATE OR REPLACE FUNCTION public.prevent_status_history_modification()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'status_history adalah append-only dan tidak bisa diubah atau dihapus';
END;
$$;

CREATE TRIGGER trg_no_update_status_history
  BEFORE UPDATE ON public.status_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_status_history_modification();

CREATE TRIGGER trg_no_delete_status_history
  BEFORE DELETE ON public.status_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_status_history_modification();


-- =============================================
-- SECTION 3: Indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_pois_status         ON public.pois(status);
CREATE INDEX IF NOT EXISTS idx_pois_category       ON public.pois(category);
CREATE INDEX IF NOT EXISTS idx_pois_area           ON public.pois(area);
CREATE INDEX IF NOT EXISTS idx_claims_user_id      ON public.claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_poi_id       ON public.claims(poi_id);
CREATE INDEX IF NOT EXISTS idx_claims_status       ON public.claims(claim_status);
CREATE INDEX IF NOT EXISTS idx_sh_poi_id           ON public.status_history(poi_id);
CREATE INDEX IF NOT EXISTS idx_sh_claim_id         ON public.status_history(claim_id);
CREATE INDEX IF NOT EXISTS idx_notes_claim_id      ON public.notes(claim_id);
CREATE INDEX IF NOT EXISTS idx_proof_files_claim   ON public.proof_files(claim_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status     ON public.profiles(account_status);


-- =============================================
-- SECTION 4: Enable Row Level Security
-- =============================================

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pois           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proof_files    ENABLE ROW LEVEL SECURITY;


-- =============================================
-- SECTION 5: RLS Policies
-- =============================================

-- ── profiles ──────────────────────────────────

-- SELECT: baca profil sendiri ATAU internal bisa baca semua
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.get_my_role() = 'internal'
  );

-- INSERT: user daftarkan profil sendiri saat first login
CREATE POLICY "profiles_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- UPDATE: update profil sendiri ATAU internal bisa update semua (untuk approve akun)
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR public.get_my_role() = 'internal'
  );

-- ── pois ──────────────────────────────────────

-- SELECT: internal lihat semua; freelancer lihat available + POI miliknya
CREATE POLICY "pois_select"
  ON public.pois FOR SELECT
  USING (
    public.get_my_role() = 'internal'
    OR status = 'available'
    OR current_claim_id IN (
      SELECT claim_id FROM public.claims WHERE user_id = auth.uid()
    )
  );

-- INSERT: hanya internal (untuk sourcing F&B mandiri)
CREATE POLICY "pois_insert"
  ON public.pois FOR INSERT
  WITH CHECK (public.get_my_role() = 'internal');

-- UPDATE: user terautentikasi (validasi state machine dilakukan di server)
CREATE POLICY "pois_update"
  ON public.pois FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ── claims ────────────────────────────────────

-- SELECT: claim milik sendiri ATAU internal lihat semua
CREATE POLICY "claims_select"
  ON public.claims FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.get_my_role() = 'internal'
  );

-- INSERT: user terautentikasi (claim baru)
CREATE POLICY "claims_insert"
  ON public.claims FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: claim milik sendiri ATAU internal
CREATE POLICY "claims_update"
  ON public.claims FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.get_my_role() = 'internal'
  );

-- ── status_history ────────────────────────────

-- SELECT: history claim milik sendiri ATAU internal lihat semua
CREATE POLICY "status_history_select"
  ON public.status_history FOR SELECT
  USING (
    public.get_my_role() = 'internal'
    OR claim_id IN (
      SELECT claim_id FROM public.claims WHERE user_id = auth.uid()
    )
  );

-- INSERT: user terautentikasi
CREATE POLICY "status_history_insert"
  ON public.status_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── notes ──────────────────────────────────────

-- SELECT: internal lihat semua; freelancer hanya lihat notes non-internal miliknya
CREATE POLICY "notes_select"
  ON public.notes FOR SELECT
  USING (
    public.get_my_role() = 'internal'
    OR (
      is_internal_only = false
      AND claim_id IN (
        SELECT claim_id FROM public.claims WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: author harus user sendiri
CREATE POLICY "notes_insert"
  ON public.notes FOR INSERT
  WITH CHECK (author_id = auth.uid());

-- ── proof_files ───────────────────────────────

-- SELECT: file claim milik sendiri ATAU internal lihat semua
CREATE POLICY "proof_files_select"
  ON public.proof_files FOR SELECT
  USING (
    public.get_my_role() = 'internal'
    OR claim_id IN (
      SELECT claim_id FROM public.claims WHERE user_id = auth.uid()
    )
  );

-- INSERT: user terautentikasi
CREATE POLICY "proof_files_insert"
  ON public.proof_files FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
