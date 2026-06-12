# Dokumen Acuan Sistem — Merchant Activation & Campaign Tracking
### HYPE Media Indonesia (TikTok GO Agency) — TNT Media
**Versi 2** — disesuaikan dengan arahan flow dari manajer (Icha Ayunda)

> Dokumen ini merangkum seluruh keputusan final untuk membangun sistem pelacakan akuisisi merchant (POI) dan campaign TikTok GO. Versi 2 menggantikan versi 1 dengan flow yang sudah disetujui manajer. Berfungsi sebagai acuan tunggal, baik untuk dibangun sendiri maupun diserahkan ke developer.

---

## 0. Perubahan Utama dari Versi 1

Ringkasan apa yang berubah agar tidak tertukar dengan rancangan lama:

| Hal | Versi 1 (lama) | Versi 2 (final, sesuai manajer) |
|---|---|---|
| Visit | Wajib + absen GPS + radius 200m | **Tidak wajib & tanpa GPS**. Cari kontak online dulu, visit kalau perlu |
| Status `Visited` | Ada (absen lokasi) | **Dihapus** |
| Filter kualitas internal | Ada (Verifikasi & Ditolak Internal) | **Dihapus** — semua merchant yang mau diterima |
| Peran | Freelance & Tim Internal | **Freelancer & Business Development (BD)** |
| Kategori POI | Hotel, Entire House, TTD | **Hotel & F&B** (fleksibel: TTD, Attraction, dll menyusul) |
| Dealing | Belum eksplisit | **Freelancer semi-dealing**, BD fiksasi (upselling) |
| Validasi nomor | Hanya di internal | **Dua kali**: freelancer (awal) + BD (follow up) |
| Bukti | SS WA biasa | **Proof chat yang menunjukkan persetujuan** kerjasama |
| Fee freelancer | — | **Tidak masuk sistem** (direkap admin terpisah) |

---

## 1. Ringkasan Sistem

Sistem ini mengelola alur dari **freelancer mengumpulkan kontak merchant** (online atau visit) hingga **campaign TikTok GO selesai** (kreator upload video). Sistem mengunci satu POI ke satu freelancer saat dikerjakan (mencegah rebutan), melacak setiap perubahan status secara permanen (audit trail), dan memisahkan dua fase: akuisisi (freelancer) dan campaign (BD).

**Tiga konsep kunci:**

| Sudut pandang | Istilah | Kegunaan |
|---|---|---|
| Bisnis | **Funnel** | Laporan konversi: berapa lolos tiap tahap |
| Operasional | **Pipeline** | POI ada di tahap mana, siapa pegang |
| Teknis | **State machine** | Aturan status: mana boleh pindah ke mana |

**Prinsip utama:** Semua update tercatat lengkap — apa yang berubah, siapa pelakunya, kapan. Tidak ada perubahan tanpa jejak (audit trail = tulang punggung sistem). Data boleh tidak lengkap di awal dan **diperbarui kapan saja** seiring jalan.

**Target:** 3.000 POI (Hotel & F&B) dari database yang sudah diberikan.

---

## 2. Aktor / Pengguna Sistem

| Peran | Tugas | Perangkat |
|---|---|---|
| **Freelancer** | Cari kontak merchant (online/visit), kumpulkan PIC + WA, semi-dealing, validasi nomor, report bukti | Mobile / tablet |
| **Business Development (BD)** | Follow up kontak, validasi nomor, fiksasi kerjasama (upselling), handle campaign, koordinasi kreator, sourcing F&B mandiri | Laptop / desktop |

**Catatan:**
- Contoh anggota BD: Amel & Hagi.
- Semua anggota BD punya wewenang sama (tidak ada sub-peran).
- Freelancer hanya bertugas di Fase 1; tugas selesai setelah menyerahkan kontak valid + bukti ke BD.
- **Kreator Hype** bukan pengguna sistem, tapi aktor di lapangan saat campaign (visit POI, bikin video). Dikoordinasikan oleh BD.
- **Fee freelancer (Rp10.000/POI, no fix cost) TIDAK masuk sistem** — direkap & dibayar oleh admin terpisah.

---

## 3. Dua Fase Kerja

### Fase 1 — Akuisisi (Freelancer)
Cari kontak merchant, semi-dealing, sampai kontak valid + bukti persetujuan diserahkan ke BD.

