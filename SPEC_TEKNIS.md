# SPEC TEKNIS — Sistem Merchant Activation & Campaign Tracking
### HYPE Media Indonesia — untuk dibangun dengan Claude Code

> **PENTING untuk AI:** Dokumen ini adalah sumber kebenaran tunggal. JANGAN menambah fitur, status, atau tabel yang tidak ada di sini. JANGAN mengasumsikan kebutuhan yang tidak tertulis. Kalau ada yang ambigu, TANYA dulu sebelum implementasi. Bangun bertahap sesuai `PROMPT_TAHAPAN.md`.

---

## 1. Tujuan Sistem

Web app untuk melacak alur kerja dari **freelancer mengumpulkan kontak merchant** (Hotel & F&B) hingga **campaign TikTok GO selesai**. Dikerjakan dua jenis pengguna: Freelancer (cari kontak di lapangan/online) dan Internal (follow up, fiksasi kerjasama, handle campaign).

Inti sistem: satu POI dikunci ke satu freelancer saat dikerjakan, setiap perubahan status tercatat permanen (audit trail), dan POI mengalir lewat pipeline status yang ketat (state machine).

---

## 2. Tech Stack (WAJIB pakai ini)

| Komponen | Teknologi |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth — Google OAuth |
| Storage | Supabase Storage (untuk bukti gambar) |
| Styling | Tailwind CSS |
| Hosting | Vercel |

**Target platform:** Web app responsif. Prioritas tampilan mobile (freelancer buka via browser HP), tapi harus tetap rapi di tablet & desktop (internal pakai laptop).

---

## 3. Autentikasi & Role

### Alur registrasi & login
1. User login pakai **Google OAuth** (via Supabase Auth).
2. Saat pertama kali login, user mengisi **nama panggilan**.
3. Akun baru berstatus `pending` — belum bisa mengakses fitur.
4. **Internal** meng-approve akun baru lewat menu khusus. Setelah di-approve, status jadi `active`.
5. User dengan akun `pending` melihat halaman "menunggu persetujuan".

### Role (HANYA 2)
| Role | Keterangan |
|---|---|
| `freelancer` | Cari kontak, semi-dealing, submit |
| `internal` | Approve akun, follow up, validasi, fiksasi, handle campaign, sourcing F&B mandiri |

> Catatan: "BD" dan "Manager" dilebur jadi satu role `internal`. Tidak ada sub-peran.

### Aturan akses
- Setiap aksi tercatat siapa pelakunya (untuk audit trail).
- Freelancer hanya akses fitur Fase 1 + lihat POI miliknya.
- Internal akses semua + menu approve akun.
- Role pertama (akun paling pertama / seed) di-set `internal` manual agar bisa approve yang lain.

---

## 4. Konsep Status (State Machine)

POI hanya punya SATU status pada satu waktu. Perpindahan status diatur ketat (lihat aturan transisi).

### Daftar Status (14 + 1 khusus)

**Fase 1 — Akuisisi (Freelancer):**
| Status | Arti |
|---|---|
| `available` | POI bebas diambil |
| `in_progress` | Sedang dicari kontaknya (online/visit) |
| `gagal` | Tak dapat kontak, bisa dicoba lagi → balik available |
| `poi_mati` | Tutup/permanen → hilang dari pool |
| `semi_dealing` | Dapat kontak, sedang ajak kerjasama + jelaskan TnC |
| `submitted` | Kontak valid + SS persetujuan, diserahkan ke Internal |

**Fase 2 — Campaign (Internal):**
| Status | Arti |
|---|---|
| `validasi_nomor` | Internal cek nomor bisa dihubungi |
| `nomor_invalid` | Nomor tak bisa dihubungi → balik ke freelancer |
| `fiksasi_kerjasama` | Internal upselling via calling/chat/meeting |
| `declined` | Merchant tak jadi kerjasama saat fiksasi |
| `disetujui_diklaim` | Merchant setuju, kerjasama fix |
| `koordinasi_kreator` | Atur tanggal/jam kreator visit |
| `campaign_jalan` | Kreator visit & upload video |
| `campaign_selesai` | Semua video tayang sesuai target |

**Khusus:**
| Status | Arti |
|---|---|
| `repeat_campaign` | POI selesai di-reaktivasi internal untuk periode baru (tanpa freelancer) |

### Aturan Transisi (yang BOLEH)
```
available → in_progress
in_progress → semi_dealing | gagal | poi_mati
gagal → available
semi_dealing → submitted
submitted → validasi_nomor
validasi_nomor → fiksasi_kerjasama | nomor_invalid
nomor_invalid → in_progress (balik ke freelancer)
fiksasi_kerjasama → disetujui_diklaim | declined
disetujui_diklaim → koordinasi_kreator
koordinasi_kreator → campaign_jalan
campaign_jalan → campaign_selesai
campaign_selesai → repeat_campaign
```

