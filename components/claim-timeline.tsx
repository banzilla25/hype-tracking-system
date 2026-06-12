type HistoryEntry = {
  history_id: number;
  from_status: string | null;
  to_status: string;
  changed_by_role: string;
  note: string | null;
  created_at: string;
  profiles: { nickname: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  available:          "Available",
  in_progress:        "In Progress",
  semi_dealing:       "Semi Dealing",
  submitted:          "Submitted",
  gagal:              "Gagal",
  poi_mati:           "POI Mati",
  validasi_nomor:     "Validasi Nomor",
  nomor_invalid:      "Nomor Invalid",
  fiksasi_kerjasama:  "Fiksasi Kerjasama",
  disetujui_diklaim:  "Disetujui",
  declined:           "Declined",
  koordinasi_kreator: "Koordinasi Kreator",
  campaign_jalan:     "Campaign Jalan",
  campaign_selesai:   "Campaign Selesai",
  repeat_campaign:    "Repeat Campaign",
};

const STATUS_DOT: Record<string, string> = {
  gagal:         "bg-orange-400",
  poi_mati:      "bg-gray-400",
  declined:      "bg-red-400",
  campaign_selesai: "bg-green-400",
  submitted:     "bg-yellow-400",
  disetujui_diklaim: "bg-teal-400",
  campaign_jalan: "bg-emerald-400",
  nomor_invalid: "bg-red-300",
};

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ClaimTimeline({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-xs text-gray-400 italic">Belum ada riwayat.</p>;
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-gray-100" />

      <div className="space-y-4">
        {[...history].reverse().map((entry) => {
          const dotColor = STATUS_DOT[entry.to_status] ?? "bg-blue-400";
          const actor =
            entry.changed_by_role === "system"
              ? "Sistem"
              : (entry.profiles?.nickname ?? entry.changed_by_role);

          return (
            <div key={entry.history_id} className="flex gap-3 items-start">
              {/* Dot */}
              <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center z-10 ${dotColor}`}>
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">
                    {STATUS_LABELS[entry.to_status] ?? entry.to_status}
                  </span>
                  {entry.from_status && (
                    <span className="text-xs text-gray-400">
                      dari {STATUS_LABELS[entry.from_status] ?? entry.from_status}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-gray-500">{actor}</span>
                  <span className="text-[10px] text-gray-300">·</span>
                  <span className="text-[11px] text-gray-400">{formatDateTime(entry.created_at)}</span>
                </div>
                {entry.note && (
                  <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded-lg px-2.5 py-1.5 italic">
                    "{entry.note}"
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