**Cara kerja freelancer:**
- Cari kontak **online dulu**; kalau tak dapat, **baru visit langsung** (visit tidak wajib, tanpa GPS).
- Kumpulkan nama PIC/marketing + nomor WA.
- **Semi-dealing**: ajak kerjasama + jelaskan TnC & flow barter untuk buka campaign.
- **Pastikan nomor valid** saat dihubungi.
- Sertakan bukti: proof of visit / **proof chat yang menunjukkan marketing setuju kerjasama**.

**Output Fase 1 → ke BD:** List POI (Hotel & F&B) + nomor marketing valid + proof visit/chat.

### Fase 2 — Campaign (BD)
Follow up hasil freelancer + sourcing F&B mandiri, fiksasi kerjasama (upselling), sampai campaign selesai.

**Cara kerja BD:**
- Follow up & **validasi ulang** nomor marketing.
- **Upselling**: naikkan dari semi-deal freelancer jadi deal fix, via calling/chat/meeting.
- Cocokkan dengan SS semi-dealing freelancer.
- Hasil akhir: Hotel → **buka kamar** untuk campaign; F&B → **barter voucher makanan**.
- **Koordinasi kreator** (atur tanggal/jam visit) saat campaign jalan.

**Dua jalur masuk ke pipeline:** (1) via Freelancer (Hotel & F&B), (2) via BD mandiri (F&B). Ditandai dengan field `source`.

---

## 4. Daftar Status Lengkap (State Machine)

### Fase 1 — Akuisisi (Freelancer)

| # | Status | Arti | Pelaku | Berakhir? |
|---|---|---|---|---|
| 1 | **Available** | POI di database, bebas diambil | sistem | — |
| 2 | **In Progress** | Sedang dicari kontaknya (online/visit) | freelancer | — |
| 3 | **Gagal** | Tak dapat kontak, bisa dicoba lagi → balik Available | freelancer | ya (balik pool) |
| 4 | **POI Mati** | Tutup/pindah/buntu permanen → hilang dari pool | freelancer | ya (permanen) |
| 5 | **Semi-Dealing** | Dapat kontak, sedang ajak kerjasama + jelaskan TnC | freelancer | — |
| 6 | **Submitted** | Kontak valid + SS persetujuan, diserahkan ke BD | freelancer → BD | — |

### Fase 2 — Campaign (BD)

| # | Status | Arti | Pelaku | Berakhir? |
|---|---|---|---|---|
| 7 | **Validasi Nomor** | BD cek nomor bisa dihubungi | BD | — |
| 8 | **Nomor Invalid** | Nomor tak bisa dihubungi → balik ke freelancer | BD | (balik fase 1) |
| 9 | **Fiksasi Kerjasama** | BD upselling via calling/chat/meeting | BD | — |
| 10 | **Declined** | Saat difiksasi, merchant tak jadi kerjasama | BD | ya |
| 11 | **Disetujui & Diklaim** | Merchant setuju, kerjasama fix | BD | — |
| 12 | **Koordinasi Kreator** | Atur tanggal/jam kreator visit | BD | — |
| 13 | **Campaign Jalan** | Kreator visit & upload video sesuai deal | BD | — |
| 14 | **Campaign Selesai** | Semua video tayang sesuai target | BD | ya (sukses) |

### Status Khusus

| Status | Arti | Catatan |
|---|---|---|
| **Repeat Campaign** | POI selesai di-reaktivasi BD untuk periode baru | **Tanpa freelancer** — hubungan sudah di BD. Tidak muncul di pool freelancer |

### Jenis "Berhenti" yang Dibedakan (untuk laporan)

| Status | Penyebab | Letak masalah |
|---|---|---|
| **Gagal / POI Mati** | Freelancer tak dapat kontak | Akses/lapangan |
| **Nomor Invalid** | Nomor tak bisa dihubungi BD | Kualitas data kontak |
| **Declined** | Merchant tak jadi saat fiksasi | Minat merchant |

> **Catatan penting:** Tidak ada lagi penolakan karena "kualitas POI" (filter internal dihapus). Semua merchant yang mau kerjasama diterima, karena perusahaan yang membutuhkan kerjasama.

---

## 5. Aturan Transisi Status (yang boleh & dilarang)

**Jalur utama (dibolehkan):**
- Available → In Progress (freelancer ambil)
- In Progress → Semi-Dealing (dapat kontak) → Submitted (SS persetujuan)
- Submitted → Validasi Nomor → Fiksasi Kerjasama → Disetujui & Diklaim → Koordinasi Kreator → Campaign Jalan → Campaign Selesai
- Campaign Selesai → Repeat Campaign (reaktivasi BD)

