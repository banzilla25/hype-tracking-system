"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  startValidation,
  markNumberValid,
  markNumberInvalid,
  approveKerjasama,
  declineKerjasama,
  setKoordinasiKreator,
  startCampaign,
  completeCampaign,
  updateCampaignVideos,
} from "@/lib/actions/leads";
import ClaimTimeline from "@/components/claim-timeline";
import NotesSection from "@/components/notes-section";

// ── Types ──────────────────────────────────────────────────────────────────

export type HistoryEntry = {
  history_id: number;
  from_status: string | null;
  to_status: string;
  changed_by_role: string;
  note: string | null;
  created_at: string;
  profiles: { nickname: string } | null;
};

export type NoteEntry = {
  note_id: number;
  author_id: string;
  phase: string;
  is_internal_only: boolean;
  note_text: string;
  created_at: string;
  profiles: { nickname: string } | null;
};

type LeadClaim = {
  claim_id: number;
  user_id: string;
  claim_status: string;
  pic_name: string | null;
  pic_position: string | null;
  wa_number: string | null;
  wa_validated_by_freelancer: boolean | null;
  wa_validated_by_bd: boolean | null;
  fail_reason: string | null;
  deal_type: string | null;
  cooperation_result: string | null;
  campaign_target_videos: number | null;
  campaign_uploaded_videos: number | null;
  creator_visit_date: string | null;
  submitted_at: string | null;
  validated_at: string | null;
  fixed_at: string | null;
  campaign_started_at: string | null;
  completed_at: string | null;
  last_activity_at: string;
  poi_id: string;
};

type LeadPoi = {
  poi_id: string;
  name: string;
  category: string;
  area: string;
  city: string;
  is_undersupplied: boolean | null;
  priority_tag: string | null;
  source: string;
};

type ProofFile = {
  file_id: number;
  file_type: string;
  file_url: string;
  signedUrl: string | null;
  uploaded_at: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  submitted:          { label: "Submitted",       badgeClass: "bg-yellow-100 text-yellow-700" },
  validasi_nomor:     { label: "Validasi Nomor",  badgeClass: "bg-blue-100 text-blue-700" },
  nomor_invalid:      { label: "Nomor Invalid",   badgeClass: "bg-red-100 text-red-700" },
  fiksasi_kerjasama:  { label: "Fiksasi",         badgeClass: "bg-purple-100 text-purple-700" },
  disetujui_diklaim:  { label: "Disetujui",       badgeClass: "bg-teal-100 text-teal-700" },
  koordinasi_kreator: { label: "Koordinasi",      badgeClass: "bg-cyan-100 text-cyan-700" },
  campaign_jalan:     { label: "Campaign Jalan",  badgeClass: "bg-emerald-100 text-emerald-700" },
  campaign_selesai:   { label: "Selesai",         badgeClass: "bg-gray-100 text-gray-600" },
  declined:           { label: "Declined",        badgeClass: "bg-red-100 text-red-700" },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
}

type ActiveForm = "invalid" | "decline" | "approve" | "koordinasi" | "videos" | null;

// ── Main component ─────────────────────────────────────────────────────────

const NOTE_ALLOWED_STATUSES_INTERNAL = [
  "fiksasi_kerjasama", "koordinasi_kreator", "campaign_selesai",
];