### Aturan Transisi (DILARANG — contoh)
- Loncat tahap (mis. `in_progress` → `campaign_selesai`)
- Mundur dari status final (`disetujui_diklaim` → `available`)
- Sembarang transisi di luar daftar di atas

> **AI: implementasikan validasi transisi ini di backend.** Tolak transisi yang tidak ada di daftar BOLEH. Jangan biarkan status pindah sembarangan.

---

## 5. Aturan Bisnis (WAJIB diterapkan)

1. **Lock saat claim:** Saat freelancer ambil POI, gunakan transaksi atomik — cek `status = available` lalu update ke `in_progress` + set `current_claim_id`. Kalau dua user klik bersamaan, hanya satu yang berhasil.

2. **Claim limit:** Maksimal 10 POI aktif per freelancer (status aktif = belum selesai/lepas). Tolak claim ke-11 dengan pesan jelas.

3. **Validasi nomor 2x:** Freelancer tandai `wa_validated_by_freelancer` saat submit. Internal tandai `wa_validated_by_bd` saat validasi. Kalau internal nilai invalid → status `nomor_invalid`, balik ke freelancer.

4. **Syarat submit (Fase 1 → 2):** WAJIB ada `pic_name` + `wa_number` + minimal 1 file bukti (proof chat). Tombol submit disabled kalau belum lengkap.

5. **Auto-release:** POI yang `last_activity_at` lebih dari 7 hari lalu DAN status masih aktif (in_progress/semi_dealing) → otomatis balik `available`, slot freelancer kosong, catat di history dengan pelaku `system`. Implementasi: bisa pakai Supabase scheduled function / cron, atau cek saat load. (Untuk MVP, boleh cek-on-load dulu.)

6. **Notes per status:** Tampilkan input notes hanya di status tertentu (lihat tabel di bagian 7). Beberapa wajib diisi sebelum transisi.

7. **Notes internal:** Internal bisa menandai note `is_internal_only = true` yang tidak terlihat freelancer.

8. **Audit trail:** SETIAP perubahan status menulis 1 baris ke `status_history`. Append-only — jangan pernah update/delete baris history.

9. **Data kontak bisa diupdate:** `pic_name`, `pic_position`, `wa_number` boleh diperbarui kapan saja oleh yang berwenang. Setiap update dicatat.

---

## 6. Skema Database (Supabase / PostgreSQL)

> Gunakan Row Level Security (RLS) sesuai role. Semua tabel pakai `id` UUID atau bigint auto-increment sesuai konvensi Supabase.

### `profiles` (extend auth.users)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK, = auth.users.id) | |
| nickname | text | Nama panggilan |
| role | text | 'freelancer' / 'internal' |
| account_status | text | 'pending' / 'active' / 'inactive' |
| created_at | timestamptz | |

### `pois`
| Kolom | Tipe | Keterangan |
|---|---|---|
| poi_id | text (PK) | Kunci unik dari TikTok |
| name | text | |
| category | text | 'hotel' / 'fnb' / dst (fleksibel) |
| city | text | |
| area | text | |
| aov | numeric | nullable |
| is_undersupplied | boolean | nullable |
| priority_tag | text | nullable |
| status | text | salah satu dari 14+1 status |
| current_claim_id | bigint (FK) | nullable |
| source | text | 'freelancer' / 'internal' |
| source_campaign | text | nullable |
| latitude | numeric | nullable |
| longitude | numeric | nullable |
| full_address | text | nullable |
| created_at | timestamptz | |

### `claims`
| Kolom | Tipe | Keterangan |
|---|---|---|
| claim_id | bigint (PK) | |
| poi_id | text (FK) | |
| user_id | uuid (FK → profiles) | |
| claim_status | text | |
| pic_name | text | wajib saat submit |
| pic_position | text | opsional |
| wa_number | text | wajib saat submit |
| wa_validated_by_freelancer | boolean | default false |
| wa_validated_by_bd | boolean | default false |
| fail_reason | text | nullable |
| is_retryable | boolean | nullable |
| deal_type | text | 'buka_kamar' / 'voucher_makanan' / nullable |
| cooperation_result | text | 'declined' / 'agreed' / nullable |
| campaign_target_videos | int | nullable |
| campaign_uploaded_videos | int | default 0 |
| creator_visit_date | timestamptz | nullable |
| claimed_at | timestamptz | |
| submitted_at | timestamptz | nullable |
| validated_at | timestamptz | nullable |
| fixed_at | timestamptz | nullable |
| campaign_started_at | timestamptz | nullable |
| completed_at | timestamptz | nullable |
| last_activity_at | timestamptz | untuk auto-release |
| release_reason | text | nullable |

### `status_history` (append-only)
| Kolom | Tipe | Keterangan |
|---|---|---|
| history_id | bigint (PK) | |
| poi_id | text (FK) | |
| claim_id | bigint (FK) | |
| from_status | text | nullable |
| to_status | text | |
| changed_by | uuid (FK) | nullable (null = system) |
| changed_by_role | text | 'freelancer'/'internal'/'system' |
| note | text | nullable |
| created_at | timestamptz | default now() |

