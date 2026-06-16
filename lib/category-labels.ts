export const CATEGORY_LABELS: Record<string, string> = {
  fnb:        "F&B",
  hotel:      "Hotel",
  ttd:        "Tempat Wisata",
  attraction: "Atraksi",
  spa:        "Spa & Wellness",
  retail:     "Retail",
  hiburan:    "Hiburan",
  olahraga:   "Olahraga",
  edukasi:    "Edukasi",
  lainnya:    "Lainnya",
};

export function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat.toLowerCase()] ?? cat;
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));
