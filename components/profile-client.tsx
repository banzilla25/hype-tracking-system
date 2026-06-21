"use client";

import { useState, useTransition } from "react";
import { updateNickname } from "@/lib/actions/profile";
import { signOut } from "@/lib/actions/auth";

type Stats = {
  total: number;
  aktif: number;
  submitted: number;
  gagal: number;
  autoRelease: number;
  selesai: number;
  feeAmanCount: number;
  totalFee: number;
};

export default function ProfileClient({
  nickname,
  email,
  role,
  joinedAt,
  stats,
}: {
  nickname: string;
  email: string;
  role: string;
  joinedAt: string;
  stats: Stats;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(nickname);
  const [saved, setSaved] = useState(nickname);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSigningOut, startSignOut] = useTransition();

  const submitRate = stats.total > 0
    ? ((stats.submitted / stats.total) * 100).toFixed(0)
    : "0";

  const joinDate = new Date(joinedAt).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });

  const handleSave = () => {
    if (!name.trim() || name.trim() === saved) { setEditing(false); return; }
    setError(null);
    startTransition(async () => {
      const res = await updateNickname(name.trim());
      if (res.error) { setError(res.error); return; }
      setSaved(name.trim());
      setEditing(false);
    });
  };

  const handleSignOut = () => {
    startSignOut(async () => { await signOut(); });
  };

  return (
    <div className="max-w-lg mx-auto px-5 py-8 space-y-5">
      {/* Avatar + nama */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-blue-600">
              {saved.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-gray-900 truncate">{saved}</p>
            <p className="text-sm text-gray-500 truncate">{email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold capitalize">
            {role}
          </span>
          <span>·</span>
          <span>Bergabung {joinDate}</span>
        </div>

        {/* Edit nama */}
        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setName(saved); setError(null); }}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !name.trim()}
                className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-40"
              >
                {isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-full py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Ubah Nama Panggilan
          </button>
        )}
      </div>

      {/* Statistik kinerja — hanya untuk freelancer */}
      {role === "freelancer" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Statistik Kinerja</h2>

          {/* Fee terkumpul */}
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3.5 mb-4 text-center">
            <p className="text-xs font-medium text-green-700">Fee Terkumpul</p>
            <p className="text-2xl font-bold text-green-700 mt-0.5">
              Rp{stats.totalFee.toLocaleString("id-ID")}
            </p>
            <p className="text-[11px] text-green-600 mt-1">
              {stats.feeAmanCount} POI lolos validasi nomor
            </p>
          </div>
          <p className="text-[11px] text-gray-400 -mt-2 mb-4">
            Fee terkunci begitu nomor WA divalidasi tim internal — progress campaign setelahnya bukan tanggung jawabmu.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Total Klaim" value={stats.total} color="text-gray-800" />
            <StatCard label="Aktif" value={stats.aktif} color="text-blue-600" />
            <StatCard label="Selesai" value={stats.selesai} color="text-green-600" />
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Submitted" value={stats.submitted} color="text-yellow-600" />
            <StatCard label="Gagal" value={stats.gagal} color="text-orange-500" />
            <StatCard label="Auto-Release" value={stats.autoRelease} color="text-red-400" />
          </div>

          {/* Submit rate bar */}
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Submit Rate</span>
              <span className="font-semibold text-gray-700">{submitRate}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  parseInt(submitRate) >= 70 ? "bg-green-500"
                  : parseInt(submitRate) >= 40 ? "bg-yellow-400"
                  : "bg-red-400"
                }`}
                style={{ width: `${submitRate}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Submitted ÷ Total Klaim
            </p>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full py-2.5 text-sm font-semibold text-red-600 border border-red-100 rounded-xl hover:bg-red-50 disabled:opacity-40 transition-colors"
        >
          {isSigningOut ? "Keluar..." : "Logout"}
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