export default function LeadDetailClient({
  claim,
  poi,
  proofFiles,
  submitterNickname,
  history = [],
  notes = [],
}: {
  claim: LeadClaim;
  poi: LeadPoi;
  proofFiles: ProofFile[];
  submitterNickname: string;
  history?: HistoryEntry[];
  notes?: NoteEntry[];
}) {
  const router = useRouter();
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);

  // Form state
  const [failReason, setFailReason] = useState("");
  const [dealType, setDealType] = useState("");
  const [targetVideos, setTargetVideos] = useState("");
  const [visitDate, setVisitDate] = useState(
    claim.creator_visit_date
      ? new Date(claim.creator_visit_date).toISOString().slice(0, 16)
      : ""
  );
  const [videosInput, setVideosInput] = useState(String(claim.campaign_uploaded_videos ?? 0));

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const statusCfg = STATUS_CONFIG[claim.claim_status] ?? { label: claim.claim_status, badgeClass: "bg-gray-100 text-gray-600" };

  // ── Action handler ─────────────────────────────────────────────────────

  const doAction = (actionFn: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await actionFn();
      if (res.error) {
        setError(res.error);
        return;
      }
      setActiveForm(null);
      setFailReason("");
      setDealType("");
      setTargetVideos("");
      router.refresh();
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-3 z-10 flex items-center gap-3">
        <Link href="/leads" className="text-gray-500 p-0.5 -ml-1">
          <BackIcon className="w-5 h-5" />
        </Link>
        <h1 className="text-base font-semibold text-gray-900 flex-1 truncate">Antrian Leads</h1>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${statusCfg.badgeClass}`}>
          {statusCfg.label}
        </span>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* POI info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase">
              {poi.category}
            </span>
            {poi.source === "internal" && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                Internal Sourcing
              </span>
            )}
            {poi.is_undersupplied && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                ⚡ Prioritas
              </span>
            )}
          </div>
          <p className="text-base font-bold text-gray-900">{poi.name}</p>
          <p className="text-sm text-gray-500">{poi.area}, {poi.city}</p>
          <p className="text-xs text-gray-400 mt-1">
            Submitted oleh: <span className="font-medium">{submitterNickname}</span>
          </p>
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Info Kontak</h3>
          <div className="space-y-2">
            <Row label="Nama PIC" value={claim.pic_name} />
            {claim.pic_position && <Row label="Jabatan" value={claim.pic_position} />}
            <Row label="Nomor WA" value={claim.wa_number} />
            <div className="flex items-center gap-4 pt-1">
              <ValidBadge label="Verifikasi Freelancer" valid={!!claim.wa_validated_by_freelancer} />
              <ValidBadge label="Verifikasi Internal" valid={!!claim.wa_validated_by_bd} />
            </div>
          </div>
        </div>

        {/* Proof files */}
        {proofFiles.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Bukti ({proofFiles.length} file)
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {proofFiles.map((f) => (
                <a
                  key={f.file_id}
                  href={f.signedUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-xl overflow-hidden bg-gray-100 block"
                >
                  {f.signedUrl ? (
                    <img src={f.signedUrl} alt="Bukti" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileIcon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Deal & Campaign info (if applicable) */}
        {(claim.deal_type || claim.campaign_target_videos) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Deal & Campaign</h3>
            <div className="space-y-2">
              {claim.deal_type && (
                <Row label="Deal Type" value={claim.deal_type === "buka_kamar" ? "Buka Kamar" : "Voucher Makanan"} />
              )}
              {claim.campaign_target_videos && (
                <Row
                  label="Progress Video"
                  value={`${claim.campaign_uploaded_videos ?? 0} / ${claim.campaign_target_videos} video`}
                />
              )}
              {claim.creator_visit_date && (
                <Row label="Tanggal Visit Kreator" value={formatDate(claim.creator_visit_date)} />
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</h3>
          <div className="space-y-1.5">
            {[
              { label: "Submitted", date: claim.submitted_at },
              { label: "Validasi Nomor", date: claim.validated_at },
              { label: "Fiksasi / Declined", date: claim.fixed_at },
              { label: "Campaign Mulai", date: claim.campaign_started_at },
              { label: "Selesai", date: claim.completed_at },
            ]
              .filter((t) => t.date)
              .map((t) => (
                <div key={t.label} className="flex justify-between text-xs">
                  <span className="text-gray-500">{t.label}</span>
                  <span className="text-gray-700 font-medium">{formatDate(t.date)}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
            <span className="text-red-500 flex-shrink-0 mt-0.5 text-sm">✕</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 text-sm">✕</button>
          </div>
        )}

        {/* ── Status-specific actions ── */}

        {/* SUBMITTED */}
        {claim.claim_status === "submitted" && (
          <ActionBtn
            label="Mulai Validasi Nomor →"
            colorClass="bg-blue-600 hover:bg-blue-700"
            isPending={isPending}
            onClick={() => doAction(() => startValidation(claim.claim_id))}
          />
        )}

        {/* VALIDASI_NOMOR */}
        {claim.claim_status === "validasi_nomor" && (
          <>
            {activeForm === "invalid" && (
              <FailForm
                title="Alasan Nomor Tidak Valid"
                placeholder="Contoh: Nomor tidak aktif, salah nomor..."
                submitLabel="Tandai Invalid"
                submitClass="bg-red-600 hover:bg-red-700"
                value={failReason}
                onChange={setFailReason}
                isPending={isPending}
                error={error}
                onSubmit={() => doAction(() => markNumberInvalid(claim.claim_id, failReason))}
                onCancel={() => { setActiveForm(null); setFailReason(""); }}
              />
            )}
            {activeForm === null && (
              <div className="flex gap-2">
                <button
                  onClick={() => doAction(() => markNumberValid(claim.claim_id))}
                  disabled={isPending}
                  className="flex-1 py-3 bg-green-600 text-white text-sm font-semibold rounded-2xl hover:bg-green-700 disabled:opacity-40"
                >
                  {isPending ? "..." : "✓ Nomor Valid → Fiksasi"}
                </button>
                <button
                  onClick={() => setActiveForm("invalid")}
                  disabled={isPending}
                  className="flex-1 py-3 border border-red-200 text-red-600 text-sm font-medium rounded-2xl hover:bg-red-50 disabled:opacity-40"
                >
                  ✗ Nomor Invalid
                </button>
              </div>
            )}
          </>
        )}

        {/* NOMOR_INVALID (menunggu freelancer update) */}
        {claim.claim_status === "nomor_invalid" && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-4">
            <p className="text-sm font-semibold text-orange-700">Menunggu Freelancer</p>
            <p className="text-xs text-orange-600 mt-1">
              Nomor sudah ditandai invalid. Freelancer perlu update kontak dan kirim ulang.
            </p>
            {claim.fail_reason && (
              <p className="text-xs text-orange-500 mt-1.5 italic">"{claim.fail_reason}"</p>
            )}
          </div>
        )}

        {/* FIKSASI_KERJASAMA */}
        {claim.claim_status === "fiksasi_kerjasama" && (
          <>
            {activeForm === "approve" && (
              <div className="bg-white rounded-2xl border border-teal-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Detail Kerjasama</h3>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tipe Deal <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={dealType}
                    onChange={(e) => setDealType(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Pilih tipe...</option>
                    <option value="buka_kamar">Buka Kamar (Hotel)</option>
                    <option value="voucher_makanan">Voucher Makanan (F&B)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Target Video <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={targetVideos}
                    onChange={(e) => setTargetVideos(e.target.value)}
                    placeholder="Jumlah video yang harus diupload"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setActiveForm(null); setDealType(""); setTargetVideos(""); }} disabled={isPending}
                    className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 disabled:opacity-50">
                    Batal
                  </button>
                  <button
                    disabled={isPending || !dealType || !targetVideos}
                    onClick={() => doAction(() => approveKerjasama(claim.claim_id, dealType, parseInt(targetVideos, 10)))}
                    className="flex-2 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isPending ? "..." : "Konfirmasi Setuju"}
                  </button>
                </div>
              </div>
            )}
            {activeForm === "decline" && (
              <FailForm
                title="Alasan Declined"
                placeholder="Merchant tidak jadi kerjasama karena..."
                submitLabel="Konfirmasi Declined"
                submitClass="bg-red-600 hover:bg-red-700"
                value={failReason}
                onChange={setFailReason}
                isPending={isPending}
                error={error}
                onSubmit={() => doAction(() => declineKerjasama(claim.claim_id, failReason))}
                onCancel={() => { setActiveForm(null); setFailReason(""); }}
              />
            )}
            {activeForm === null && (
              <div className="flex gap-2">
                <button onClick={() => setActiveForm("approve")} disabled={isPending}
                  className="flex-1 py-3 bg-teal-600 text-white text-sm font-semibold rounded-2xl hover:bg-teal-700 disabled:opacity-40">
                  Setuju Kerjasama →
                </button>
                <button onClick={() => setActiveForm("decline")} disabled={isPending}
                  className="flex-1 py-3 border border-red-200 text-red-600 text-sm font-medium rounded-2xl hover:bg-red-50 disabled:opacity-40">
                  Declined
                </button>
              </div>
            )}
          </>
        )}

        {/* DISETUJUI_DIKLAIM */}
        {claim.claim_status === "disetujui_diklaim" && (
          <>
            {activeForm === "koordinasi" && (
              <div className="bg-white rounded-2xl border border-cyan-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Koordinasi Kreator</h3>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tanggal Visit Kreator (opsional)
                  </label>
                  <input
                    type="datetime-local"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActiveForm(null)} disabled={isPending}
                    className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 disabled:opacity-50">
                    Batal
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => doAction(() => setKoordinasiKreator(claim.claim_id, visitDate || undefined))}
                    className="flex-2 px-4 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-xl hover:bg-cyan-700 disabled:opacity-40"
                  >
                    {isPending ? "..." : "Set Koordinasi →"}
                  </button>
                </div>
              </div>
            )}
            {activeForm === null && (
              <ActionBtn
                label="Set Koordinasi Kreator →"
                colorClass="bg-cyan-600 hover:bg-cyan-700"
                isPending={isPending}
                onClick={() => setActiveForm("koordinasi")}
              />
            )}
          </>
        )}

        {/* KOORDINASI_KREATOR */}
        {claim.claim_status === "koordinasi_kreator" && (
          <ActionBtn
            label="Kreator Visit — Mulai Campaign →"
            colorClass="bg-emerald-600 hover:bg-emerald-700"
            isPending={isPending}
            onClick={() => doAction(() => startCampaign(claim.claim_id))}
          />
        )}

        {/* CAMPAIGN_JALAN */}
        {claim.claim_status === "campaign_jalan" && (
          <>
            {/* Video progress update */}
            <div className="bg-white rounded-2xl border border-emerald-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Update Progress Video</h3>
              {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">
                    Video Terupload ({claim.campaign_uploaded_videos ?? 0}/{claim.campaign_target_videos ?? "?"})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={claim.campaign_target_videos ?? 999}
                    value={videosInput}
                    onChange={(e) => setVideosInput(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  disabled={isPending}
                  onClick={() => doAction(() => updateCampaignVideos(claim.claim_id, parseInt(videosInput, 10) || 0))}
                  className="mt-4 px-4 py-2.5 bg-gray-700 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40"
                >
                  Update
                </button>
              </div>
            </div>

            <CampaignSelesaiButton
              uploadedVideos={claim.campaign_uploaded_videos ?? 0}
              targetVideos={claim.campaign_target_videos ?? 0}
              isPending={isPending}
              onConfirm={() => doAction(() => completeCampaign(claim.claim_id))}
            />
          </>
        )}

        {/* CAMPAIGN_SELESAI */}
        {claim.claim_status === "campaign_selesai" && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center">
            <p className="text-sm font-semibold text-gray-700">✓ Campaign Selesai</p>
            <p className="text-xs text-gray-500 mt-1">
              {(claim.campaign_uploaded_videos ?? 0)} dari {claim.campaign_target_videos ?? 0} video terupload.
            </p>
            {claim.completed_at && (
              <p className="text-xs text-gray-400 mt-1">{formatDate(claim.completed_at)}</p>
            )}
          </div>
        )}

        {/* DECLINED */}
        {claim.claim_status === "declined" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4">
            <p className="text-sm font-semibold text-red-700">Kerjasama Declined</p>
            {claim.fail_reason && (
              <p className="text-xs text-red-600 mt-1">"{claim.fail_reason}"</p>
            )}
          </div>
        )}

        {/* ── Catatan Internal ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Catatan</h3>
          <NotesSection
            claimId={claim.claim_id}
            notes={notes}
            canAdd={NOTE_ALLOWED_STATUSES_INTERNAL.includes(claim.claim_status)}
            isInternal={true}
          />
        </div>

        {/* ── Riwayat Status ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Riwayat Status</h3>
          <ClaimTimeline history={history} />
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value ?? "—"}</span>
    </div>
  );
}

function ValidBadge({ label, valid }: { label: string; valid: boolean }) {
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
      valid ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
    }`}>
      {valid ? "✓" : "○"} {label}
    </span>
  );
}

