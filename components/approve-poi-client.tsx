"use client";

import { useState, useTransition } from "react";
import { categoryLabel } from "@/lib/category-labels";
import { approvePoiSubmission, rejectPoiSubmission } from "@/lib/actions/poi-approval";

export type PendingPoi = {
  poi_id: string;
  name: string;
  category: string;
  city: string;
  area: string;
  created_at: string;
  pic_name: string | null;
  wa_number: string | null;
  submitter_nickname: string;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function ApprovePoiClient({ pending }: { pending: PendingPoi[] }) {
  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Approve POI Baru</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pending.length} POI dari freelancer menunggu persetujuan
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700">Semua beres!</p>
          <p className="text-xs text-gray-400 mt-1">Tidak ada POI baru yang menunggu persetujuan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((poi) => (
            <PoiCard key={poi.poi_id} poi={poi} />
          ))}
        </div>
      )}
    </div>
  );
}

function PoiCard({ poi }: { poi: PendingPoi }) {
  const [isPending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const res = await approvePoiSubmission(poi.poi_id);
      if (res.error) setError(res.error);
    });
  };

  const handleReject = () => {
    if (!reason.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await rejectPoiSubmission(poi.poi_id, reason.trim());
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {categoryLabel(poi.category)}
            </span>
            <span className="text-[10px] text-gray-400">{formatDate(poi.created_at)}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{poi.name}</p>
          <p className="text-xs text-gray-500">{poi.area}, {poi.city}</p>
          <p className="text-xs text-gray-400 mt-1">
            Diinput oleh: <span className="font-medium">{poi.submitter_nickname}</span>
          </p>
          {(poi.pic_name || poi.wa_number) && (
            <p className="text-xs text-gray-400">
              Kontak: {poi.pic_name ?? "—"} · {poi.wa_number ?? "—"}
            </p>
          )}
        </div>
        {!showReject && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleApprove}
              disabled={isPending}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={isPending}
              className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200"
            >
              Tolak
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {showReject && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Alasan reject (wajib diisi)..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowReject(false); setReason(""); setError(null); }}
              disabled={isPending}
              className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleReject}
              disabled={isPending || !reason.trim()}
              className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-40"
            >
              {isPending ? "..." : "Konfirmasi Tolak"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
