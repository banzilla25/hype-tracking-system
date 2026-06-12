"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Kolom wajib
const REQUIRED = ["poi_id", "name", "category", "city", "area"];
const TERMINAL_STATUSES = ["gagal", "poi_mati", "declined", "campaign_selesai", "repeat_campaign"];

// Parser CSV sederhana yang handle field dengan quote
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function importPoisFromCsv(
  formData: FormData
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("csv_file") as File | null;
  if (!file) return { imported: 0, skipped: 0, errors: ["File tidak ditemukan"] };

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, skipped: 0, errors: ["File kosong atau hanya ada header"] };

  // Parse header
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  for (const req of REQUIRED) {
    if (!headers.includes(req)) {
      return {
        imported: 0,
        skipped: 0,
        errors: [`Kolom wajib tidak ditemukan: ${req}`],
      };
    }
  }

  const get = (row: string[], col: string): string =>
    row[headers.indexOf(col)]?.trim() ?? "";

  // Parse setiap baris
  const parsedPois: Record<string, unknown>[] = [];
  const rowErrors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const poiId = get(row, "poi_id");
    const name = get(row, "name");
    const category = get(row, "category");
    const city = get(row, "city");
    const area = get(row, "area");

    if (!poiId || !name || !category || !city || !area) {
      rowErrors.push(`Baris ${i + 1}: kolom wajib kosong (poi_id/name/category/city/area)`);
      continue;
    }

    const aovStr = get(row, "aov");
    const aov = aovStr ? parseFloat(aovStr) : null;

    const isUndersuppliedStr = get(row, "is_undersupplied").toLowerCase();
    const isUndersupplied =
      isUndersuppliedStr === "true" || isUndersuppliedStr === "1" || isUndersuppliedStr === "ya"
        ? true
        : isUndersuppliedStr === "false" || isUndersuppliedStr === "0" || isUndersuppliedStr === "tidak"
        ? false
        : null;

    const source = get(row, "source") || "freelancer";
    if (source !== "freelancer" && source !== "internal") {
      rowErrors.push(`Baris ${i + 1}: source harus 'freelancer' atau 'internal'`);
      continue;
    }

    parsedPois.push({
      poi_id: poiId,
      name,
      category: category.toLowerCase(),
      city,
      area,
      aov: isNaN(aov as number) ? null : aov,
      is_undersupplied: isUndersupplied,
      priority_tag: get(row, "priority_tag") || null,
      source,
      source_campaign: get(row, "source_campaign") || null,
      latitude: get(row, "latitude") ? parseFloat(get(row, "latitude")) : null,
      longitude: get(row, "longitude") ? parseFloat(get(row, "longitude")) : null,
      full_address: get(row, "full_address") || null,
      status: "available",
    });
  }

  if (!parsedPois.length) {
    return { imported: 0, skipped: 0, errors: rowErrors };
  }

  // Cek yang sudah ada di database (dedup by poi_id)
  const allPoiIds = parsedPois.map((p) => p.poi_id as string);
  const { data: existing } = await supabase
    .from("pois")
    .select("poi_id")
    .in("poi_id", allPoiIds);

  const existingIds = new Set(existing?.map((e) => e.poi_id) ?? []);
  const newPois = parsedPois.filter((p) => !existingIds.has(p.poi_id as string));
  const skippedCount = parsedPois.length - newPois.length;

  if (!newPois.length) {
    return { imported: 0, skipped: skippedCount, errors: rowErrors };
  }

  // Insert dalam batch 500 per request
  const BATCH_SIZE = 500;
  let insertedCount = 0;

  for (let i = 0; i < newPois.length; i += BATCH_SIZE) {
    const batch = newPois.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase.from("pois").insert(batch);
    if (insertError) {
      rowErrors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: gagal insert — ${insertError.message}`);
    } else {
      insertedCount += batch.length;
    }
  }

  return { imported: insertedCount, skipped: skippedCount, errors: rowErrors };
}

// Tidak dipakai tapi export untuk referensi
export { TERMINAL_STATUSES };
