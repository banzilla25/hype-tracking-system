"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sourcePoiInternal } from "@/lib/actions/leads";

const CATEGORIES = ["hotel", "fnb", "ttd", "attraction"];

export default function AddLeadForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await sourcePoiInternal(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      // Redirect ke detail lead yang baru dibuat
      router.push(`/leads/${result.claimId}`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* POI Info */}
      <Section title="Data POI">
        <Field label="POI ID" name="poi_id" required placeholder="ID unik dari TikTok" />
        <Field label="Nama Tempat" name="name" required placeholder="Nama hotel / restoran / dsb" />
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

      {/* Kontak */}
      <Section title="Info Kontak">
        <Field label="Nama PIC" name="pic_name" required placeholder="Nama kontak merchant" />
        <Field label="Nomor WhatsApp" name="wa_number" required type="tel" placeholder="08xx / +628xx" />
        <Field label="Jabatan (opsional)" name="pic_position" placeholder="Manager, Owner..." />
      </Section>

      {/* Detail opsional */}
      <Section title="Detail Tambahan (opsional)">
        <Field label="AOV (Rupiah)" name="aov" type="number" placeholder="Rata-rata transaksi" />
        <div className="flex items-center gap-3">
          <input type="checkbox" name="is_undersupplied" value="true" id="undersupplied"
            className="w-4 h-4 rounded text-blue-600" />
          <label htmlFor="undersupplied" className="text-sm text-gray-700">
            POI Undersupplied (prioritas tinggi)
          </label>
        </div>
        <Field label="Priority Tag" name="priority_tag" placeholder="Cth: VIP, Ramadan, dsb" />
        <Field label="Source Campaign" name="source_campaign" placeholder="Nama campaign sumber" />
      </Section>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-2xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "Menambahkan..." : "Tambah ke Pipeline →"}
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