**Cabang (dibolehkan):**
- In Progress → Gagal → Available (balik pool)
- In Progress → POI Mati (permanen)
- Validasi Nomor → Nomor Invalid → balik ke freelancer (fase 1)
- Fiksasi Kerjasama → Declined (merchant tak jadi)

**Dilarang (contoh):**
- In Progress → Campaign Selesai (tak boleh loncat tahap)
- Disetujui & Diklaim → Available (sudah fix, tak boleh mundur ke pool)

---

## 6. Data Kontak yang Dikumpulkan per POI

| Data | Wajib? | Catatan |
|---|---|---|
| **Nama PIC / marketing** | ✅ wajib | Misal: Bu Sari |
| **Nomor WA** | ✅ wajib | Harus divalidasi (bisa dihubungi) |
| Jabatan/posisi PIC | opsional | Misal: Marketing Manager — berguna buat BD |

- Boleh **satu kontak utama** per POI (cukup untuk saat ini).
- Data kontak **bisa diperbarui kapan saja** — BD boleh update saat follow up kalau ada info baru/koreksi.

---

## 7. Aturan Notes (Catatan) per Status

Notes muncul hanya di status yang relevan. Tiga tingkat: wajib, opsional, tanpa.

| # | Status | Notes | Sifat | Syarat tambahan |
|---|---|---|---|---|
| 1 | Available | ❌ | — | — |
| 2 | In Progress | ✅ | opsional | — |
| 3 | **Gagal** | ✅ | **wajib** | ketik bebas (alasan) |
| 4 | **POI Mati** | ✅ | **wajib** | ketik bebas (alasan) |
| 5 | Semi-Dealing | ✅ | opsional | — |
| 6 | **Submitted** | ✅ | opsional (notes) | **WAJIB: nama PIC + WA valid + SS proof persetujuan** |
| 7 | Validasi Nomor | ❌ | — | — |
| 8 | **Nomor Invalid** | ✅ | **wajib** | alasan (mis. nomor mati/salah) |
| 9 | Fiksasi Kerjasama | ✅ | opsional | — |
| 10 | **Declined** | ✅ | **wajib** | ketik bebas (alasan) |
| 11 | Disetujui & Diklaim | ✅ | **wajib** | detail deal (buka kamar / voucher, jumlah kreator, target video) |
| 12 | Koordinasi Kreator | ✅ | opsional | tanggal/jam visit kreator |
| 13 | Campaign Jalan | ❌ | — | — |
| 14 | Campaign Selesai | ✅ | opsional | — |

**Alasan gagal/declined:** ketik bebas dulu. Nanti setelah pola dianalisis, baru dibuatkan dropdown kategori.

**Notes internal vs publik:** BD bisa menandai catatan "khusus internal" yang tidak terlihat freelancer. Freelancer hanya melihat notes yang relevan untuk tugasnya.

**Notes menumpuk, tidak menimpa:** semua catatan tersimpan di timeline riwayat POI, urut waktu, dengan nama penulisnya.

---

## 8. Fitur & Aturan Bisnis

### 8.1 Lock saat Diambil (Claim)
POI yang sedang dikerjakan freelancer terkunci dari freelancer lain. **Wajib database transaction** (cek status = Available, baru update, dalam satu operasi atomik) agar saat dua orang klik bersamaan, hanya satu yang menang.

### 8.2 Claim Limit
- Maksimal **10 POI aktif** per freelancer.
- Kalau sudah 10, harus selesaikan/lepas salah satu dulu baru ambil baru.

### 8.3 Validasi Nomor (DUA titik)
- **Freelancer** pastikan nomor valid saat input (sebelum submit).
- **BD** validasi ulang saat follow up (status `Validasi Nomor`).
- Kalau invalid di sisi BD → status `Nomor Invalid`, balik ke freelancer untuk diperbaiki.

### 8.4 Bukti Submitted
- Wajib: nama PIC + nomor WA valid + **proof chat yang menunjukkan marketing SETUJU kerjasama** (bukan sekadar chat dapat nomor).
- Gambar bukti = SS WA / proof visit. Disimpan sebagai link di storage (lihat bagian 11).

### 8.5 Auto-Release
- POI **7 hari tanpa update sejak aktivitas terakhir** → otomatis di-release ke Available.
- Slot claim freelancer kembali kosong.
- Tercatat di rapor kinerja + riwayat ("auto-released oleh sistem, aktivitas terakhir tgl X oleh Y").
- Dihitung dari aktivitas terakhir karena dealing via WA bisa butuh beberapa hari.

