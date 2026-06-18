// TypeScript types — sesuai SPEC_TEKNIS.md bagian 6

export type Role = "freelancer" | "internal";
export type AccountStatus = "pending" | "active" | "inactive";
export type PoiSource = "freelancer" | "internal";
export type ChangedByRole = "freelancer" | "internal" | "system";
export type NotePhase = "akuisisi" | "campaign";
export type FileType = "proof_chat" | "proof_visit";

export type PoiStatus =
  | "available"
  | "in_progress"
  | "gagal"
  | "poi_mati"
  | "semi_dealing"
  | "submitted"
  | "validasi_nomor"
  | "nomor_invalid"
  | "fiksasi_kerjasama"
  | "declined"
  | "disetujui_diklaim"
  | "koordinasi_kreator"
  | "campaign_jalan"
  | "campaign_selesai"
  | "repeat_campaign";

export interface Profile {
  id: string;
  nickname: string;
  role: Role;
  account_status: AccountStatus;
  created_at: string;
}

export interface Poi {
  poi_id: string;
  name: string;
  category: string;
  city: string;
  area: string;
  aov: number | null;
  is_undersupplied: boolean | null;
  priority_tag: string | null;
  status: PoiStatus;
  current_claim_id: number | null;
  source: PoiSource;
  source_campaign: string | null;
  latitude: number | null;
  longitude: number | null;
  full_address: string | null;
  created_at: string;
}

export interface Claim {
  claim_id: number;
  poi_id: string;
  user_id: string;
  claim_status: PoiStatus;
  pic_name: string | null;
  pic_position: string | null;
  wa_number: string | null;
  wa_validated_by_freelancer: boolean;
  wa_validated_by_bd: boolean;
  fail_reason: string | null;
  is_retryable: boolean | null;
  deal_type: string | null;
  cooperation_result: string | null;
  campaign_target_videos: number | null;
  campaign_uploaded_videos: number;
  creator_visit_date: string | null;
  claimed_at: string;
  submitted_at: string | null;
  validated_at: string | null;
  fixed_at: string | null;
  campaign_started_at: string | null;
  completed_at: string | null;
  last_activity_at: string;
  release_reason: string | null;
}

export interface StatusHistory {
  history_id: number;
  poi_id: string;
  claim_id: number | null;
  from_status: PoiStatus | null;
  to_status: PoiStatus;
  changed_by: string | null;
  changed_by_role: ChangedByRole;
  note: string | null;
  created_at: string;
}

export interface Note {
  note_id: number;
  claim_id: number;
  author_id: string;
  phase: NotePhase;
  is_internal_only: boolean;
  note_text: string;
  created_at: string;
}

export interface ProofFile {
  file_id: number;
  claim_id: number;
  file_type: FileType;
  file_url: string;
  uploaded_at: string;
}

// ── State Machine ──────────────────────────────────────────────────────────
// Transisi yang DIIZINKAN sesuai SPEC_TEKNIS.md bagian 4

export const ALLOWED_TRANSITIONS: Record<PoiStatus, PoiStatus[]> = {
  available:            ["in_progress"],
  in_progress:          ["semi_dealing", "gagal", "poi_mati"],
  gagal:                ["available"],
  poi_mati:             [],
  semi_dealing:         ["submitted"],
  submitted:            ["validasi_nomor"],
  validasi_nomor:       ["fiksasi_kerjasama", "nomor_invalid"],
  nomor_invalid:        ["in_progress"],
  fiksasi_kerjasama:    ["disetujui_diklaim", "declined"],
  declined:             [],
  disetujui_diklaim:    ["koordinasi_kreator"],
  koordinasi_kreator:   ["campaign_jalan"],
  campaign_jalan:       ["campaign_selesai"],
  campaign_selesai:     ["repeat_campaign"],
  repeat_campaign:      ["campaign_jalan"],
};

export function isTransitionAllowed(from: PoiStatus, to: PoiStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
