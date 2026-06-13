"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPoiToPool } from "@/lib/actions/poi";

const CATEGORIES = ["fnb", "hotel", "ttd", "attraction"];

interface Props {
  isInternal: boolean;
}

export default function AddPoiPoolForm({ isInternal }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pendingData, setPendingData] = useState<FormData | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setWarning(null);
    submitForm(formData, false);
  };

  const submitForm = (formData: FormData, force: boolean) => {
    if (force) formData.set("force", "true");
    startTransition(async () => {
      const result = await addPoiToPool(formData);
      if (result.error) { setError(result.error); return; }
      if (result.warning) {
        setWarning(result.warning);
        setPendingData(formData);
        return;
      }
      if (isInternal) {
        router.push("/pool");
      } else {
        router.push(`/tasks/${result.claimId}`);
      }
    });
  };

  const handleForceSubmit = () => {
    if (!pendingData) return;
    setWarning(null);
    submitForm(pendingData, true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {warning && (
        <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-2xl space-y-2">
          <p className="text-sm text-yellow-800 font-medium">Peringatan Duplikat</p>
          <p className="text-sm text-yellow-700">{warning}</p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setWarning(null)}
              className="flex-1 py-2 text-sm border border-yellow-300 text-yellow-700 rounded-xl hover:bg-yellow-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleForceSubmit}
              disabled={isPending}
              className="flex-1 py-2 text-sm bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 disabled:opacity-40"
            >
              {isPending ? "Menyimpan..." : "Tetap Tambah"}
            </button>
          </div>
        </div>
      )}

      {/* Info banner */}
      {!isInternal && (
        <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl">
          <p className="text-xs text-blue-700">
            POI ini akan langsung masuk ke pipeline kamu. Jika tidak ada aktivitas selama 7 hari, POI akan otomatis dilepas ke pool.
          </p>
        </div>
      )}

      <Section title="Data POI">
        <Field label="Nama Tempat" name="name" required placeholder="Nama restoran, hotel, wisata..." />
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Kategori <span className="text-red-500">*</span>
          </label>
          <select
            name="category"
            required
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Pilih kategori...</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <Field label="Kota" name="city" required placeholder="Jakarta, Surabaya, Bali..." />
        <Field label="Area" name="area" required placeholder="Kemang, Seminyak, SCBD..." />
      </Section>

      <Section title="Detail Tambahan (opsional)">
        <Field label="AOV (Rupiah)" name="aov" type="number" placeholder="Rata-rata transaksi" />
        <Field label="Priority Tag" name="priority_tag" placeholder="VIP, Ramadan, dsb" />
      </Section>

      <button
        type="submit"
        disabled={isPending || !!warning}
        className="w-full py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-2xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "Menyimpan..." : isInternal ? "Tambah ke Pool →" : "Tambah & Klaim →"}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label, name, required, placeholder, type = "text",
}: {
  label: string; name: string; required?: boolean; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
