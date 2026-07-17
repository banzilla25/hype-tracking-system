"use client";

// ── Types ──────────────────────────────────────────────────────────────────

type FreelancerRow = {
  user_id: string;
  nickname: string;
  total: number;
  submitted: number;
  gagal: number;
  autoRelease: number;
  campaignSelesai: number;
  feeAman: number;
};

const FEE_PER_POI = 10_000;

// ── Funnel stages (in order of pipeline) ──────────────────────────────────

const FUNNEL_STAGES = [
  {
    label: "Pool (Available)",
    statuses: ["available"],
    color: "bg-gray-300",
    textColor: "text-gray-700",
  },
  {
    label: "Sedang Dikerjakan",
    statuses: ["in_progress", "semi_dealing"],
    color: "bg-blue-400",
    textColor: "text-blue-700",
  },
  {
    label: "Submitted",
    statuses: ["submitted"],
    color: "bg-yellow-400",
    textColor: "text-yellow-700",
  },
  {
    label: "Validasi Nomor",
    statuses: ["validasi_nomor", "nomor_invalid"],
    color: "bg-purple-400",
    textColor: "text-purple-700",
  },
  {
    label: "Fiksasi Kerjasama",
    statuses: ["fiksasi_kerjasama"],
    color: "bg-indigo-400",
    textColor: "text-indigo-700",
  },
  {
    label: "Deal Disetujui",
    statuses: ["disetujui_diklaim", "koordinasi_kreator"],
    color: "bg-teal-400",
    textColor: "text-teal-700",
  },
  {
    label: "Campaign Aktif",
    statuses: ["campaign_jalan"],
    color: "bg-emerald-400",
    textColor: "text-emerald-700",
  },
  {
    label: "Campaign Selesai",
    statuses: ["campaign_selesai"],
    color: "bg-green-500",
    textColor: "text-green-700",
  },
  {
    label: "Repeat Campaign",
    statuses: ["repeat_campaign"],
    color: "bg-blue-400",
    textColor: "text-blue-700",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(value: number, total: number) {
  if (!total) return "0%";
  return ((value / total) * 100).toFixed(1) + "%";
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DashboardClient({
  statusCounts,
  totalPoi,
  totalDikunjungi,
  totalSubmitted,
  totalSelesai,
  freelancers,
}: {
  statusCounts: Record<string, number>;
  totalPoi: number;
  totalDikunjungi: number;
  totalSubmitted: number;
  totalSelesai: number;
  freelancers: FreelancerRow[];
}) {
  // Compute funnel counts
  const funnelData = FUNNEL_STAGES.map((stage) => ({
    ...stage,
    count: stage.statuses.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0),
  }));

  const funnelMax = Math.max(...funnelData.map((s) => s.count), 1);

  const conversionRate = totalDikunjungi > 0
    ? ((totalSelesai / totalDikunjungi) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Ringkasan pipeline merchant activation</p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total POI di DB"
          value={totalPoi}
          sub="semua status"
          color="bg-gray-50 border-gray-200"
          valueColor="text-gray-800"
        />
        <SummaryCard
          label="Total Dikunjungi"
          value={totalDikunjungi}
          sub="pernah di-claim"
          color="bg-blue-50 border-blue-100"
          valueColor="text-blue-700"
        />
        <SummaryCard
          label="Submitted ke Internal"
          value={totalSubmitted}
          sub={`${pct(totalSubmitted, totalDikunjungi)} dari dikunjungi`}
          color="bg-yellow-50 border-yellow-100"
          valueColor="text-yellow-700"
        />
        <SummaryCard
          label="Campaign Selesai"
          value={totalSelesai}
          sub={`Konversi ${conversionRate}%`}
          color="bg-green-50 border-green-100"
          valueColor="text-green-700"
        />
      </div>

      {/* ── Pipeline Funnel ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Pipeline Funnel</h2>

        <div className="space-y-2.5">
          {funnelData.map((stage) => {
            const barPct = Math.max((stage.count / funnelMax) * 100, stage.count > 0 ? 4 : 0);
            return (
              <div key={stage.label} className="flex items-center gap-3">
                <div className="w-36 text-xs text-gray-600 text-right shrink-0 leading-tight">
                  {stage.label}
                </div>
                <div className="flex-1 h-8 bg-gray-50 rounded-lg overflow-hidden">
                  <div
                    className={`h-full rounded-lg flex items-center px-2 transition-all ${stage.color}`}
                    style={{ width: `${barPct}%` }}
                  >
                    {stage.count > 0 && (
                      <span className="text-xs font-bold text-white drop-shadow-sm">
                        {stage.count}
                      </span>
                    )}
                  </div>
                </div>
                {stage.count === 0 && (
                  <span className="text-xs text-gray-300 w-6">0</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Terminal statuses note — sudah selesai/keluar pipeline, tidak butuh aksi lagi */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-4 flex-wrap text-xs text-gray-500">
          {[
            { label: "Gagal", key: "gagal" },
            { label: "POI Mati", key: "poi_mati" },
            { label: "Declined", key: "declined" },
          ].map(({ label, key }) => (
            <span key={key}>
              {label}: <strong className="text-gray-700">{statusCounts[key] ?? 0}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* ── Rapor Kinerja Freelancer ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Rapor Kinerja Freelancer</h2>
        <p className="text-xs text-gray-500 mb-5">
          Data dari riwayat klaim. Submit Rate = submitted ÷ total klaim.
        </p>

        {freelancers.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Belum ada data klaim.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="pb-2.5 px-2">Freelancer</th>
                  <th className="pb-2.5 px-2 text-right">Total Klaim</th>
                  <th className="pb-2.5 px-2 text-right">Submitted</th>
                  <th className="pb-2.5 px-2 text-right">Gagal</th>
                  <th className="pb-2.5 px-2 text-right">Auto-Release</th>
                  <th className="pb-2.5 px-2 text-right">Campaign ✓</th>
                  <th className="pb-2.5 px-2 text-right">Valid</th>
                  <th className="pb-2.5 px-2 text-right">Submit Rate</th>
                  <th className="pb-2.5 px-2 text-right">Fee (est.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {freelancers.map((fl) => {
                  const submitRate = fl.total > 0
                    ? ((fl.submitted / fl.total) * 100).toFixed(0)
                    : "0";
                  const rateNum = parseInt(submitRate, 10);
                  const rateColor =
                    rateNum >= 70 ? "text-green-600" :
                    rateNum >= 40 ? "text-yellow-600" : "text-red-500";

                  return (
                    <tr key={fl.user_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-2 font-medium text-gray-900">{fl.nickname}</td>
                      <td className="py-3 px-2 text-right text-gray-700">{fl.total}</td>
                      <td className="py-3 px-2 text-right text-yellow-600 font-medium">{fl.submitted}</td>
                      <td className="py-3 px-2 text-right text-orange-500">{fl.gagal}</td>
                      <td className="py-3 px-2 text-right text-red-400">{fl.autoRelease}</td>
                      <td className="py-3 px-2 text-right text-green-600 font-medium">{fl.campaignSelesai}</td>
                      <td className="py-3 px-2 text-right font-medium text-green-600">
                        {fl.feeAman}
                      </td>
                      <td className={`py-3 px-2 text-right font-semibold ${rateColor}`}>
                        {submitRate}%
                      </td>
                      <td className="py-3 px-2 text-right font-semibold text-green-700">
                        Rp{(fl.feeAman * FEE_PER_POI).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-component ──────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, color, valueColor,
}: {
  label: string; value: number; sub: string;
  color: string; valueColor: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColor}`}>{value.toLocaleString("id-ID")}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
