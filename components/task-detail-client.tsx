"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  transitionStatus,
  updateContactInfo,
  uploadProofFile,
  deleteProofFile,
} from "@/lib/actions/poi";
import ClaimTimeline from "@/components/claim-timeline";
import NotesSection from "@/components/notes-section";
import { compressImage } from "@/lib/utils/compress-image";
import { categoryLabel } from "@/lib/category-labels";
import { FEE_LOCKED_STATUSES, type PoiStatus } from "@/types";

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

type TaskClaim = {
  claim_id: number;
  user_id: string;
  claim_status: string;
  pic_name: string | null;
  pic_position: string | null;
  wa_number: string | null;
  fail_reason: string | null;
  submitted_at: string | null;
  last_activity_at: string;
  poi_id: string;
};

type TaskPoi = {
  poi_id: string;
  name: string;
  category: string;
  area: string;
  city: string;
  is_undersupplied: boolean | null;
  priority_tag: string | null;
};

type ProofFile = {
  file_id: number;
  file_type: string;
  file_url: string;
  signedUrl: string | null;
  uploaded_at: string;
};

// ── Config ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; desc?: string }> = {
  in_progress:         { label: "Sedang Proses",    badgeClass: "bg-blue-100 text-blue-700",     desc: "Sedang cari kontak merchant" },
  semi_dealing:        { label: "Semi-Dealing",     badgeClass: "bg-yellow-100 text-yellow-700", desc: "Sudah dapat kontak, sedang negosiasi" },
  submitted:           { label: "Submitted",        badgeClass: "bg-yellow-100 text-yellow-700", desc: "Menunggu review tim internal" },
  nomor_invalid:       { label: "Nomor Invalid",    badgeClass: "bg-red-100 text-red-700",       desc: "Tim internal: nomor tidak dapat dihubungi" },
  validasi_nomor:      { label: "Divalidasi",       badgeClass: "bg-purple-100 text-purple-700", desc: "Tim internal sedang memvalidasi nomor" },
  fiksasi_kerjasama:   { label: "Fiksasi",          badgeClass: "bg-indigo-100 text-indigo-700", desc: "Tim internal sedang fiksasi kerjasama" },
  disetujui_diklaim:   { label: "Deal Disetujui",   badgeClass: "bg-teal-100 text-teal-700",     desc: "Merchant setuju kerjasama" },
  koordinasi_kreator:  { label: "Koordinasi",       badgeClass: "bg-cyan-100 text-cyan-700",     desc: "Sedang atur jadwal kreator" },
  campaign_jalan:      { label: "Campaign Jalan",   badgeClass: "bg-emerald-100 text-emerald-700", desc: "Kreator sedang visit & upload video" },
  campaign_selesai:    { label: "Campaign Selesai", badgeClass: "bg-gray-100 text-gray-600",     desc: "Semua video tayang sesuai target" },
};

type ActiveForm = "contact" | "edit_contact" | "failed" | "dead_poi" | "nomor_invalid_update" | null;
type ConfirmAction = "submit" | "gagal" | "poi_mati" | null;

// ── Main component ─────────────────────────────────────────────────────────

const NOTE_ALLOWED_STATUSES = ["in_progress", "semi_dealing", "submitted", "koordinasi_kreator", "campaign_selesai"];