### 8.6 Notifikasi
- **In-app saja** (menu Notifikasi). Tidak pakai WA API.
- Muncul saat ada perubahan butuh perhatian: lead di-approve/fiksasi, POI akan auto-release, nomor invalid balik ke freelancer, slot penuh, dll.
- Ikon warna: hijau (kabar baik), kuning (peringatan), merah (perlu tindakan), biru (info).

### 8.7 Koordinasi Kreator
- Terjadi **saat campaign jalan** (Fase 2), diatur langsung oleh BD/tim internal.
- BD atur tanggal/jam kreator visit POI, sesuai dealing.

### 8.8 Reaktivasi POI (Repeat Campaign)
- POI Campaign Selesai bisa di-approach lagi periode baru.
- **Dibuka oleh BD**, ditangani BD langsung **tanpa freelancer**.
- Tidak muncul di pool freelancer.

### 8.9 Kategori POI Fleksibel
- Kategori awal: **Hotel & F&B**.
- Sistem harus mudah menambah kategori baru: **Things To Do, Attraction**, dan kategori merchant TikTok GO lain.
- `poi_type`/`category` dibuat sebagai daftar yang bisa ditambah, bukan tetap.

### 8.10 Dedup Data POI saat Impor
- Gabung database pakai **`poi_id` sebagai kunci unik** (bukan nama).
- Tolak duplikat. Data dirapikan dulu sebelum impor.

---

## 9. Audit Trail — Pelacakan Semua Kejadian

Setiap perubahan = 1 baris permanen (append-only, tak bisa diedit/dihapus). Yang dicatat:

| Kejadian | Pelaku | Tercatat |
|---|---|---|
| Ambil POI | freelancer | siapa, kapan |
| Cari kontak / semi-dealing | freelancer | siapa, kapan |
| Submit hasil | freelancer | siapa, kapan, kontak + SS |
| Validasi nomor | BD | siapa, kapan, hasil |
| Fiksasi kerjasama | BD | siapa, kapan, hasil |
| Update campaign | BD | siapa, kapan, progress |
| Lepas POI manual | freelancer/BD | siapa, kapan, alasan |
| **Auto-release 7 hari** | **sistem** | kapan, dari aktivitas terakhir tgl berapa |
| Reaktivasi POI selesai | BD | siapa, kapan |
| Update data kontak | siapa saja | siapa, kapan, perubahan |
| Tambah catatan | siapa saja | siapa, kapan, isi |

**Manfaat:** telusur mundur kalau ada masalah — "kontak salah?" → siapa input; "kenapa declined?" → siapa fiksasi + alasan; "sudah dicoba berapa kali?" → semua riwayat sebelumnya.

---

## 10. Data Model (Struktur Tabel)

### Tabel `pois` — master list POI
| Kolom | Tipe | Keterangan |
|---|---|---|
| `poi_id` (PK) | string | Kunci unik dari TikTok |
| `name` | string | Nama merchant/POI |
| `category` | enum/ref | Hotel / F&B / (TTD, Attraction, dst — bisa ditambah) |
| `city` | string | Kota |
| `area` | string | Wilayah |
| `aov` | number | Untuk prioritas (nullable) |
| `is_undersupplied` | bool | Penanda prioritas (nullable) |
| `priority_tag` | string | Dari kolom Priority/Direction (nullable) |
| `status` | enum | 14 status (lihat bagian 4) |
| `current_claim_id` (FK) | int | Pointer ke claim aktif (null kalau Available) |
| `source` | enum | freelancer / bd (jalur masuk) |
| `source_campaign` | string | Jejak asal data |
| `latitude` | number | Opsional, kalau ada (nullable) |
| `longitude` | number | Opsional (nullable) |
| `full_address` | string | Opsional (nullable) |

### Tabel `users` — freelancer & BD
| Kolom | Tipe | Keterangan |
|---|---|---|
| `user_id` (PK) | int | |
| `name` | string | |
| `phone` | string | |
| `role` | enum | freelancer / bd |
| `status` | enum | active / inactive |

