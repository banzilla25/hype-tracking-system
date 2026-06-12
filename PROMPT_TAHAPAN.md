# PROMPT TAHAPAN — Build Sistem dengan Claude Code
### HYPE Media Indonesia — panduan prompt langkah demi langkah

> **Cara pakai dokumen ini:**
> - Kerjakan SATU tahap dalam satu waktu. Jangan loncat.
> - Copy-paste prompt tiap tahap ke Claude Code persis seperti tertulis.
> - Di akhir tiap tahap, ada **checkpoint** — uji dulu sebelum lanjut.
> - Selalu mulai sesi Claude Code dengan memuat `SPEC_TEKNIS.md` sebagai konteks.
> - Kalau AI mulai menambah hal yang tidak diminta, hentikan dan ingatkan: "Ikuti SPEC_TEKNIS.md, jangan tambah fitur di luar itu."

---

## Prompt Pembuka (WAJIB di awal setiap sesi)

```
Kamu akan membantu membangun sistem web app sesuai SPEC_TEKNIS.md yang ada di project ini.

ATURAN KETAT:
1. Baca SPEC_TEKNIS.md sebagai sumber kebenaran tunggal.
2. JANGAN menambah fitur, status, tabel, atau field yang tidak ada di spec.
3. JANGAN berasumsi. Kalau ada yang ambigu, tanya dulu.
4. Kerjakan HANYA tahap yang aku minta. Jangan loncat ke tahap berikutnya.
5. Setelah selesai satu tahap, berhenti dan tunggu aku konfirmasi sebelum lanjut.
6. Tech stack WAJIB: Next.js (App Router) + TypeScript + Supabase + Tailwind + Vercel.

Konfirmasi kamu paham aturan ini, lalu tunggu instruksi tahap pertama.
```

---

## TAHAP 1 — Setup Project & Struktur Dasar

```
TAHAP 1: Setup project.

Buat project Next.js baru (App Router + TypeScript) dengan Tailwind CSS.
Setup koneksi ke Supabase (client + server helper).
Buat struktur folder yang rapi: components, lib, app routes.
Buat file .env.example dengan variabel yang dibutuhkan (Supabase URL, anon key).
Jangan buat fitur apa pun dulu — hanya kerangka project yang jalan.

Di akhir, kasih instruksi cara aku setup Supabase project dan isi .env.
```

**Checkpoint:** Project jalan di `localhost:3000`, halaman default tampil, koneksi Supabase siap.

---

## TAHAP 2 — Database Schema & RLS

```
TAHAP 2: Database schema.

Buat SQL migration untuk SEMUA tabel di SPEC_TEKNIS.md bagian 6:
profiles, pois, claims, status_history, notes, proof_files.

Ikuti persis kolom & tipe data di spec. Jangan tambah/kurang kolom.
Buat juga Row Level Security (RLS) dasar:
- profiles: user hanya bisa baca/update profilnya sendiri; internal bisa baca semua.
- pois & claims: freelancer baca POI miliknya + available; internal baca semua.

Tulis SQL-nya dalam file migration yang bisa aku jalankan di Supabase SQL editor.
Jelaskan cara menjalankannya.
```

**Checkpoint:** Semua tabel muncul di Supabase, RLS aktif, bisa insert data tes manual.

---

## TAHAP 3 — Auth (Google Login) + Role + Approval Akun

```
TAHAP 3: Autentikasi & role.

Implementasikan sesuai SPEC_TEKNIS.md bagian 3:
1. Login pakai Google OAuth (Supabase Auth).
2. First login: user isi nama panggilan, simpan ke profiles, role default 'freelancer', account_status 'pending'.
3. Halaman "menunggu approval" untuk akun pending.
4. Menu (khusus internal) untuk approve akun pending → ubah account_status jadi 'active'.
5. Proteksi route: user pending tidak bisa akses fitur; freelancer vs internal lihat menu berbeda.

Catatan: aku akan set 1 akun pertama jadi 'internal' manual lewat Supabase. Beri tahu caranya.
Jangan buat role lain selain freelancer & internal.
```

**Checkpoint:** Bisa login Google, akun baru pending, internal bisa approve, role kedeteksi.

---

## TAHAP 4 — Import Data POI & Pool POI