export default function TaskDetailClient({
  claim,
  poi,
  proofFiles,
  history = [],
  notes = [],
}: {
  claim: TaskClaim;
  poi: TaskPoi;
  proofFiles: ProofFile[];
  history?: HistoryEntry[];
  notes?: NoteEntry[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [picName, setPicName] = useState(claim.pic_name ?? "");
  const [waNumber, setWaNumber] = useState(claim.wa_number ?? "");
  const [picPosition, setPicPosition] = useState(claim.pic_position ?? "");
  const [failReason, setFailReason] = useState("");

  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploadPending, startUploadTransition] = useTransition();

  const statusCfg = STATUS_CONFIG[claim.claim_status] ?? {
    label: claim.claim_status,
    badgeClass: "bg-gray-100 text-gray-600",
  };

  const canSubmit =
    !!claim.pic_name &&
    !!claim.wa_number &&
    proofFiles.length > 0;

  const showProofSection = [
    "semi_dealing", "submitted", "nomor_invalid",
    "validasi_nomor", "fiksasi_kerjasama", "disetujui_diklaim",
    "koordinasi_kreator", "campaign_jalan", "campaign_selesai",
  ].includes(claim.claim_status);

  // ── Handlers ──────────────────────────────────────────────────────────

  const doTransition = (
    toStatus: string,
    opts: Parameters<typeof transitionStatus>[2] = {}
  ) => {
    setActionError(null);
    startTransition(async () => {
      const res = await transitionStatus(claim.claim_id, toStatus, opts);
      if (res.error) {
        setActionError(res.error);
        return;
      }
      if (["gagal", "poi_mati"].includes(toStatus)) {
        router.push("/tasks");
      } else {
        setActiveForm(null);
        setFailReason("");
        router.refresh();
      }
    });
  };

  const handleSemiDealing = () => {
    doTransition("semi_dealing", {
      picName: picName.trim(),
      waNumber: waNumber.trim(),
      picPosition: picPosition.trim() || undefined,
    });
  };

  const handleGagal = () => {
    if (!failReason.trim()) { setActionError("Alasan wajib diisi"); return; }
    doTransition("gagal", { failReason: failReason.trim() });
  };

  const handlePoiMati = () => {
    if (!failReason.trim()) { setActionError("Alasan wajib diisi"); return; }
    doTransition("poi_mati", { failReason: failReason.trim() });
  };

  const handleSubmitClaim = () => doTransition("submitted");

  const handleContactSave = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await updateContactInfo(
        claim.claim_id,
        picName.trim(),
        waNumber.trim(),
        picPosition.trim() || null
      );
      if (res.error) { setActionError(res.error); return; }
      setActiveForm(null);
      router.refresh();
    });
  };

  const handleReturnFromInvalid = () => {
    doTransition("in_progress", {
      picName: picName.trim() || undefined,
      waNumber: waNumber.trim() || undefined,
      picPosition: picPosition.trim() || undefined,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    startUploadTransition(async () => {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed);
      const res = await uploadProofFile(claim.claim_id, formData);
      if (res.error) setUploadError(res.error);
      else router.refresh();
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const handleDeleteFile = (fileId: number, storagePath: string) => {
    startUploadTransition(async () => {
      const res = await deleteProofFile(fileId, storagePath, claim.claim_id);
      if (res.error) setUploadError(res.error);
      else router.refresh();
    });
  };

  const resetForm = () => {
    setActiveForm(null);
    setConfirmAction(null);
    setActionError(null);
    setFailReason("");
    setPicName(claim.pic_name ?? "");
    setWaNumber(claim.wa_number ?? "");
    setPicPosition(claim.pic_position ?? "");
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-[100dvh] bg-gray-50">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10 flex items-center gap-3">
        <Link href="/tasks" className="text-gray-500 p-0.5 -ml-0.5">
          <BackIcon className="w-5 h-5" />
        </Link>
        <h1 className="text-base font-semibold text-gray-900 flex-1 truncate">Tugas Saya</h1>
        {FEE_LOCKED_STATUSES.includes(claim.claim_status as PoiStatus) && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
            ✓ Fee Aman
          </span>
        )}
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${statusCfg.badgeClass}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-3 pb-10">

        {/* POI card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {categoryLabel(poi.category)}
            </span>
            {poi.is_undersupplied && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                ⚡ Prioritas
              </span>
            )}
            {poi.priority_tag && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                {poi.priority_tag}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-gray-900">{poi.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{poi.area}, {poi.city}</p>
          {statusCfg.desc && (
            <p className="text-xs text-gray-400 mt-1.5 italic">{statusCfg.desc}</p>
          )}
        </div>

        {/* Contact card — tampil jika sudah ada kontak */}
        {(claim.pic_name || claim.wa_number) && activeForm !== "edit_contact" && activeForm !== "contact" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Info Kontak</h3>
              {["in_progress", "semi_dealing", "nomor_invalid"].includes(claim.claim_status) && (
                <button
                  onClick={() => { setActiveForm("edit_contact"); setPicName(claim.pic_name ?? ""); setWaNumber(claim.wa_number ?? ""); setPicPosition(claim.pic_position ?? ""); }}
                  className="text-xs text-blue-600 font-medium"
                >
                  Edit
                </button>
              )}
            </div>
            <p className="text-sm font-medium text-gray-900">{claim.pic_name ?? "—"}</p>
            {claim.pic_position && (
              <p className="text-xs text-gray-500">{claim.pic_position}</p>
            )}
            <p className="text-xs text-gray-500 mt-0.5">WA: {claim.wa_number ?? "—"}</p>
          </div>
        )}

        {/* Edit contact inline form */}
        {activeForm === "edit_contact" && (
          <ContactForm
            picName={picName} setPicName={setPicName}
            waNumber={waNumber} setWaNumber={setWaNumber}
            picPosition={picPosition} setPicPosition={setPicPosition}
            title="Edit Kontak"
            submitLabel="Simpan"
            isPending={isPending}
            error={actionError}
            onSubmit={handleContactSave}
            onCancel={resetForm}
          />
        )}

        {/* Proof files section */}
        {showProofSection && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Bukti Foto
                {proofFiles.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-medium text-gray-400 normal-case">
                    {proofFiles.length} file
                  </span>
                )}
              </h3>
              {["semi_dealing", "in_progress", "nomor_invalid"].includes(claim.claim_status) && (
                <label className="cursor-pointer flex items-center gap-1 text-xs font-medium text-blue-600">
                  {isUploadPending ? <SpinnerIcon className="w-3.5 h-3.5" /> : <PlusIcon className="w-3.5 h-3.5" />}
                  Tambah
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={isUploadPending}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {uploadError && (
              <p className="text-xs text-red-600 mb-2">{uploadError}</p>
            )}

            {proofFiles.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Belum ada bukti diupload</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {proofFiles.map((f) => (
                  <div key={f.file_id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    {f.signedUrl ? (
                      <img src={f.signedUrl} alt="Bukti" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    {["in_progress", "semi_dealing", "nomor_invalid"].includes(claim.claim_status) && (
                      <button
                        onClick={() => handleDeleteFile(f.file_id, f.file_url)}
                        disabled={isUploadPending}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center disabled:opacity-50"
                      >
                        <XSmallIcon className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Global action error */}
        {actionError && activeForm === null && (
          <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
            <span className="text-red-500 flex-shrink-0 mt-0.5 text-sm">✕</span>
            <p className="text-sm text-red-700 flex-1">{actionError}</p>
            <button onClick={() => setActionError(null)} className="text-red-400 text-sm flex-shrink-0">✕</button>
          </div>
        )}

        {/* ── Status-based action sections ── */}

        {/* IN_PROGRESS */}
        {claim.claim_status === "in_progress" && (
          <>
            {activeForm === "contact" && (
              <ContactForm
                picName={picName} setPicName={setPicName}
                waNumber={waNumber} setWaNumber={setWaNumber}
                picPosition={picPosition} setPicPosition={setPicPosition}
                title="Input Info Kontak"
                submitLabel="Tandai Semi-Dealing →"
                isPending={isPending}
                error={actionError}
                onSubmit={handleSemiDealing}
                onCancel={resetForm}
              />
            )}

            {activeForm === "failed" && (
              <FailReasonForm
                value={failReason}
                onChange={setFailReason}
                title="Alasan Tidak Dapat Kontak"
                placeholder="Tuliskan alasan mengapa tidak berhasil..."
                submitLabel="Konfirmasi Gagal"
                submitClass="bg-orange-500 hover:bg-orange-600"
                isPending={isPending}
                error={actionError}
                onSubmit={handleGagal}
                onCancel={resetForm}
              />
            )}

            {activeForm === "dead_poi" && (
              <FailReasonForm
                value={failReason}
                onChange={setFailReason}
                title="Alasan POI Tutup Permanen"
                placeholder="Contoh: Toko sudah tutup, gedung dibongkar..."
                submitLabel="Konfirmasi POI Tutup"
                submitClass="bg-red-600 hover:bg-red-700"
                isPending={isPending}
                error={actionError}
                onSubmit={handlePoiMati}
                onCancel={resetForm}
              />
            )}

            {activeForm === null && (
              <div className="space-y-2">
                <button
                  onClick={() => { setActiveForm("contact"); setPicName(""); setWaNumber(""); setPicPosition(""); }}
                  className="w-full py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-2xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
                >
                  Sudah Dapat Kontak →
                </button>

                {/* Tandai Gagal — dengan konfirmasi */}
                {confirmAction === "gagal" ? (
                  <div className="flex gap-2">
                    <button onClick={resetForm} className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">
                      Batal
                    </button>
                    <button
                      onClick={() => { setConfirmAction(null); setActiveForm("failed"); }}
                      className="flex-1 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600"
                    >
                      Ya, Lanjut →
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmAction("gagal")}
                    className="w-full py-3 border border-orange-200 text-orange-600 text-sm font-medium rounded-2xl hover:bg-orange-50 transition-colors"
                  >
                    Tandai Gagal
                  </button>
                )}

                {/* POI Tutup — dengan konfirmasi */}
                {confirmAction === "poi_mati" ? (
                  <div className="flex gap-2">
                    <button onClick={resetForm} className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">
                      Batal
                    </button>
                    <button
                      onClick={() => { setConfirmAction(null); setActiveForm("dead_poi"); }}
                      className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700"
                    >
                      Ya, Permanen →
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmAction("poi_mati")}
                    className="w-full py-3 border border-red-200 text-red-600 text-sm font-medium rounded-2xl hover:bg-red-50 transition-colors"
                  >
                    POI Tutup Permanen
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* SEMI_DEALING */}
        {claim.claim_status === "semi_dealing" && activeForm === null && (
          <div className="space-y-2">
            {/* Missing requirements hint */}
            {!canSubmit && (
              <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-2xl">
                <p className="text-xs font-medium text-yellow-700 mb-1">Syarat submit belum terpenuhi:</p>
                <ul className="text-xs text-yellow-600 space-y-0.5">
                  {!claim.pic_name && <li>· Nama PIC belum diisi</li>}
                  {!claim.wa_number && <li>· Nomor WhatsApp belum diisi</li>}
                  {proofFiles.length === 0 && <li>· Minimal 1 bukti foto/screenshot</li>}
                </ul>
              </div>
            )}

            {/* Submit dengan konfirmasi */}
            {confirmAction === "submit" && canSubmit ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-medium text-green-800">
                  Pastikan data sudah benar sebelum submit:
                </p>
                <div className="text-xs text-green-700 space-y-0.5">
                  <p>• PIC: <strong>{claim.pic_name}</strong></p>
                  <p>• WA: <strong>{claim.wa_number}</strong></p>
                  <p>• Bukti: <strong>{proofFiles.length} foto</strong></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={resetForm} className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">
                    Tinjau Ulang
                  </button>
                  <button
                    onClick={handleSubmitClaim}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-40"
                  >
                    {isPending ? <><SpinnerIcon className="w-4 h-4" />...</> : "Konfirmasi Submit →"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => canSubmit ? setConfirmAction("submit") : undefined}
                disabled={!canSubmit || isPending}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white text-sm font-semibold rounded-2xl hover:bg-green-700 active:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Submit ke Internal →
              </button>
            )}
          </div>
        )}

        {/* SUBMITTED */}
        {claim.claim_status === "submitted" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-4 text-center">
            <p className="text-sm font-semibold text-green-700">✓ Berhasil disubmit</p>
            <p className="text-xs text-green-600 mt-1">
              Menunggu tim internal untuk memvalidasi nomor WA.
            </p>
            {claim.submitted_at && (
              <p className="text-[10px] text-green-500 mt-1">
                {new Date(claim.submitted_at).toLocaleDateString("id-ID", {
                  day: "numeric", month: "long", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            )}
          </div>
        )}

        {/* NOMOR_INVALID */}
        {claim.claim_status === "nomor_invalid" && (
          <>
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <p className="text-sm font-semibold text-red-700">⚠ Nomor Tidak Valid</p>
              <p className="text-xs text-red-600 mt-1">
                Tim internal tidak dapat menghubungi nomor ini. Update kontak dan kirim ulang.
              </p>
            </div>

            {activeForm === "nomor_invalid_update" && (
              <ContactForm
                picName={picName} setPicName={setPicName}
                waNumber={waNumber} setWaNumber={setWaNumber}
                picPosition={picPosition} setPicPosition={setPicPosition}
                title="Update Kontak"
                submitLabel="Simpan & Kirim Ulang →"
                isPending={isPending}
                error={actionError}
                onSubmit={handleReturnFromInvalid}
                onCancel={resetForm}
              />
            )}

            {activeForm === null && (
              <button
                onClick={() => {
                  setActiveForm("nomor_invalid_update");
                  setPicName(claim.pic_name ?? "");
                  setWaNumber(claim.wa_number ?? "");
                  setPicPosition(claim.pic_position ?? "");
                }}
                className="w-full py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-2xl hover:bg-blue-700 transition-colors"
              >
                Update Kontak & Kirim Ulang →
              </button>
            )}
          </>
        )}

        {/* STATUS FASE 2 (read-only untuk freelancer) */}
        {["validasi_nomor", "fiksasi_kerjasama", "disetujui_diklaim",
          "koordinasi_kreator", "campaign_jalan", "campaign_selesai",
          "repeat_campaign"].includes(claim.claim_status) && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-4 text-center">
            <p className="text-sm font-medium text-blue-700">
              Tim internal sedang menangani POI ini
            </p>
            <p className="text-xs text-blue-500 mt-1">
              Kamu tidak perlu melakukan tindakan apa pun saat ini.
            </p>
          </div>
        )}

        {/* ── Catatan ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Catatan</h3>
          <NotesSection
            claimId={claim.claim_id}
            notes={notes}
            canAdd={NOTE_ALLOWED_STATUSES.includes(claim.claim_status)}
            isInternal={false}
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

function ContactForm({
  picName, setPicName,
  waNumber, setWaNumber,
  picPosition, setPicPosition,
  title, submitLabel,
  isPending, error,
  onSubmit, onCancel,
}: {
  picName: string; setPicName: (v: string) => void;
  waNumber: string; setWaNumber: (v: string) => void;
  picPosition: string; setPicPosition: (v: string) => void;
  title: string; submitLabel: string;
  isPending: boolean; error: string | null;
  onSubmit: () => void; onCancel: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-blue-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Nama PIC <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={picName}
          onChange={(e) => setPicName(e.target.value)}
          placeholder="Nama kontak merchant"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Nomor WhatsApp <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={waNumber}
          onChange={(e) => setWaNumber(e.target.value)}
          placeholder="08xx / +628xx"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Jabatan (opsional)
        </label>
        <input
          type="text"
          value={picPosition}
          onChange={(e) => setPicPosition(e.target.value)}
          placeholder="Contoh: Manager, Owner"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={isPending}
          className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50"
        >
          Batal
        </button>
        <button
          onClick={onSubmit}
          disabled={isPending || !picName.trim() || !waNumber.trim()}
          className="flex-2 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? <><SpinnerIcon className="w-4 h-4" />Menyimpan...</> : submitLabel}
        </button>
      </div>
    </div>
  );
}

function FailReasonForm({
  value, onChange,
  title, placeholder,
  submitLabel, submitClass,
  isPending, error,
  onSubmit, onCancel,
}: {
  value: string; onChange: (v: string) => void;
  title: string; placeholder: string;
  submitLabel: string; submitClass: string;
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
        <button
          onClick={onCancel}
          disabled={isPending}
          className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50"
        >
          Batal
        </button>
        <button
          onClick={onSubmit}
          disabled={isPending || !value.trim()}
          className={`flex-2 flex items-center justify-center gap-1.5 px-4 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${submitClass}`}
        >
          {isPending ? <><SpinnerIcon className="w-4 h-4" />Menyimpan...</> : submitLabel}
        </button>
      </div>
    </div>
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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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

function XSmallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? "w-4 h-4"}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