function ActionBtn({
  label, colorClass, isPending, onClick,
}: {
  label: string; colorClass: string; isPending: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className={`w-full py-3.5 text-white text-sm font-semibold rounded-2xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colorClass}`}
    >
      {isPending ? "Menyimpan..." : label}
    </button>
  );
}

function FailForm({
  title, placeholder, submitLabel, submitClass,
  value, onChange, isPending, error, onSubmit, onCancel,
}: {
  title: string; placeholder: string; submitLabel: string; submitClass: string;
  value: string; onChange: (v: string) => void;
  isPending: boolean; error: string | null;
  onSubmit: () => void; onCancel: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-red-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
      />
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={isPending}
          className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50">
          Batal
        </button>
        <button
          onClick={onSubmit}
          disabled={isPending || !value.trim()}
          className={`flex-2 flex items-center justify-center px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${submitClass}`}
        >
          {isPending ? "..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

function CampaignSelesaiButton({
  uploadedVideos, targetVideos, isPending, onConfirm,
}: {
  uploadedVideos: number; targetVideos: number;
  isPending: boolean; onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-medium text-gray-800">
          Konfirmasi campaign selesai?
        </p>
        <p className="text-xs text-gray-500">
          Video terupload: <strong>{uploadedVideos}</strong> dari target <strong>{targetVideos}</strong>.
          Aksi ini tidak bisa dibatalkan.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)}
            className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 bg-gray-700 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-40"
          >
            {isPending ? "..." : "Ya, Selesai ✓"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={isPending}
      className="w-full py-3.5 bg-gray-700 text-white text-sm font-semibold rounded-2xl hover:bg-gray-800 disabled:opacity-40 transition-colors"
    >
      Tandai Campaign Selesai ✓
    </button>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
