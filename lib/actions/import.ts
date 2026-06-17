"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";

// Kolom yang benar-benar wajib ada
const REQUIRED_COLS = ["poi_id", "city", "area"];

// Alias header → nama kolom internal (case-insensitive)
const HEADER_ALIASES: Record<string, string> = {
  poi_name: "name",
  nama:     "name",
  kota:     "city",
  wilayah:  "area",
  kawasan:  "area",
};

export type PoiRow = {
  poi_id: string;
  name: string;
  category: string;
  city: string;
  area: string;
  aov: number | null;
  is_undersupplied: boolean | null;
  priority_tag: string | null;
  source: string;
  source_campaign: string | null;
  latitude: number | null;
  longitude: number | null;
  full_address: string | null;
  status: "available";
};

export type ImportSummary = {
  totalRows: number;
  validCount: number;
  errorCount: number;
  byCategory: Record<string, number>;
  byCity: Record<string, number>;
  bySource: Record<string, number>;
  withAov: number;
  missingCategory: number;
};

export type PreviewResult = {
  valid: PoiRow[];
  errors: string[];
  totalRows: number;
  summary: ImportSummary;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectDelimiter(line: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",", bestCount = 0;
  for (const d of candidates) {
    const count = line.split(d).length - 1;
    if (count > bestCount) { bestCount = count; best = d; }
  }
  return best;
}

function parseCSVLine(line: string, delimiter = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === delimiter && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

// Parse file (CSV atau XLSX) → string[][] (baris pertama = header)
async function parseFileToRows(file: File): Promise<string[][] | { error: string }> {
  const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls")
    || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    || file.type === "application/vnd.ms-excel";

  if (isExcel) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return { error: "Sheet pertama tidak ditemukan di file Excel" };
    const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1, raw: false, defval: "" });
    // Filter baris kosong
    const rows = raw.filter(r => r.some(c => String(c ?? "").trim() !== ""));
    if (rows.length < 2) return { error: "File kosong atau hanya ada header" };
    return rows.map(r => r.map(c => String(c ?? "").trim()));
  }

  // CSV
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { error: "File kosong atau hanya ada header" };
  const delimiter = detectDelimiter(lines[0]);
  return lines.map(l => parseCSVLine(l, delimiter));
}