### Tabel `claims` — jantung sistem (1 baris = 1 kali POI diambil)
| Kolom | Tipe | Keterangan |
|---|---|---|
| `claim_id` (PK) | int | |
| `poi_id` (FK) | string | |
| `user_id` (FK) | int | Yang ambil (freelancer/BD) |
| `claim_status` | enum | Status proses ini |
| `pic_name` | string | **Nama PIC/marketing (wajib)** |
| `pic_position` | string | Jabatan PIC (opsional) |
| `wa_number` | string | Nomor WA (wajib, divalidasi) |
| `wa_validated_by_freelancer` | bool | Freelancer sudah cek valid |
| `wa_validated_by_bd` | bool | BD sudah validasi ulang |
| `fail_reason` | text | Alasan gagal (ketik bebas) |
| `is_retryable` | bool | Bisa dicoba lagi (Gagal) atau mati (POI Mati) |
| `deal_type` | enum | buka_kamar (Hotel) / voucher_makanan (F&B) |
| `cooperation_result` | enum | declined / agreed |
| `campaign_target_videos` | int | Target jumlah video |
| `campaign_uploaded_videos` | int | Video yang sudah tayang |
| `creator_visit_date` | timestamp | Jadwal kreator visit (koordinasi) |
| `claimed_at` | timestamp | |
| `submitted_at` | timestamp | |
| `validated_at` | timestamp | |
| `fixed_at` | timestamp | Kapan kerjasama difiksasi |
| `campaign_started_at` | timestamp | |
| `completed_at` | timestamp | |
| `last_activity_at` | timestamp | Untuk hitung auto-release 7 hari |
| `release_reason` | string | Alasan kalau dilepas |

### Tabel `status_history` — audit trail (append-only)
| Kolom | Tipe | Keterangan |
|---|---|---|
| `history_id` (PK) | int | |
| `poi_id` (FK) | string | |
| `claim_id` (FK) | int | |
| `from_status` | enum | Status sebelumnya (null kalau pertama) |
| `to_status` | enum | Status baru |
| `changed_by` (FK) | int | Siapa (null kalau sistem) |
| `changed_by_role` | enum | freelancer / bd / system |
| `note` | text | Catatan saat perubahan (opsional) |
| `created_at` | timestamp | Otomatis |

### Tabel `notes` — catatan menumpuk
| Kolom | Tipe | Keterangan |
|---|---|---|
| `note_id` (PK) | int | |
| `claim_id` (FK) | int | |
| `author_id` (FK) | int | |
| `phase` | enum | akuisisi / campaign |
| `is_internal_only` | bool | Tersembunyi dari freelancer atau tidak |
| `note_text` | text | |
| `created_at` | timestamp | |

### Tabel `proof_files` — bukti SS / proof visit
| Kolom | Tipe | Keterangan |
|---|---|---|
| `file_id` (PK) | int | |
| `claim_id` (FK) | int | |
| `file_type` | enum | proof_chat / proof_visit |
| `file_url` | string | Link ke storage (bukan base64 di DB) |
| `uploaded_at` | timestamp | |

### Tabel `contact_history` — riwayat update kontak (opsional, untuk lacak perubahan)
| Kolom | Tipe | Keterangan |
|---|---|---|
| `contact_id` (PK) | int | |
| `poi_id` (FK) | string | |
| `pic_name` | string | |
| `wa_number` | string | |
| `updated_by` (FK) | int | |
| `updated_at` | timestamp | |

---

## 11. Penyimpanan Gambar (Bukti)

- **JANGAN simpan base64 di database** — bikin DB cepat penuh.
- **Yang benar:** gambar di storage, database simpan **link/URL** saja.
- base64 hanya boleh sebagai format saat transit (mengirim), di tujuan jadi file gambar lagi — ini normal.
- Bukti = SS WA / proof chat / proof visit. **Kompres sebelum upload** (~100-300 KB).
- **Status pilihan storage:** masih diriset TNT (opsi: Supabase Storage / Cloudflare R2 / Google Drive 5 TB). Yang penting sistem rapi dulu; storage diputuskan belakangan.

---

## 12. Tampilan / UI (Layout)

### Prinsip Responsif
Satu desain menyesuaikan layar: HP (freelancer, 1 kolom + menu bawah), tablet (2 kolom), desktop (BD, sidebar + banyak kolom).

### Layar Sisi Freelancer (mobile/tablet)
1. **Pool POI** — daftar POI bisa diambil, filter kategori/area + penanda prioritas. Slot claim (mis. 3/10). POI dikerjakan orang lain tampil redup + terkunci. Menu bawah: Pool, Tugas saya, Notif, Profil.
2. **Tugas saya** — POI sedang dikerjakan, tombol aksi sesuai status (In Progress → "Input kontak"; Semi-Dealing → "Submit"; dst).
3. **Input kontak & semi-dealing** — form: nama PIC (wajib), jabatan (opsional), nomor WA (wajib).
4. **Submit hasil** — upload proof chat persetujuan + proof visit + konfirmasi nomor valid.
5. **Notifikasi** — pemberitahuan dengan ikon warna.
6. **Detail POI / Timeline** — riwayat lengkap perubahan status.