```
TAHAP 4: Pool POI.

1. Buat cara import data POI dari CSV ke tabel pois (dedup by poi_id — tolak duplikat).
   Beri aku format CSV yang dibutuhkan.
2. Buat halaman "Pool POI" (mobile-first) yang menampilkan POI berstatus 'available':
   - Filter kategori (hotel/fnb) & area.
   - Penanda prioritas kalau ada (aov/is_undersupplied).
   - Indikator slot claim freelancer (mis. "3/10 terpakai").
   - POI yang sedang dikerjakan orang lain tampil terkunci (tidak bisa diambil).
3. Tombol "Claim POI" — pakai transaksi atomik (cek available dulu). Hormati limit 10.

Ikuti aturan lock & claim limit di SPEC_TEKNIS.md bagian 5.
```

**Checkpoint:** Data POI ter-import, pool tampil, claim berfungsi + terkunci untuk orang lain + limit 10 jalan.

---

## TAHAP 5 — Fase 1 Freelancer (Semi-Dealing → Submit)

```
TAHAP 5: Alur freelancer Fase 1.

Implementasikan transisi status Fase 1 sesuai SPEC_TEKNIS.md bagian 4 & 5:
available → in_progress → semi_dealing → submitted
(plus cabang: in_progress → gagal / poi_mati)

1. Halaman "Tugas Saya" — POI milik freelancer, tombol aksi sesuai status.
2. Form input kontak: pic_name (wajib), pic_position (opsional), wa_number (wajib).
3. Status semi_dealing → submit: WAJIB pic_name + wa_number + minimal 1 proof_file (upload gambar).
4. Cabang gagal/poi_mati: WAJIB isi fail_reason (ketik bebas). gagal → balik available.
5. Validasi transisi di backend: tolak transisi di luar aturan BOLEH.
6. Setiap perubahan status → tulis ke status_history.

Belum perlu kompres gambar dulu (nanti di tahap polish). Pakai upload biasa ke Supabase Storage.
```

**Checkpoint:** Freelancer bisa jalankan alur penuh sampai submit, status & history tercatat, transisi ilegal ditolak.

---

## TAHAP 6 — Fase 2 Internal (Validasi → Fiksasi → Campaign)

```
TAHAP 6: Alur internal Fase 2.

Implementasikan transisi status Fase 2 sesuai spec:
submitted → validasi_nomor → fiksasi_kerjasama → disetujui_diklaim →
koordinasi_kreator → campaign_jalan → campaign_selesai
(plus cabang: validasi_nomor → nomor_invalid → in_progress; fiksasi → declined)

1. Halaman "Antrian Leads" — POI submitted menunggu follow up.
2. Validasi nomor: internal tandai wa_validated_by_bd. Kalau invalid → nomor_invalid → balik freelancer.
3. Fiksasi: tombol setuju (→ disetujui_diklaim, isi deal_type & target video) atau declined (wajib alasan).
4. Handle campaign: update campaign_uploaded_videos, set creator_visit_date, tandai campaign_selesai.
5. Sourcing F&B mandiri: internal bisa input POI baru (source='internal') langsung ke pipeline.
6. Semua perubahan → status_history.

Ingat: TIDAK ADA penolakan kualitas internal. Semua yang mau diterima.
```

**Checkpoint:** Internal bisa jalankan alur penuh dari validasi sampai campaign selesai, semua cabang jalan.

---

## TAHAP 7 — Notes, Audit Trail View, Notifikasi

```
TAHAP 7: Notes, riwayat, notifikasi.

1. Sistem notes (tabel notes): input notes muncul sesuai aturan per status di SPEC_TEKNIS.md bagian 7.
   - Yang wajib: gagal, poi_mati, nomor_invalid, declined, disetujui_diklaim.
   - Internal bisa tandai is_internal_only (tidak terlihat freelancer).
2. Halaman Detail POI: tampilkan timeline status_history (dari→ke, siapa, kapan, note) + notes.
   Freelancer tidak melihat notes internal.
3. Notifikasi in-app (menu Notifikasi): buat notif saat ada perubahan penting
   (lead difiksasi, nomor_invalid balik ke freelancer, POI akan auto-release, slot penuh).
   Pakai ikon warna sesuai konteks.
```

**Checkpoint:** Notes muncul di tempat yang benar, timeline lengkap, notif tampil, notes internal tersembunyi dari freelancer.

---

## TAHAP 8 — Auto-Release

