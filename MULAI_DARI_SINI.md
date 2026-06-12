# MULAI DARI SINI — Panduan untuk AI (Claude Code)
### Sistem Merchant Activation & Campaign Tracking — HYPE Media Indonesia

> **AI: baca file ini PERTAMA sebelum apa pun.** File ini menjelaskan cara membaca semua dokumen lain dan urutan kerjanya.

---

## Apa yang sedang kita bangun

Web app untuk melacak alur kerja dari **freelancer mengumpulkan kontak merchant** (Hotel & F&B) hingga **campaign TikTok GO selesai**. Dua jenis pengguna: Freelancer (cari kontak) dan Internal (follow up + handle campaign).

---

## Dokumen dalam project ini & cara membacanya

Ada 3 dokumen lain. Masing-masing punya peran berbeda. **Patuhi urutan prioritas ini:**

| Dokumen | Perannya | Kapan dipakai |
|---|---|---|
| **SPEC_TEKNIS.md** | "APA yang dibangun" — skema database, status, aturan, tech stack | **PRIORITAS TERTINGGI saat coding.** Ini sumber kebenaran teknis. |
| **PROMPT_TAHAPAN.md** | "URUTAN membangun" — 11 tahap, satu per satu | Panduan langkah. Kerjakan sesuai urutannya. |
| **Sistem_POI_HYPE_Dokumen_Acuan_v2.md** | "KENAPA" — konteks bisnis & alasan keputusan | Referensi konteks saja. Untuk paham gambaran besar. |

### Aturan prioritas saat ada perbedaan
- Untuk **keputusan teknis** (kolom, status, logika): **SPEC_TEKNIS.md yang menang.**
- Dokumen Acuan v2 dipakai untuk **memahami alasan**, BUKAN untuk diterjemahkan langsung jadi kode.
- Kalau Dokumen Acuan menyebut sesuatu yang tidak ada di Spec Teknis → **ikuti Spec Teknis** (spec sudah disederhanakan dari acuan).

---

## Aturan kerja KETAT (wajib dipatuhi)

1. **Jangan halu.** Bangun HANYA yang ada di SPEC_TEKNIS.md. Jangan tambah fitur, status, tabel, atau field yang tidak tertulis.
2. **Jangan berasumsi.** Kalau ada yang ambigu atau tidak tertulis, TANYA dulu — jangan tebak.
3. **Satu tahap dalam satu waktu.** Ikuti PROMPT_TAHAPAN.md. Jangan loncat ke tahap berikutnya sebelum diminta.
4. **Berhenti di tiap checkpoint.** Setelah selesai satu tahap, berhenti dan tunggu konfirmasi.
5. **Hormati larangan.** Lihat SPEC_TEKNIS.md bagian 10 "Yang TIDAK Boleh Dilakukan AI".

---

## Tech Stack (WAJIB)

Next.js (App Router) + TypeScript + Supabase (Postgres + Auth Google + Storage) + Tailwind CSS + Vercel. Semua tier gratis.

---

## Cara memulai

1. Baca SPEC_TEKNIS.md sepenuhnya — pahami skema, status, aturan.
2. Baca PROMPT_TAHAPAN.md — pahami urutan 11 tahap.
3. Lihat Dokumen Acuan v2 hanya kalau butuh konteks "kenapa".
4. Tunggu instruksi memulai TAHAP 1.

---

## Ringkasan yang TIDAK boleh dibangun (pengingat cepat)

- ❌ GPS / absen lokasi (visit tidak wajib, tanpa GPS)
- ❌ Filter penolakan kualitas internal (semua merchant yang mau diterima)
- ❌ Sistem fee/pembayaran (fee di luar sistem)
- ❌ Role selain `freelancer` dan `internal`
- ❌ Gambar sebagai base64 di database (pakai link Storage)
- ❌ Transisi status di luar daftar yang BOLEH di spec

---

*Setelah membaca file ini, konfirmasi bahwa kamu paham, lalu tunggu instruksi TAHAP 1 dari PROMPT_TAHAPAN.md.*