### Layar Sisi BD (desktop)
1. **Antrian leads** — tabel POI dari freelancer menunggu follow up: hotel/merchant, freelancer, status bukti, tombol validasi/fiksasi. Sidebar navigasi.
2. **Dashboard funnel (Laporan)** — angka ringkasan + grafik funnel tiap tahap (kelihatan di mana "bocor" terbesar).
3. **Rapor kinerja freelancer** — visit/kontak, submitted, gagal, auto-release, skor per freelancer (otomatis dari audit trail).
4. **Handle campaign** — update progress video kreator + koordinasi jadwal sampai Campaign Selesai.
5. **Sourcing F&B mandiri** — BD input POI F&B sendiri (jalur masuk kedua).

---

## 13. Data Sumber (File Excel POI)

- Database POI digabung pakai **`poi_id` sebagai kunci unik** (bukan nama, karena nama sering beda penulisan).
- Banyak duplikat antar-sheet → wajib dedup saat impor.
- File tidak punya alamat lengkap (hanya area kasar) — boleh dilengkapi seiring jalan, opsional.
- Kolom bonus (AOV, undersupplied, Priority) dipakai untuk **mengurutkan prioritas** POI.
- Kategori awal yang diproses: Hotel & F&B.

---

## 14. Fitur yang Ditunda

| Fitur | Status | Catatan |
|---|---|---|
| Export ke Excel/Sheets | Ditunda | Fungsional dulu |
| Dropdown kategori alasan gagal/declined | Menyusul | Setelah pola dianalisis dari ketik-bebas |
| Notifikasi via WA | Tidak (saat ini) | Cukup in-app |
| Filter lokasi terdekat / GPS | Tidak dipakai | Visit tidak wajib, tanpa GPS |
| Rekap fee freelancer | Di luar sistem | Ditangani admin terpisah |
| Multi-kontak per POI | Menyusul | Saat ini cukup 1 kontak utama |

---

## 15. Ringkasan Keputusan Final (Checklist)

- [x] 2 peran: Freelancer & Business Development (BD)
- [x] 14 status + 1 khusus (Repeat Campaign)
- [x] 2 fase: Akuisisi (freelancer) & Campaign (BD)
- [x] Visit TIDAK wajib, cari online dulu, tanpa GPS
- [x] Tidak ada filter penolakan kualitas internal — semua merchant yang mau diterima
- [x] Freelancer semi-dealing → BD fiksasi (upselling)
- [x] Validasi nomor 2x (freelancer + BD)
- [x] Bukti Submitted = nama PIC + WA valid + SS proof PERSETUJUAN
- [x] Data kontak: nama + WA wajib, jabatan opsional, bisa diperbarui kapan saja
- [x] Kategori POI fleksibel (Hotel, F&B, + TTD/Attraction menyusul)
- [x] Dua jalur masuk: via freelancer & via BD mandiri (F&B)
- [x] Hasil deal: Hotel buka kamar / F&B voucher makanan
- [x] Koordinasi kreator saat campaign jalan (oleh BD)
- [x] Claim limit 10 POI per freelancer
- [x] Auto-release 7 hari sejak aktivitas terakhir → balik Available + rapor kinerja
- [x] Notifikasi in-app saja
- [x] Notes: 3 tingkat (wajib/opsional/tanpa), alasan ketik bebas dulu, ada notes internal
- [x] Audit trail append-only — semua tercatat dengan pelaku & waktu
- [x] Gambar di storage, link di DB, dikompres
- [x] Dedup POI pakai `poi_id` saat impor
- [x] Reaktivasi POI selesai oleh BD tanpa freelancer
- [x] Dashboard funnel + rapor kinerja freelancer
- [x] UI responsif (HP/tablet/desktop)
- [x] Fee Rp10.000/POI di luar sistem (rekap admin terpisah)
- [x] Target 3.000 POI (Hotel & F&B)

---

*Dokumen ini adalah acuan hidup — dapat diperbarui seiring keputusan baru. Versi 2, disesuaikan dengan arahan flow manajer. Untuk pertanyaan teknis implementasi, gunakan dokumen ini sebagai spesifikasi dasar.*
