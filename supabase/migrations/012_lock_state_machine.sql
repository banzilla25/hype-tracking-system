-- ============================================================
-- HYPE Tracking System — Migration 012
-- Kunci state machine di level database:
-- 1. CHECK constraint di claims.claim_status (selama ini cuma
--    dijaga di RPC, tidak ada penghalang di DB kalau ada yang
--    PATCH langsung lewat REST API).
-- 2. Column-level GRANT: authenticated hanya boleh UPDATE
--    langsung kolom kontak + progress aktual campaign (yang
--    memang dipakai updateContactInfo & updateCampaignProgress).
--    Kolom lain (claim_status, deal_type, target campaign, dst)
--    HANYA bisa diubah lewat fungsi SECURITY DEFINER
--    (transition_claim_status, delete_claim) yang jalan sebagai
--    owner — tidak terpengaruh REVOKE ini.
--
-- PENTING: sebelum jalankan, cek dulu tidak ada claim_status
-- yang nyasar di luar daftar berikut:
--   SELECT DISTINCT claim_status FROM claims;
-- Semua hasilnya harus ada di dalam daftar CHECK di bawah.
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

-- ── 1. CHECK constraint claim_status ──────────────────────────────────────
ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_claim_status_check;
ALTER TABLE public.claims
  ADD CONSTRAINT claims_claim_status_check
  CHECK (claim_status IN (
    'available', 'in_progress', 'gagal', 'poi_mati', 'semi_dealing',
    'submitted', 'validasi_nomor', 'nomor_invalid', 'fiksasi_kerjasama',
    'declined', 'disetujui_diklaim', 'koordinasi_kreator',
    'campaign_jalan', 'campaign_selesai', 'repeat_campaign'
  ));

-- ── 2. CHECK constraint deal_type (sudah divalidasi di RPC, sekarang juga di DB) ──
ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_deal_type_check;
ALTER TABLE public.claims
  ADD CONSTRAINT claims_deal_type_check
  CHECK (deal_type IS NULL OR deal_type IN ('buka_kamar', 'voucher_makanan'));

-- ── 3. Kunci kolom yang boleh diupdate langsung oleh authenticated ────────
REVOKE UPDATE ON public.claims FROM authenticated;
GRANT UPDATE (
  pic_name, wa_number, pic_position, last_activity_at,
  campaign_uploaded_videos, campaign_actual_kreator,
  campaign_actual_gmv, campaign_actual_orders
) ON public.claims TO authenticated;
