"use client";

import Link from "next/link";

export type Lead = {
  claim_id: number;
  claim_status: string;
  submitted_at: string | null;
  last_activity_at: string;
  pic_name: string | null;
  wa_number: string | null;
  poi_id: string;
  pois: {
    name: string;
    category: string;
    area: string;
    city: string;
    source: string;
  } | null;
  profiles: { nickname: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; priority: number }> = {
  submitted:          { label: "Submitted",        badgeClass: "bg-yellow-100 text-yellow-700",   priority: 1 },
  validasi_nomor:     { label: "Validasi Nomor",   badgeClass: "bg-blue-100 text-blue-700",       priority: 2 },
  nomor_invalid:      { label: "Nomor Invalid",    badgeClass: "bg-red-100 text-red-700",         priority: 2 },
  fiksasi_kerjasama:  { label: "Fiksasi",          badgeClass: "bg-purple-100 text-purple-700",   priority: 3 },
  disetujui_diklaim:  { label: "Disetujui",        badgeClass: "bg-teal-100 text-teal-700",       priority: 4 },
  koordinasi_kreator: { label: "Koordinasi",       badgeClass: "bg-cyan-100 text-cyan-700",       priority: 5 },
  campaign_jalan:     { label: "Campaign Jalan",   badgeClass: "bg-emerald-100 text-emerald-700", priority: 6 },
};

const STAGE_ORDER = [
  "submitted", "validasi_nomor", "nomor_invalid",
  "fiksasi_kerjasama", "disetujui_diklaim", "koordinasi_kreator", "campaign_jalan",
];

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

export default function LeadsPageClient({ leads }: { leads: Lead[] }) {
  // Group by status for summary counts
  const counts = STAGE_ORDER.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.claim_status === s).length;
    return acc;
  }, {} as Record<string, number>);

  if (leads.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3 mx-auto">
          <InboxIcon className="w-7 h-7 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">Tidak ada leads aktif</p>
        <p className="text-xs text-gray-400 mt-1">
          Leads dari freelancer atau sourcing mandiri akan muncul di sini.
        </p>
        <Link
          href="/leads/add"
          className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl"
        >
          + Tambah POI Mandiri
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Antrian Leads</h1>
          <p className="text-sm text-gray-500">{leads.length} leads aktif</p>
        </div>
        <Link
          href="/leads/add"
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Tambah POI
        </Link>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { key: "submitted",         label: "Menunggu" },
          { key: "validasi_nomor",    label: "Validasi" },
          { key: "fiksasi_kerjasama", label: "Fiksasi" },
          { key: "campaign_jalan",    label: "Campaign" },
        ].map(({ key, label }) => (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-gray-900">{counts[key] ?? 0}</p>
            <p className="text-[10px] text-gray-500 font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Leads list */}
      <div className="space-y-2">
        {leads.map((lead) => (
          <LeadCard key={lead.claim_id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const poi = lead.pois;
  const cfg = STATUS_CONFIG[lead.claim_status] ?? {
    label: lead.claim_status,
    badgeClass: "bg-gray-100 text-gray-600",
    priority: 0,
  };
  const isUrgent = lead.claim_status === "submitted" || lead.claim_status === "nomor_invalid";

  return (
    <Link href={`/leads/${lead.claim_id}`} className="block">
      <div
        className={`bg-white rounded-2xl border p-4 hover:bg-gray-50 transition-colors ${
          isUrgent ? "border-yellow-200" : "border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase">
                {poi?.category ?? "—"}
              </span>
              {poi?.source === "internal" && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Internal
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{poi?.name ?? lead.poi_id}</p>
            <p className="text-xs text-gray-500">{poi?.area}, {poi?.city}</p>
            {lead.profiles?.nickname && (
              <p className="text-xs text-gray-400 mt-0.5">oleh {lead.profiles.nickname}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${cfg.badgeClass}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-gray-400">{timeAgo(lead.last_activity_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
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