// ── Step 1: Parse file → preview ─────────────────────────────────────────────
export async function previewImportCsv(
  formData: FormData
): Promise<PreviewResult | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("csv_file") as File | null;
  if (!file) return { error: "File tidak ditemukan" };
  if (file.size > 50 * 1024 * 1024) return { error: "Ukuran file maks 50 MB" };

  const rowsResult = await parseFileToRows(file);
  if ("error" in rowsResult) return rowsResult;
  const [headerRow, ...dataRows] = rowsResult;

  // Kolom mapping eksplisit dari UI (csvHeader.toLowerCase() → internalField)
  const mappingJson = formData.get("column_map") as string | null;
  const colMap: Record<string, string> = mappingJson ? JSON.parse(mappingJson) : {};

  // Normalisasi header
  const headers = headerRow.map((h) => {
    const lower = h.toLowerCase().trim();
    return colMap[lower] ?? HEADER_ALIASES[lower] ?? lower;
  });

  for (const req of REQUIRED_COLS) {
    if (!headers.includes(req))
      return { error: `Kolom wajib tidak ditemukan: "${req}". File harus memiliki kolom poi_id, city, dan area.` };
  }
  if (!headers.includes("name"))
    return { error: `Kolom nama tidak ditemukan. Tambahkan kolom "name" atau "poi_name".` };

  const get = (row: string[], col: string): string => {
    const idx = headers.indexOf(col);
    return idx >= 0 ? (row[idx]?.trim() ?? "") : "";
  };

  const valid: PoiRow[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const poiId = get(row, "poi_id");
    const name  = get(row, "name");
    const city  = get(row, "city");
    const area  = get(row, "area");

    if (!poiId || !name || !city || !area) {
      errors.push(`Baris ${i + 2}: kolom wajib kosong (poi_id / name / city / area)`);
      continue;
    }

    if (seenIds.has(poiId)) {
      errors.push(`Baris ${i + 2}: poi_id "${poiId}" duplikat dalam file`);
      continue;
    }
    seenIds.add(poiId);

    const rawSource = get(row, "source");
    const source = rawSource || "internal";
    if (rawSource && !["freelancer", "internal"].includes(rawSource)) {
      errors.push(`Baris ${i + 2}: source tidak valid "${rawSource}" — gunakan 'freelancer' atau 'internal'`);
      continue;
    }

    const aovStr = get(row, "aov");
    const aov    = aovStr ? parseFloat(aovStr) : null;

    const isUStr = get(row, "is_undersupplied").toLowerCase();
    const isUndersupplied =
      ["true", "1", "ya"].includes(isUStr)    ? true
      : ["false", "0", "tidak"].includes(isUStr) ? false
      : null;

    const latStr = get(row, "latitude");
    const lngStr = get(row, "longitude");
    const lat    = latStr ? parseFloat(latStr) : null;
    const lng    = lngStr ? parseFloat(lngStr) : null;

    const rawCategory = get(row, "category").toLowerCase();

    valid.push({
      poi_id:           poiId,
      name,
      category:         rawCategory || "lainnya",
      city,
      area,
      aov:              aov && !isNaN(aov) ? aov : null,
      is_undersupplied: isUndersupplied,
      priority_tag:     get(row, "priority_tag") || null,
      source,
      source_campaign:  get(row, "source_campaign") || null,
      latitude:         lat && !isNaN(lat) ? lat : null,
      longitude:        lng && !isNaN(lng) ? lng : null,
      full_address:     get(row, "full_address") || null,
      status:           "available",
    });
  }

  // Hitung summary
  const byCategory: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let withAov = 0;
  let missingCategory = 0;

  for (const row of valid) {
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
    byCity[row.city] = (byCity[row.city] ?? 0) + 1;
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    if (row.aov) withAov++;
    if (row.category === "lainnya") missingCategory++;
  }

  const totalRows = dataRows.length;
  return {
    valid, errors, totalRows,
    summary: {
      totalRows, validCount: valid.length, errorCount: errors.length,
      byCategory, byCity, bySource, withAov, missingCategory,
    },
  };
}

// ── Step 2: Import satu batch ─────────────────────────────────────────────────
export async function importBatch(
  pois: PoiRow[]
): Promise<{ imported: number; errors: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!pois.length) return { imported: 0, errors: [] };

  const { data, error } = await supabase
    .from("pois")
    .upsert(pois, { onConflict: "poi_id", ignoreDuplicates: true })
    .select("poi_id");

  if (error) return { imported: 0, errors: [error.message] };
  return { imported: data?.length ?? 0, errors: [] };
}

// ── Legacy compat ─────────────────────────────────────────────────────────────
export async function confirmImportPois(
  pois: PoiRow[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!pois.length) return { imported: 0, skipped: 0, errors: ["Tidak ada data untuk diimpor"] };

  const BATCH = 500;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < pois.length; i += BATCH) {
    const batch = pois.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("pois")
      .upsert(batch, { onConflict: "poi_id", ignoreDuplicates: true })
      .select("poi_id");

    if (error) { errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`); }
    else { inserted += data?.length ?? 0; }
  }

  return { imported: inserted, skipped: pois.length - inserted, errors };
}

export async function importPoisFromCsv(
  formData: FormData
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const preview = await previewImportCsv(formData);
  if ("error" in preview) return { imported: 0, skipped: 0, errors: [preview.error] };
  const result = await confirmImportPois(preview.valid);
  return { imported: result.imported, skipped: result.skipped, errors: [...preview.errors, ...result.errors] };
}
