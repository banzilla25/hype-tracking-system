"use client";

import { useState, useTransition, useRef } from "react";
import { previewImportCsv, importBatch, type PreviewResult } from "@/lib/actions/import";
import { categoryLabel } from "@/lib/category-labels";

type Step = "upload" | "map" | "preview" | "done";

type DoneResult = { imported: number; skipped: number; errors: string[] };
type Progress = { done: number; total: number } | null;

const BATCH_SIZE = 500;

// Field wajib yang harus di-map
const REQUIRED_FIELDS = [
  { key: "poi_id", label: "POI ID" },
  { key: "name",   label: "Nama POI" },
  { key: "city",   label: "Kota" },
  { key: "area",   label: "Area / Kecamatan" },
];

// Alias yang dikenali otomatis (sama dengan server)
const AUTO_ALIASES: Record<string, string> = {
  poi_name: "name", nama: "name",
  kota: "city",
  wilayah: "area", kawasan: "area",
};

async function parseHeaders(file: File): Promise<string[]> {
  const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

  if (isExcel) {
    const XLSX = await import("xlsx");
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
    const first = rows[0] ?? [];
    return first.map(c => String(c ?? "").trim()).filter(Boolean);
  }

  // CSV
  const text = await file.text();
  const line = text.split(/\r?\n/)[0] ?? "";
  const candidates = [",", ";", "\t", "|"];
  let delimiter = ",", maxCount = 0;
  for (const d of candidates) {
    const count = line.split(d).length - 1;
    if (count > maxCount) { maxCount = count; delimiter = d; }
  }
  const cols: string[] = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === delimiter && !inQ) { cols.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  cols.push(cur.trim());
  return cols.map(c => c.replace(/^"|"$/g, "").trim()).filter(Boolean);
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const [progress, setProgress] = useState<Progress>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [done, setDone] = useState<DoneResult | null>(null);
  const [liveErrors, setLiveErrors] = useState<string[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  // columnMap: internal field → original CSV header
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreviewError(null);

    const headers = await parseHeaders(file);
    setRawHeaders(headers);

    // Auto-detect: map internal field → CSV header
    const detected: Record<string, string> = {};
    for (const h of headers) {
      const lower = h.toLowerCase();
      const resolved = AUTO_ALIASES[lower] ?? lower;
      if (REQUIRED_FIELDS.some(f => f.key === resolved)) {
        detected[resolved] = h;
      }
    }
    setColumnMap(detected);
  };

  // Build FormData dengan column_map dan submit preview
  const submitPreview = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("csv_file", file);

    // Kirim mapping: csvHeader.lowercase → internalField
    const serverMap: Record<string, string> = {};
    for (const [field, csvHeader] of Object.entries(columnMap)) {
      serverMap[csvHeader.toLowerCase()] = field;
    }
    formData.append("column_map", JSON.stringify(serverMap));

    setPreviewError(null);
    startTransition(async () => {
      const res = await previewImportCsv(formData);
      if ("error" in res) {
        setPreviewError(res.error);
        setStep("upload");
        return;
      }
      setPreview(res);
      setStep("preview");
    });
  };

  // Step 1: cek apakah semua field sudah terdeteksi, atau tampilkan mapping UI
  const handlePreview = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const missing = REQUIRED_FIELDS.filter(f => !columnMap[f.key]);
    if (missing.length > 0) {
      setStep("map");
      return;
    }
    submitPreview();
  };

  // Step 2 → Step 3: simpan ke DB per batch dengan progress
  const handleConfirm = async () => {
    if (!preview || isConfirming) return;
    const pois = preview.valid;
    const total = pois.length;
    setIsConfirming(true);
    setProgress({ done: 0, total });

    let totalImported = 0;
    const allErrors: string[] = [];
    setLiveErrors([]);

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = pois.slice(i, i + BATCH_SIZE);
      const res = await importBatch(batch);
      totalImported += res.imported;
      if (res.errors.length) {
        allErrors.push(...res.errors);
        setLiveErrors([...allErrors]);
      }
      setProgress({ done: Math.min(i + BATCH_SIZE, total), total });
    }

    const skipped = total - totalImported;
    setDone({ imported: totalImported, skipped, errors: allErrors });
    setIsConfirming(false);
    setProgress(null);
    setStep("done");
  };

  const handleReset = () => {
    setStep("upload");
    setPreview(null);
    setPreviewError(null);
    setDone(null);
    setFileName(null);
    setProgress(null);
    setLiveErrors([]);
    setRawHeaders([]);
    setColumnMap({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const allMapped = REQUIRED_FIELDS.every(f => columnMap[f.key]);

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
            <p className="text-xs font-semibold text-blue-700 mb-2">Kolom minimal yang dibutuhkan</p>
            <div className="bg-white rounded-xl px-3 py-2 font-mono text-[11px] text-gray-600 mb-2 overflow-x-auto whitespace-nowrap">
              poi_id · poi_name · city · area
            </div>
            <p className="text-xs text-blue-600">
              Format: <strong>Excel (.xlsx)</strong> atau CSV — Excel lebih aman untuk nama POI yang mengandung koma.
            </p>
            <p className="text-xs text-blue-400 mt-1">
              Nama kolom berbeda? Tidak masalah — bisa mapping manual setelah upload.
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
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
                    <p className="text-sm font-medium text-gray-600">Klik atau seret file CSV / Excel</p>
                    <p className="text-xs text-gray-400 mt-0.5">.csv · .xlsx — maks 50 MB</p>
                  </>
                )}
              </div>
            </label>

            {/* Deteksi kolom live */}
            {rawHeaders.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Kolom terdeteksi di file:</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {rawHeaders.map((h) => (
                    <span key={h} className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 font-mono">
                      {h}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {REQUIRED_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs">
                      {columnMap[key] ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-red-500">✗</span>
                      )}
                      <span className="text-gray-500">{label}:</span>
                      <span className={columnMap[key] ? "font-mono text-gray-700" : "text-red-500 font-medium"}>
                        {columnMap[key] ?? "tidak terdeteksi"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || !fileName}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? <><SpinnerIcon /> Memproses...</> : (
                allMapped && rawHeaders.length > 0 ? "Lihat Preview" : "Lanjut ke Mapping Kolom"
              )}
            </button>
          </form>
        </>
      )}

      {/* ── Step Map: Mapping Kolom ─────────────────────────────────────── */}
      {step === "map" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Mapping kolom diperlukan</p>
            <p className="text-xs text-amber-700">
              Beberapa kolom wajib tidak terdeteksi otomatis. Pilih kolom mana dari file CSV kamu yang sesuai dengan tiap field.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
            {REQUIRED_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {label}
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <select
                  value={columnMap[key] ?? ""}
                  onChange={(e) => setColumnMap({ ...columnMap, [key]: e.target.value })}
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                    columnMap[key] ? "border-green-300 text-gray-900" : "border-gray-300 text-gray-400"
                  }`}
                >
                  <option value="">— pilih kolom dari file CSV —</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {columnMap[key] && (
                  <p className="text-[11px] text-green-600 mt-1">
                    ✓ &quot;{columnMap[key]}&quot; akan digunakan sebagai {label}
                  </p>
                )}
              </div>
            ))}
          </div>

          {previewError && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-700">
              {previewError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Kembali
            </button>
            <button
              onClick={submitPreview}
              disabled={isPending || !allMapped}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? <><SpinnerIcon /> Memproses...</> : "Lihat Preview →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ─────────────────────────────────────────────── */}
      {step === "preview" && preview && (
        <div className="space-y-4">

          {/* ── Ringkasan utama ── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Ringkasan File</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <StatCard label="Total Baris" value={preview.summary.totalRows} color="gray" />
              <StatCard label="Siap Diimpor" value={preview.summary.validCount} color="green" />
              <StatCard label="Baris Error" value={preview.summary.errorCount} color={preview.summary.errorCount > 0 ? "red" : "gray"} />
            </div>
            <div className="bg-blue-50 rounded-xl px-3 py-2">
              <p className="text-xs text-blue-700">
                Duplikat (poi_id yang sudah ada) akan dilewati otomatis — tidak perlu dicek manual.
              </p>
            </div>
          </div>

          {/* ── Distribusi data ── */}
          {preview.valid.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Distribusi Data</p>

              {/* Per kategori */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Kategori</p>
                <div className="space-y-1.5">
                  {Object.entries(preview.summary.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => (
                      <div key={cat} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-28 shrink-0">{categoryLabel(cat)}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${(count / preview.summary.validCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-8 text-right">{count}</span>
                      </div>
                    ))}
                </div>
                {preview.summary.missingCategory > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5">
                    ⚠ {preview.summary.missingCategory} baris tidak punya kategori → akan diisi &quot;lainnya&quot;
                  </p>
                )}
              </div>

              {/* Per kota — top 5 */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">
                  Kota {Object.keys(preview.summary.byCity).length > 5 && `(top 5 dari ${Object.keys(preview.summary.byCity).length})`}
                </p>
                <div className="space-y-1.5">
                  {Object.entries(preview.summary.byCity)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([city, count]) => (
                      <div key={city} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-28 shrink-0 truncate">{city}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${(count / preview.summary.validCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-8 text-right">{count}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Source & kelengkapan */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                <div>
                  <p className="text-[11px] font-medium text-gray-500 mb-1">Source</p>
                  {Object.entries(preview.summary.bySource).map(([src, n]) => (
                    <p key={src} className="text-xs text-gray-700">
                      <span className="font-semibold">{n}</span> {src}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500 mb-1">Kelengkapan</p>
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">{preview.summary.withAov}</span> punya AOV
                  </p>
                  <p className="text-xs text-gray-400">
                    {preview.summary.validCount - preview.summary.withAov} tanpa AOV
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Error detail ── */}
          {preview.errors.length > 0 && (
            <div className="bg-white rounded-2xl border border-red-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-[11px] font-bold shrink-0">!</span>
                <p className="text-sm font-semibold text-red-700">
                  {preview.errors.length} baris tidak akan diimpor
                </p>
              </div>
              <p className="text-xs text-red-500 mb-2">
                Baris-baris ini punya masalah dan dilewati. Perbaiki di file CSV lalu upload ulang jika perlu.
              </p>
              <div className="bg-red-50 rounded-xl p-3 max-h-48 overflow-auto space-y-1.5">
                {preview.errors.map((err, i) => (
                  <div key={i} className="flex gap-2 text-xs text-red-700">
                    <span className="shrink-0 font-mono text-red-400">{String(i + 1).padStart(2, "0")}.</span>
                    <span>{err}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-red-400 mt-2">
                Tip: buka file CSV di Excel/Sheets, cek kolom yang disebutkan di tiap error di atas.
              </p>
            </div>
          )}

          {/* ── Preview tabel 5 baris ── */}
          {preview.valid.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Contoh Data ({Math.min(preview.valid.length, 5)} dari {preview.valid.length} baris)
              </p>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {["poi_id", "name", "kategori", "kota", "area", "source"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {preview.valid.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{row.poi_id}</td>
                        <td className="px-3 py-2 text-gray-900 max-w-45 truncate font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-gray-600">{categoryLabel(row.category)}</td>
                        <td className="px-3 py-2 text-gray-600">{row.city}</td>
                        <td className="px-3 py-2 text-gray-600">{row.area}</td>
                        <td className="px-3 py-2 text-gray-600">{row.source}</td>
                      </tr>
                    ))}
                    {preview.valid.length > 5 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-2.5 text-center text-gray-400 bg-gray-50">
                          + {preview.valid.length - 5} baris lainnya tidak ditampilkan
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Konfirmasi / Progress ── */}
          {isConfirming && progress ? (
            <div className="bg-white border border-emerald-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-800">Sedang mengimpor...</p>
                <p className="text-sm font-bold text-emerald-700">
                  {Math.round((progress.done / progress.total) * 100)}%
                </p>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-right">
                {progress.done.toLocaleString("id-ID")} / {progress.total.toLocaleString("id-ID")} data
              </p>
              {liveErrors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-100">
                  <p className="text-xs font-semibold text-red-600 mb-1.5">
                    ⚠ {liveErrors.length} baris gagal diimpor:
                  </p>
                  <div className="bg-red-50 rounded-xl px-3 py-2 max-h-32 overflow-auto space-y-1">
                    {liveErrors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600">· {err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-emerald-800 mb-1">
                Sudah yakin dengan data di atas?
              </p>
              <p className="text-xs text-emerald-700 mb-4">
                Setelah dikonfirmasi, <strong>{preview.valid.length} POI</strong> akan masuk ke pool dengan status <strong>available</strong>.
                {preview.errors.length > 0 && ` ${preview.errors.length} baris bermasalah tidak akan diimpor.`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors font-medium"
                >
                  Kembali & Perbaiki
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isPending || isConfirming || preview.valid.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Import {preview.valid.length.toLocaleString("id-ID")} POI →
                </button>
              </div>
            </div>
          )}

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
  // "map" dianggap masih di step Upload
  const idx = current === "map" ? 0 : steps.findIndex((s) => s.id === current);
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