### `notes`
| Kolom | Tipe | Keterangan |
|---|---|---|
| note_id | bigint (PK) | |
| claim_id | bigint (FK) | |
| author_id | uuid (FK) | |
| phase | text | 'akuisisi'/'campaign' |
| is_internal_only | boolean | default false |
| note_text | text | |
| created_at | timestamptz | |

### `proof_files`
| Kolom | Tipe | Keterangan |
|---|---|---|
| file_id | bigint (PK) | |
| claim_id | bigint (FK) | |
| file_type | text | 'proof_chat'/'proof_visit' |
| file_url | text | link Supabase Storage |
| uploaded_at | timestamptz | |

---

## 7. Aturan Notes per Status

| Status | Notes | Sifat |
|---|---|---|
| available | tidak | — |
| in_progress | ya | opsional |
| gagal | ya | **wajib** (ketik bebas) |
| poi_mati | ya | **wajib** (ketik bebas) |
| semi_dealing | ya | opsional |
| submitted | ya | opsional (tapi wajib pic+wa+bukti) |
| validasi_nomor | tidak | — |
| nomor_invalid | ya | **wajib** (alasan) |
| fiksasi_kerjasama | ya | opsional |
| declined | ya | **wajib** (ketik bebas) |
| disetujui_diklaim | ya | **wajib** (detail deal) |
| koordinasi_kreator | ya | opsional |
| campaign_jalan | tidak | — |
| campaign_selesai | ya | opsional |

---

## 8. Halaman / Fitur yang Dibangun

### Untuk semua (auth)
- Halaman login (Google OAuth)
- Halaman isi nama panggilan (first login)
- Halaman "menunggu approval" (akun pending)

### Untuk Freelancer (mobile-first)
- **Pool POI** — daftar POI `available`, filter kategori/area, penanda prioritas (AOV/undersupplied), indikator slot claim (mis. 3/10). POI yang dikerjakan orang lain tampil terkunci.
- **Tugas Saya** — POI milik freelancer, tombol aksi sesuai status.
- **Input Kontak & Semi-Dealing** — form nama PIC (wajib), jabatan (opsional), WA (wajib).
- **Submit** — upload proof chat persetujuan + konfirmasi nomor valid.
- **Notifikasi** — daftar notif in-app.
- **Detail POI** — timeline riwayat status (audit trail) + notes (yang non-internal).

### Untuk Internal (desktop-friendly)
- **Approve Akun** — daftar akun `pending`, tombol approve/tolak.
- **Antrian Leads** — POI `submitted` menunggu follow up, tombol validasi/fiksasi.
- **Detail POI (internal view)** — semua data + notes internal + tombol aksi campaign.
- **Handle Campaign** — update `campaign_uploaded_videos`, koordinasi kreator, tandai selesai.
- **Sourcing F&B** — input POI F&B mandiri (source='internal').
- **Dashboard Funnel** — angka ringkasan + grafik funnel tiap tahap.
- **Rapor Kinerja Freelancer** — tabel performa (dari status_history).

---

## 9. Penyimpanan Gambar

- Bukti (proof chat / proof visit) di **Supabase Storage**.
- Database simpan **link** (`proof_files.file_url`), BUKAN base64.
- **Kompres gambar di sisi client sebelum upload** (~100-300 KB). Gunakan library kompres gambar browser.

---

## 10. Yang TIDAK Boleh Dilakukan AI

- JANGAN tambah status, tabel, atau field di luar spec ini.
- JANGAN buat fitur GPS/absen lokasi (visit tidak wajib, tanpa GPS).
- JANGAN buat filter penolakan kualitas internal (semua merchant yang mau diterima).
- JANGAN simpan gambar sebagai base64 di database.
- JANGAN buat sistem fee/pembayaran (fee di luar sistem, ditangani admin terpisah).
- JANGAN tambah role selain `freelancer` dan `internal`.
- JANGAN izinkan transisi status di luar daftar yang BOLEH.
- Kalau ragu atau ada yang ambigu → TANYA, jangan berasumsi.

---

## 11. Prioritas Build (MVP dulu)

Bangun bertahap sesuai `PROMPT_TAHAPAN.md`. Urutan besar:
1. Setup project + auth + role + approval akun
2. Database schema + RLS
3. Import data POI + Pool POI (lihat & claim)
4. Fase 1 freelancer (claim → semi-dealing → submit)
5. Fase 2 internal (validasi → fiksasi → campaign)
6. Audit trail + notes + notifikasi
7. Dashboard + rapor kinerja
8. Polish responsif + kompres gambar

---

*Spec ini turunan dari "Dokumen Acuan Sistem v2". Dokumen Acuan dipakai untuk memahami KONTEKS & alasan. Tapi untuk keputusan teknis saat coding, SPEC INI yang menang (lebih presisi & sudah disederhanakan). Bangun hanya apa yang tertulis di spec.*
