"use client";

import { useState, useTransition, useRef } from "react";
import { previewImportCsv, confirmImportPois, type PoiRow, type PreviewResult } from "@/lib/actions/import";

type Step = "upload" | "preview" | "done";

type DoneResult = { imported: number; skipped: number; errors: string[] };

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [done, setDone] = useState<DoneResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(e.target.files?.[0]?.name ?? null);
    setPreviewError(null);
  };

  // Step 1 → Step 2: parse CSV, tampilkan preview
  const handlePreview = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setPreviewError(null);
    startTransition(async () => {
      const res = await previewImportCsv(formData);
      if ("error" in res) {
        setPreviewError(res.error);
        return;
      }
      setPreview(res);
      setStep("preview");
    });
  };

  // Step 2 → Step 3: simpan ke DB
  const handleConfirm = () => {
    if (!preview) return;
    startTransition(async () => {
      const res = await confirmImportPois(preview.valid);
      setDone({ imported: res.imported, skipped: res.skipped, errors: res.errors });
      setStep("done");
    });
  };

  const handleReset = () => {
    setStep("upload");
    setPreview(null);
    setPreviewError(null);
    setDone(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">Import POI dari CSV</h1>
        <a
          href="/template_import_poi.csv"
          download
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors"
        >
          <DownloadIcon className="w-3.5 h-3.5" />
          Unduh Template
        </a>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Upload file CSV untuk menambahkan POI baru ke pool. Duplikat (poi_id sama) akan dilewati otomatis.
      </p>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === "upload" && (
        <>
          {/* Format reference */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
            <p className="text-xs font-semibold text-blue-700 mb-2">Kolom CSV yang diperlukan</p>
            <div className="flex flex-wrap gap-1.5">
              {["poi_id*", "name* (atau poi_name)", "city*", "area*"].map((col) => (
                <span
                  key={col}
                  className="text-[11px] font-medium px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md"
                >
                  {col}
                </span>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Opsional: category, aov, is_undersupplied, priority_tag, source, source_campaign, latitude, longitude, full_address
            </p>
            <p className="text-xs text-blue-500 mt-1">
              category: hotel · fnb · ttd · attraction · lainnya (default jika kosong) &nbsp;|&nbsp; source: internal (default) · freelancer
            </p>
          </div>

          {previewError && (
            <div className="mb-4 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-700">
              {previewError}
            </div>
          )}

          <form onSubmit={handlePreview} className="space-y-4">
            <label className="block">
              <div
                className={`relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
                  fileName
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  name="csv_file"
                  accept=".csv,text/csv"
                  required
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {fileName ? (
                  <>
                    <FileIcon className="w-8 h-8 text-blue-500 mb-2" />
                    <p className="text-sm font-medium text-blue-700 max-w-xs truncate px-4">{fileName}</p>
                    <p className="text-xs text-blue-500 mt-0.5">Klik untuk ganti file</p>
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-600">Klik atau seret file CSV</p>
                    <p className="text-xs text-gray-400 mt-0.5">Ukuran maks 10 MB</p>
                  </>
                )}
              </div>
            </label>

            <button
              type="submit"
              disabled={isPending || !fileName}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? <><SpinnerIcon /> Memproses...</> : "Lihat Preview"}
            </button>
          </form>
        </>
      )}

      {/* ── Step 2: Preview ─────────────────────────────────────────────── */}
      {step === "preview" && preview && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Siap Diimpor" value={preview.valid.length} color="green" />
            <StatCard label="Baris Error" value={preview.errors.length} color={preview.errors.length > 0 ? "red" : "gray"} />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            <p className="text-xs text-blue-700">
              Duplikat (poi_id yang sudah ada di database) akan dilewati secara otomatis saat konfirmasi — tidak perlu dicek manual.
            </p>
          </div>

          {/* Row errors */}
          {preview.errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-red-700 mb-2">
                {preview.errors.length} baris tidak valid:
              </p>
              <ul className="space-y-0.5 max-h-36 overflow-auto">
                {preview.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600">· {err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview table */}
          {preview.valid.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">
                Preview {Math.min(preview.valid.length, 5)} dari {preview.valid.length} baris yang akan diimpor:
              </p>
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {["poi_id", "name", "category", "city", "area", "source"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {preview.valid.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{row.poi_id}</td>
                        <td className="px-3 py-2 text-gray-900 max-w-45 truncate">{row.name}</td>
                        <td className="px-3 py-2 text-gray-600">{row.category}</td>
                        <td className="px-3 py-2 text-gray-600">{row.city}</td>
                        <td className="px-3 py-2 text-gray-600">{row.area}</td>
                        <td className="px-3 py-2 text-gray-600">{row.source}</td>
                      </tr>
                    ))}
                    {preview.valid.length > 5 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-2 text-center text-gray-400">
                          + {preview.valid.length - 5} baris lainnya
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleReset}
              disabled={isPending}
              className="flex-1 px-4 py-3 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors font-medium"
            >
              Kembali
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending || preview.valid.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? (
                <><SpinnerIcon /> Menyimpan...</>
              ) : (
                <>Konfirmasi Import {preview.valid.length} POI</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ─────────────────────────────────────────────────── */}
      {step === "done" && done && (
        <div className="space-y-4">
          {done.errors.length === 0 ? (
            <div className="bg-green-50 border border-green-100 rounded-2xl px-5 py-6 text-center">
              <CheckCircleIcon className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-bold text-green-800">{done.imported} POI berhasil diimpor</p>
              {done.skipped > 0 && (
                <p className="text-sm text-green-600 mt-1">{done.skipped} dilewati (sudah ada di database)</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Berhasil" value={done.imported} color={done.imported > 0 ? "green" : "gray"} />
              <StatCard label="Dilewati" value={done.skipped} color="yellow" />
              <StatCard label="Gagal" value={done.errors.length} color="red" />
            </div>
          )}

          {done.errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-red-700 mb-2">{done.errors.length} error:</p>
              <ul className="space-y-0.5 max-h-36 overflow-auto">
                {done.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600">· {err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Import Lagi
            </button>
            <a
              href="/pool"
              className="flex-1 flex items-center justify-center px-4 py-3 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              Lihat Pool
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step indicator ──────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload",  label: "Upload" },
    { id: "preview", label: "Preview" },
    { id: "done",    label: "Selesai" },
  ];
  const idx = steps.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 ${i <= idx ? "text-blue-600" : "text-gray-400"}`}>
            <span
              className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${
                i < idx
                  ? "bg-blue-600 text-white"
                  : i === idx
                  ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {i < idx ? "✓" : i + 1}
            </span>
            <span className="text-xs font-semibold">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px flex-1 w-6 ${i < idx ? "bg-blue-400" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: "green" | "yellow" | "red" | "gray" }) {
  const map = {
    green:  "bg-green-50 border-green-100 text-green-700",
    yellow: "bg-yellow-50 border-yellow-100 text-yellow-700",
    red:    "bg-red-50 border-red-100 text-red-700",
    gray:   "bg-gray-50 border-gray-100 text-gray-500",
  };
  return (
    <div className={`border rounded-2xl px-4 py-3 text-center ${map[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
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
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