```
TAHAP 8: Auto-release.

Implementasikan aturan auto-release di SPEC_TEKNIS.md bagian 5 nomor 5:
- POI dengan last_activity_at lebih dari 7 hari DAN status masih aktif (in_progress/semi_dealing)
  → otomatis balik available, current_claim_id null, slot freelancer kosong.
- Catat di status_history dengan changed_by_role = 'system'.

Untuk MVP, implementasikan sebagai pengecekan saat load pool/tugas (cek-on-load).
Pastikan last_activity_at terupdate setiap ada aktivitas pada claim.
```

**Checkpoint:** POI yang nganggur 7+ hari otomatis balik ke pool, tercatat sebagai aksi system.

---

## TAHAP 9 — Dashboard Funnel & Rapor Kinerja

```
TAHAP 9: Laporan.

1. Dashboard Funnel (untuk internal):
   - Angka ringkasan: total POI dikunjungi, kontak didapat (submitted), campaign selesai, konversi total.
   - Grafik funnel tiap tahap (berapa POI di tiap level).
2. Rapor Kinerja Freelancer:
   - Tabel per freelancer: jumlah diambil, submitted, gagal, auto-release, skor sederhana.
   - Ambil data dari status_history (jangan input manual).

Pakai library chart sederhana. Tampilan desktop-friendly.
```

**Checkpoint:** Dashboard tampil angka & grafik akurat dari data nyata, rapor kinerja terisi otomatis.

---

## TAHAP 10 — Polish: Responsif & Kompres Gambar

```
TAHAP 10: Polish akhir.

1. Pastikan SEMUA halaman responsif: rapi di HP (freelancer), tablet, dan desktop (internal).
2. Tambahkan kompres gambar di sisi client sebelum upload ke Supabase Storage
   (target 100-300 KB per gambar). Pakai library kompres browser.
3. Perbaiki UX kecil: loading state, pesan error yang jelas, konfirmasi sebelum aksi penting.
4. Pastikan tidak ada transisi status ilegal yang lolos.

Jangan tambah fitur baru. Hanya perbaiki & rapikan yang sudah ada.
```

**Checkpoint:** Semua rapi di semua ukuran layar, gambar terkompres, siap deploy.

---

## TAHAP 11 — Deploy ke Vercel

```
TAHAP 11: Deploy.

Bantu aku deploy ke Vercel:
- Sambungkan repo ke Vercel.
- Set environment variables (Supabase URL, keys).
- Pastikan Google OAuth redirect URL sudah benar untuk domain produksi.
- Beri checklist hal yang harus dicek setelah deploy.
```

**Checkpoint:** App live di domain Vercel, login Google jalan di produksi, semua fitur berfungsi.

---

## Pengingat Anti-Halu (gunakan kapan saja AI mulai ngelantur)

```
Berhenti. Kamu menambah/mengubah sesuatu yang tidak ada di SPEC_TEKNIS.md.
Tinjau ulang spec, hapus yang tidak diminta, dan kerjakan HANYA tahap yang sedang kita kerjakan.
Kalau menurutmu ada yang perlu ditambah, usulkan dulu — jangan langsung implementasi.
```

---

## Checklist Verifikasi Sebelum Anggap Selesai

- [ ] Login Google + role + approval akun jalan
- [ ] 14+1 status lengkap, transisi ilegal ditolak
- [ ] Lock claim & limit 10 berfungsi
- [ ] Validasi nomor 2x
- [ ] Submit wajib pic+wa+bukti
- [ ] Notes per status sesuai aturan (wajib/opsional/tanpa)
- [ ] Notes internal tersembunyi dari freelancer
- [ ] Audit trail lengkap di tiap perubahan
- [ ] Auto-release 7 hari jalan
- [ ] Dashboard funnel + rapor kinerja akurat
- [ ] Responsif HP/tablet/desktop
- [ ] Gambar terkompres, disimpan sebagai link (bukan base64)
- [ ] Tidak ada GPS, tidak ada filter kualitas internal, tidak ada sistem fee
- [ ] Kategori POI fleksibel (hotel/fnb + bisa tambah)

---

*Dokumen ini pasangan dari SPEC_TEKNIS.md. Spec = "apa yang dibangun", dokumen ini = "urutan membangunnya". Keduanya turunan dari Dokumen Acuan Sistem v2.*
