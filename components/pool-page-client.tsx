"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { claimPoi } from "@/lib/actions/poi";

type PoolPoi = {
  poi_id: string;
  name: string;
  category: string;
  city: string;
  area: string;
  aov: number | null;
  is_undersupplied: boolean | null;
  priority_tag: string | null;
  status: string;
  current_claim_id: number | null;
};

interface Props {
  pois: PoolPoi[];
  userClaimIds: number[];
  activeClaimCount: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  hotel: "bg-blue-100 text-blue-700",
  fnb: "bg-orange-100 text-orange-700",
  ttd: "bg-green-100 text-green-700",
  attraction: "bg-green-100 text-green-700",
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat.toLowerCase()] ?? "bg-gray-100 text-gray-600";
}

function formatAOV(aov: number | null): string | null {
  if (!aov) return null;
  if (aov >= 1_000_000) return `Rp ${(aov / 1_000_000).toFixed(1)}jt`;
  if (aov >= 1_000) return `Rp ${Math.round(aov / 1_000)}rb`;
  return `Rp ${aov}`;
}

export default function PoolPageClient({
  pois,
  userClaimIds,
  activeClaimCount,
}: Props) {
  const [filterCategory, setFilterCategory] = useState("semua");
  const [filterArea, setFilterArea] = useState("semua");
  const [claimingPoiId, setClaimingPoiId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const userClaimSet = useMemo(() => new Set(userClaimIds), [userClaimIds]);
  const isAtLimit = activeClaimCount >= 10;

  // Unique categories & areas dari data
  const categories = useMemo(
    () => ["semua", ...Array.from(new Set(pois.map((p) => p.category))).sort()],
    [pois]
  );
  const areas = useMemo(
    () => ["semua", ...Array.from(new Set(pois.map((p) => p.area))).sort()],
    [pois]
  );

  // Filter & sort POI untuk pool
  // Keluarkan POI in_progress milik user sendiri (mereka ada di Tugas Saya)
  const poolPois = useMemo(() => {
    return pois
      .filter((poi) => {
        if (
          poi.status === "in_progress" &&
          poi.current_claim_id !== null &&
          userClaimSet.has(poi.current_claim_id)
        )
          return false;
        if (filterCategory !== "semua" && poi.category !== filterCategory)
          return false;
        if (filterArea !== "semua" && poi.area !== filterArea) return false;
        return true;
      })
      .sort((a, b) => {
        // Prioritas: is_undersupplied → aov desc → nama asc
        if (a.is_undersupplied && !b.is_undersupplied) return -1;
        if (!a.is_undersupplied && b.is_undersupplied) return 1;
        if ((b.aov ?? 0) !== (a.aov ?? 0)) return (b.aov ?? 0) - (a.aov ?? 0);
        return a.name.localeCompare(b.name, "id");
      });
  }, [pois, userClaimSet, filterCategory, filterArea]);

  const availableCount = poolPois.filter((p) => p.status === "available").length;

  const handleClaim = (poiId: string) => {
    setClaimError(null);
    setClaimingPoiId(poiId);
    startTransition(async () => {
      const result = await claimPoi(poiId);
      setClaimingPoiId(null);
      if (result.error) setClaimError(result.error);
    });
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-lg mx-auto">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 bg-gray-50 z-10 px-4 pt-4 pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">Pool POI</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/pool/add"
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700"
            >
              + Tambah POI
            </Link>
            <SlotBadge active={activeClaimCount} max={10} />
          </div>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterCategory === cat
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {cat === "semua" ? "Semua" : cat.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Area filter */}
        <div className="mt-2">
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="semua">Semua Area</option>
            {areas.slice(1).map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-400 mt-2">
          {availableCount} tersedia · {poolPois.length - availableCount} terkunci
        </p>
      </div>

      {/* ── Error alert ── */}
      {claimError && (
        <div className="mx-4 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
          <span className="text-red-500 mt-0.5 flex-shrink-0">✕</span>
          <p className="text-sm text-red-700 flex-1">{claimError}</p>
          <button
            onClick={() => setClaimError(null)}
            className="text-red-400 hover:text-red-600 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── POI list ── */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {poolPois.length === 0 ? (
          <EmptyState />
        ) : (
          poolPois.map((poi) => (
            <PoiCard
              key={poi.poi_id}
              poi={poi}
              isLocked={poi.status === "in_progress"}
              isAtLimit={isAtLimit}
              isClaiming={claimingPoiId === poi.poi_id}
              onClaim={() => handleClaim(poi.poi_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SlotBadge({ active, max }: { active: number; max: number }) {
  const isFull = active >= max;
  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
        isFull
          ? "bg-red-100 text-red-700"
          : active >= 8
          ? "bg-yellow-100 text-yellow-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      {active}/{max} slot
    </span>
  );
}

function PoiCard({
  poi,
  isLocked,
  isAtLimit,
  isClaiming,
  onClaim,
}: {
  poi: PoolPoi;
  isLocked: boolean;
  isAtLimit: boolean;
  isClaiming: boolean;
  onClaim: () => void;
}) {
  const aovFormatted = formatAOV(poi.aov);

  return (
    <div
      className={`bg-white rounded-2xl border p-4 transition-opacity ${
        isLocked ? "border-gray-100 opacity-60" : "border-gray-200"
      }`}
    >
      {/* Top row: category + priority badges */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${getCategoryColor(
            poi.category
          )}`}
        >
          {poi.category}
        </span>
        {poi.is_undersupplied && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            ⚡ Prioritas
          </span>
        )}
        {poi.priority_tag && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 truncate max-w-[120px]">
            {poi.priority_tag}
          </span>
        )}
      </div>

      {/* POI name */}
      <p className="text-sm font-semibold text-gray-900 leading-snug">{poi.name}</p>

      {/* Location + AOV */}
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs text-gray-500">
          {poi.area}, {poi.city}
        </p>
        {aovFormatted && (
          <p className="text-xs text-gray-400 font-medium">{aovFormatted}</p>
        )}
      </div>

      {/* Action */}
      <div className="mt-3 flex justify-end">
        {isLocked ? (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <LockIcon />
            Sedang dikerjakan
          </span>
        ) : (
          <button
            onClick={onClaim}
            disabled={isAtLimit || isClaiming}
            title={isAtLimit ? "Slot penuh — selesaikan POI lain dulu" : undefined}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isClaiming ? (
              <>
                <SpinnerIcon />
                Mengambil...
              </>
            ) : (
              "Ambil POI →"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
        <svg
          className="w-7 h-7 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-600">Tidak ada POI tersedia</p>
      <p className="text-xs text-gray-400 mt-1">Coba ubah filter kategori atau area</p>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
