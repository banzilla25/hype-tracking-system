"use client";

import Link from "next/link";

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "baru saja";
    if (mins < 60) return `${mins} mnt lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 30) return `${days} hari lalu`;
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

type TaskClaim = {
  claim_id: number;
  claim_status: string;
  pic_name: string | null;
  wa_number: string | null;
  last_activity_at: string;
  poi_id: string;
  pois: {
    name: string;
    category: string;
    area: string;
    city: string;
    is_undersupplied: boolean | null;
  } | null;
};

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  in_progress:         { label: "Proses",          badgeClass: "bg-blue-100 text-blue-700" },
  semi_dealing:        { label: "Semi-Dealing",     badgeClass: "bg-yellow-100 text-yellow-700" },
  submitted:           { label: "Submitted",        badgeClass: "bg-green-100 text-green-700" },
  nomor_invalid:       { label: "Nomor Invalid",    badgeClass: "bg-red-100 text-red-700" },
  validasi_nomor:      { label: "Divalidasi",       badgeClass: "bg-purple-100 text-purple-700" },
  fiksasi_kerjasama:   { label: "Fiksasi",          badgeClass: "bg-indigo-100 text-indigo-700" },
  disetujui_diklaim:   { label: "Disetujui",        badgeClass: "bg-teal-100 text-teal-700" },
  koordinasi_kreator:  { label: "Koordinasi",       badgeClass: "bg-cyan-100 text-cyan-700" },
  campaign_jalan:      { label: "Campaign Jalan",   badgeClass: "bg-emerald-100 text-emerald-700" },
  campaign_selesai:    { label: "Selesai",          badgeClass: "bg-gray-100 text-gray-600" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, badgeClass: "bg-gray-100 text-gray-600" };
}

export default function TasksPageClient({ claims }: { claims: TaskClaim[] }) {
  if (claims.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <ClipboardIcon className="w-7 h-7 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">Belum ada tugas aktif</p>
        <p className="text-xs text-gray-400 mt-1">
          Ambil POI dari pool untuk mulai bertugas
        </p>
        <Link
          href="/pool"
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl"
        >
          Buka Pool POI →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-50 z-10 px-4 pt-4 pb-3 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">Tugas Saya</h1>
        <p className="text-xs text-gray-400 mt-0.5">{claims.length} tugas aktif</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {claims.map((claim) => (
          <TaskCard key={claim.claim_id} claim={claim} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ claim }: { claim: TaskClaim }) {
  const poi = claim.pois;
  const { label, badgeClass } = getStatusConfig(claim.claim_status);

  const ago = timeAgo(claim.last_activity_at);

  const hasContact = !!(claim.pic_name && claim.wa_number);
  const isNomorInvalid = claim.claim_status === "nomor_invalid";

  return (
    <Link href={`/tasks/${claim.claim_id}`} className="block">
      <div
        className={`bg-white rounded-2xl border p-4 transition-colors active:bg-gray-50 ${
          isNomorInvalid ? "border-red-200" : "border-gray-200"
        }`}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase">
                {poi?.category ?? "—"}
              </span>
              {poi?.is_undersupplied && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  ⚡ Prioritas
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-snug truncate">
              {poi?.name ?? claim.poi_id}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {poi?.area}, {poi?.city}
            </p>
          </div>
          <span
            className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${badgeClass}`}
          >
            {label}
          </span>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-2">
            {hasContact && (
              <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                <CheckIcon className="w-3 h-3" />
                Kontak ada
              </span>
            )}
            {isNomorInvalid && (
              <span className="text-[10px] font-medium text-red-600">
                ⚠ Perlu update kontak
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <ClockIcon className="w-3 h-3" />
            {ago}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
