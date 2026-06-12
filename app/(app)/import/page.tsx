"use client";

import { useState, useTransition, useRef } from "react";
import { importPoisFromCsv } from "@/lib/actions/import";

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

export default function ImportPage() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setResult(null);
    startTransition(async () => {
      const res = await importPoisFromCsv(formData);
      setResult(res);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(e.target.files?.[0]?.name ?? null);
    setResult(null);
  };

  const handleReset = () => {
    setResult(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Import POI dari CSV</h1>
      <p className="text-sm text-gray-500 mb-6">
        Upload file CSV untuk menambahkan POI baru ke pool. Duplikat (poi_id sama) akan dilewati.
      </p>

      {/* Format reference */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
        <p className="text-xs font-semibold text-blue-700 mb-2">Kolom CSV yang diperlukan</p>
        <div className="flex flex-wrap gap-1.5">
          {["poi_id*", "name*", "category*", "city*", "area*"].map((col) => (
            <span
              key={col}
              className="text-[11px] font-medium px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md"
            >
              {col}
            </span>
          ))}
        </div>
        <p className="text-xs text-blue-600 mt-2">
          Opsional: aov, is_undersupplied, priority_tag, source, source_campaign, latitude,
          longitude, full_address
        </p>
        <p className="text-xs text-blue-500 mt-1">
          category: hotel · fnb · ttd · attraction &nbsp;|&nbsp; source: freelancer (default) ·
          internal &nbsp;|&nbsp; is_undersupplied: true/false
        </p>
      </div>

      {/* Upload form */}
      <form onSubmit={handleSubmit} className="space-y-4">
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
                <p className="text-sm font-medium text-blue-700 max-w-xs truncate px-4">
                  {fileName}
                </p>
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

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending || !fileName}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <>
                <SpinnerIcon />
                Mengimpor...
              </>
            ) : (
              "Import POI"
            )}
          </button>
          {(result || fileName) && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isPending}
              className="px-4 py-3 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      {/* Result */}
      {result && (
        <div className="mt-6 space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Berhasil"
              value={result.imported}
              color={result.imported > 0 ? "green" : "gray"}
            />
            <StatCard label="Dilewati" value={result.skipped} color="yellow" />
            <StatCard
              label="Error"
              value={result.errors.length}
              color={result.errors.length > 0 ? "red" : "gray"}
            />
          </div>

          {/* Error list */}
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-red-700 mb-2">
                {result.errors.length} error ditemukan
              </p>
              <ul className="space-y-1 max-h-48 overflow-auto">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600 flex gap-1.5">
                    <span className="flex-shrink-0">·</span>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.imported > 0 && result.errors.length === 0 && (
            <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
              <p className="text-sm font-medium text-green-700">
                {result.imported} POI berhasil diimpor ke pool.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "yellow" | "red" | "gray";
}) {
  const colorMap = {
    green: "bg-green-50 border-green-100 text-green-700",
    yellow: "bg-yellow-50 border-yellow-100 text-yellow-700",
    red: "bg-red-50 border-red-100 text-red-700",
    gray: "bg-gray-50 border-gray-100 text-gray-500",
  };
  return (
    <div className={`border rounded-2xl px-4 py-3 text-center ${colorMap[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
}

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

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
