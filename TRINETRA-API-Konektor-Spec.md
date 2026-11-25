# TRINETRA API — Spesifikasi untuk Agentic Builder

> **Tujuan dokumen ini:** Brief lengkap untuk agentic / AI coding agent agar bisa **membangun dan menganalisis API TRINETRA** yang memakai konektor Muse (Facebook, Threads, Instagram) sebagai sumber penarikan data.
>
> Dokumen ini dilempar langsung ke agentic. Agentic tidak perlu bertanya ulang soal konteks — semua konteks, akun, perintah, dan skema sudah ada di sini.
>
> **Bahasa kerja:** Indonesia. **Zona waktu:** Asia/Jakarta (WIB, UTC+7).
> **Tanggal spec:** 2026-11-25

---

## 1. Ringkasan Eksekutif

### 1.1 Apa itu TRINETRA?
TRINETRA adalah **Public Discourse Intelligence** dashboard milik user, dihosting di:

- **URL:** https://media.antiquetech.web.id/
- **Nama workspace:** PulseScope Intelligence Hub
- **Akun operator:** Operator TRINETRA
- **Akses:** Login-gated, halaman awal "Akses Terbatas | TRINETRA"

Menu yang sudah ada (hasil inspeksi 2026-11-24, read-only, tidak ada perubahan dibuat):
- Ruang Intelijen
- Radar Isu Hangat
- Radar Buzzer & Bot
- Eksplorasi Sebutan
- Program Prioritas
- Sinyal & Peringatan
- Konektor Sumber Data

### 1.2 Kondisi data saat ini
- **Briefing eksekutif:** 17 Program Prioritas Nasional, status Stabil Kondusif
- **Volume contoh (24 Nov 2026, 00.00–09.00 WIB):** 4.678 mention
- **Total mention contoh:** 21.880 mention, turun 4,1% dari periode sebelumnya
- **Sentimen contoh:** 78% Kondusif
- **Telemetri:** 99,8%
- **Sumber saat ini:** Media Berita RSS 86%, YouTube Publik 14%
- **Topik terpanas contoh:** Koperasi Desa/Kelurahan Merah Putih 95,5/100, Pengunduran Diri Wapres Gibran, Polemik Ijazah 83,7/100
- **Kata kunci sering muncul:** prabowo, perampasan, polri

**Masalah yang mau diselesaikan:**
Sumber sekarang didominasi RSS + YouTube. Tidak ada data aktual dari media sosial Meta (Facebook, Threads, Instagram), padahal di situlah isu bergerak cepat, buzzer muncul, dan sentimen terbentuk. TikTok dan X belum ada konektor di Muse saat ini — **jangan dijanjikan di Fase 1**.

### 1.3 Tujuan Fase 1
Bangun API TRINETRA yang bisa menerima data yang ditarik **oleh Muse lewat konektor resmi Meta**, lalu menyimpannya, menghitung sentimen dan sinyal buzzer, dan menampilkannya di dashboard yang sudah ada.

**Bukan tujuan Fase 1:**
- Scraping liar / scraping HTML / bypass login
- TRINETRA langsung login ke akun sosial user tanpa izin
- Auto-posting massal, auto-like, auto-follow
- Melabel akun sebagai "buzzer" secara final tanpa review manusia

---

## 2. Arsitektur — Siapa yang Menarik Data?

### 2.1 Prinsip kunci (wajib dipatuhi agentic)

> **TRINETRA TIDAK menarik data langsung dari Meta di Fase 1. Muse yang menarik, TRINETRA yang menerima.**

Alasannya:
1. Konektor Facebook / Threads / Instagram sudah terhubung ke Muse lewat Meta Accounts Center, bukan ke server TRINETRA.
2. Muse punya CLI resmi (`facebook-cli`, `threads-cli`, `instagram-cli`) dengan auth, rate limit, dan consent yang sudah terverifikasi.
3. Kalau TRINETRA mencoba scraping langsung, akun bisa diblokir (429, scraping protection Threads sangat ketat).

### 2.2 Alur data

```
[Topik & Keyword di TRINETRA]
        |
        v
[Muse Agent / Scheduler] -- baca daftar topik dari TRINETRA API
        |
        v
[Muse Connector CLI - resmi]
  - facebook-cli
  - threads-cli
  - instagram-cli
        |
        v
[Normalisasi ke Unified Mention Schema]  <-- dilakukan Muse / collector
        |
        v  POST /api/v1/ingest/mentions (API Key)
[TRINETRA API + Database]
        |
        v
[Dedup, Sentimen, Buzzer Score, Agregasi]
        |
        v
[Dashboard: Ruang Intelijen, Radar Isu Hangat, Radar Buzzer & Bot]
```

### 2.3 Dua mode operasi

**Mode A — Muse sebagai collector (Fase 1, wajib):**
- Muse membaca `GET /api/v1/topics/active` dari TRINETRA
- Muse menjalankan pencarian / feed per topik, maksimal sesuai rate limit
- Muse mengirim hasil via `POST /api/v1/ingest/mentions`
- TRINETRA hanya menerima, menyimpan, dan menganalisis

**Mode B — TRINETRA backend langsung ke Meta Graph API (Fase 2, opsional, jangan dibangun dulu):**
- Butuh Meta App, App Review, token jangka panjang, dan persetujuan user terpisah
- Agentic harus menandai ini sebagai `FUTURE`, bukan membangunnya sekarang

---

## 3. Akun yang Sudah Terhubung (Terverifikasi 2026-11-25)

> Semua akun di bawah ini sudah dites `me` / `accounts` / `profile` dan berhasil. Jangan minta user connect ulang kecuali ada error `not connected`.

| Platform | Akun | ID / Handle | Status Profil |
|---|---|---|---|
| Facebook | Antique Antique | `fb_user_id: 61596626113657` | Terhubung, `me` OK |
| Threads | Antique / @a.nti.que | `account_id: 17841459966902138` | Personal, 0 post, 0 following, tidak private, tidak verified |
| Instagram | Antique / @a.nti.que | `user_fbid: 17841462245603061`, `user_igid: 62264490853` | Personal, 0 post, 0 followers, 0 following, tidak private, bukan akun profesional |

**Catatan penting dari tes:**
- Instagram `feed --variant following` kosong karena following = 0. Untuk deteksi isu, **harus pakai pencarian kata kunci**, bukan feed following.
- Facebook `pages list` mengembalikan `PROFESSIONAL_CONSENT_REQUIRED`. Fitur Page butuh consent profesional tambahan. Jangan jadikan Page sebagai sumber utama di Fase 1.
- Threads `trends` saat dites mengembalikan `edges: []` (kosong). Jangan andalkan trends saja.
- Threads feed For You saat dites hanya mengembalikan 4 postingan, kebanyakan personal / berbahasa Mandarin. Feed umum tidak cocok untuk deteksi buzzer — **harus pakai `search --query` per topik**.

---

## 4. Konektor yang Tersedia di Muse — Perintah yang Sudah Diverifikasi

> Semua perintah di bawah ini dijalankan via `/opt/hatch/bin/<cli>`. Output-nya JSON. Jangan pipe ke `head` / `jq` di perintah yang sama untuk read — baca output utuh, lalu proses di langkah berikutnya.
>
> **Aturan rate limit (wajib):**
> - HTTP 429 = STOP total untuk provider itu di task tersebut. Jangan retry, jangan ganti endpoint, jangan turunkan rate lalu lanjut.
> - Threads: jangan polling berulang konten yang sama. Pakai `--since` untuk incremental.
> - Instagram: 429 = stop semua `instagram-cli` di task itu.
> - Facebook: jalankan `facebook-cli guidance --query "..." --context "..."` saat ada failure, kecuali kasus yang dikecualikan di CONNECTOR.md.

Dokumen konektor lengkap ada di:
- `/opt/hatch/connectors/facebook_cli/CONNECTOR.md`
- `/opt/hatch/connectors/threads/CONNECTOR.md`
- `/opt/hatch/connectors/instagram/CONNECTOR.md`

### 4.1 Facebook — `facebook-cli`

**Tes koneksi:**
```sh
/opt/hatch/bin/facebook-cli me
```

**Yang bisa dilakukan:**
```sh
# Feed
/opt/hatch/bin/facebook-cli feed newsfeed --limit 10
/opt/hatch/bin/facebook-cli feed friends --limit 5

# Baca postingan / komentar / reaksi
/opt/hatch/bin/facebook-cli post read --post-id '<post_id>'
/opt/hatch/bin/facebook-cli post comments read --post-id '<post_id>' --limit 20
/opt/hatch/bin/facebook-cli post reactions read --post-id '<post_id>'

# Teman & profil (hanya teman user)
/opt/hatch/bin/facebook-cli me friends --name '<nama>' --limit 20
/opt/hatch/bin/facebook-cli profile info --profile-id '<profile_id>'
/opt/hatch/bin/facebook-cli timeline fetch --profile-id '<profile_id>' --limit 20
```

**Bisa juga:** posting teks/media, Reel, komentar, reaksi, posting di grup, moderasi grup, kelola Page yang dikelola, Marketplace search / listing.

**Tidak bisa:** DM (konektor terpisah), edit postingan orang lain, hapus postingan di luar spam grup, bulk scraping profil.

### 4.2 Threads — `threads-cli`

**Tes koneksi:**
```sh
/opt/hatch/bin/threads-cli accounts
/opt/hatch/bin/threads-cli profile --account-id 17841459966902138
```

**Yang bisa dilakukan (paling penting untuk TRINETRA):**
```sh
# Pencarian per topik — INI SUMBER UTAMA
/opt/hatch/bin/threads-cli search --account-id 17841459966902138 --query "Koperasi Desa Merah Putih" --recent 1 --first 20
/opt/hatch/bin/threads-cli search --account-id 17841459966902138 --query "Febrie Adriansyah" --recent 1 --first 20

# Feed & tren
/opt/hatch/bin/threads-cli feed --account-id 17841459966902138 --variant for_you --first 10
/opt/hatch/bin/threads-cli feed --account-id 17841459966902138 --variant following --sort-by recent --first 10
/opt/hatch/bin/threads-cli trends --account-id 17841459966902138 --first 10

# Baca 1 postingan & interaksinya
/opt/hatch/bin/threads-cli post --account-id 17841459966902138 --post-id <post_id>
/opt/hatch/bin/threads-cli post --account-id 17841459966902138 --url https://www.threads.com/@<username>/post/<shortcode>
/opt/hatch/bin/threads-cli fetch-post-comments --account-id 17841459966902138 --post-ids <post_id> --limit 20
/opt/hatch/bin/threads-cli fetch-post-likers --account-id 17841459966902138 --post-ids <post_id>
/opt/hatch/bin/threads-cli fetch-post-reposts --account-id 17841459966902138 --post-ids <post_id>
/opt/hatch/bin/threads-cli fetch-post-quotes --account-id 17841459966902138 --post-ids <post_id>

# Profil user lain (by username, bukan URL)
/opt/hatch/bin/threads-cli user-profile --account-id 17841459966902138 --username <username>
/opt/hatch/bin/threads-cli profile-threads --account-id 17841459966902138 --user-id <user_id> --first 10
```

**Bisa juga:** publish post teks max 500 karakter + 1-20 media / carousel, hide/unhide reply, approve/ignore pending reply, `dear-algo-whisper` untuk tuning feed.

**Batasan:** `--first` / `--limit` 1-50, `--post-ids` max 10 per call, jangan polling frekuen.

### 4.3 Instagram — `instagram-cli`

**Tes koneksi:**
```sh
/opt/hatch/bin/instagram-cli accounts
/opt/hatch/bin/instagram-cli profile --account-id 17841462245603061
```

**Yang bisa dilakukan:**
```sh
# Feed following / favorites (terbatas, ranked home tidak bisa dibaca)
/opt/hatch/bin/instagram-cli feed --account-id 17841462245603061 --variant following
/opt/hatch/bin/instagram-cli feed --account-id 17841462245603061 --variant favorites

# Baca postingan
/opt/hatch/bin/instagram-cli posts --account-id 17841462245603061 --username <username> --limit 25
/opt/hatch/bin/instagram-cli post --account-id 17841462245603061 --id <media_id>
/opt/hatch/bin/instagram-cli post --account-id 17841462245603061 --url https://www.instagram.com/reels/<shortcode>

# Cari akun (bukan cari postingan)
/opt/hatch/bin/instagram-cli account-search --account-id 17841462245603061 --query "<nama>" --count 10
/opt/hatch/bin/instagram-cli profile --account-id 17841462245603061 --username @<username>

# Komentar & likers
/opt/hatch/bin/instagram-cli fetch-post-comments --account-id 17841462245603061 --post-ids <media_id> --limit 25
/opt/hatch/bin/instagram-cli fetch-post-likers --account-id 17841462245603061 --post-ids <media_id>

# Insight akun sendiri
/opt/hatch/bin/instagram-cli analytics-account-insights --account-id 17841462245603061 --time-range last-7d
/opt/hatch/bin/instagram-cli individual-post-insights --account-id 17841462245603061 --post <media_id>
```

**Penting:** Instagram CLI **tidak punya search postingan by keyword** seperti Threads. Untuk Instagram, penarikan topik harus lewat:
1. `social.search` (Muse) untuk discovery lintas platform, lalu
2. `instagram-cli post --url` untuk membaca detail postingan yang ditemukan, atau
3. Daftar akun yang dipantau (watchlist) → `posts --username <username>`

**Bisa juga:** publish / schedule feed post, Reel, carousel, Story, balas komentar, edit caption, kelola bio / link / foto profil / saved collection.

**Tidak bisa:** DM (konektor terpisah), like, buat komentar top-level baru, hapus postingan, block, baca ranked home timeline, baca following list orang lain.

### 4.4 Discovery lintas platform — `social.search`

Gunakan saat butuh pencarian topik di 3 platform sekaligus, sebelum detail dibaca via CLI masing-masing. Contoh query yang sudah dites dan berhasil:
- `Febrie Adriansyah Kejaksaan`, `Febrie Adriansyah TPPU sidang`, `Febrie Adriansyah kriminalisasi`
- Hasilnya mengembalikan postingan Facebook / Instagram / Threads dengan ringkasan, like, komentar, dan sentimen.

---

## 5. Desain API TRINETRA (Yang Harus Dibangun Agentic)

### 5.1 Stack yang diasumsikan
- Backend yang sudah ada di https://media.antiquetech.web.id/ (jangan rebuild dari nol kecuali memang belum ada backend API)
- Database: pakai yang sudah ada di TRINETRA. Jika belum ada tabel untuk sosial, buat tabel baru (lihat 5.4). Jangan ganti skema RSS / YouTube yang sudah jalan.
- Auth: API Key + rate limit per key. Jangan simpan API key di repo / di file .md ini.
- Format: JSON, UTF-8, waktu dalam ISO 8601 dengan zona Asia/Jakarta + offset, contoh `2026-11-25T11:02:18+07:00`
- Versi: `/api/v1/` — semua endpoint baru di bawah ini.

### 5.2 Endpoint yang harus dibangun

#### A. Topik — sumber kebenaran untuk collector Muse

```
GET  /api/v1/topics/active
GET  /api/v1/topics/{topic_id}
POST /api/v1/topics
PATCH /api/v1/topics/{topic_id}
```

Response `GET /api/v1/topics/active`:
```json
{
  "topics": [
    {
      "topic_id": "top_kopdes_001",
      "name": "Koperasi Desa Merah Putih",
      "keywords": ["Koperasi Desa Merah Putih", "Kopdes Merah Putih", "KDMP"],
      "platforms": ["threads", "facebook", "instagram"],
      "priority": 95,
      "active": true,
      "last_collected_at": "2026-11-25T11:00:00+07:00",
      "collect_interval_minutes": 60
    },
    {
      "topic_id": "top_febrie_001",
      "name": "Febrie Adriansyah ex Jampidsus",
      "keywords": ["Febrie Adriansyah", "Febrie Kejaksaan", "Febrie TPPU", "Febrie kriminalisasi"],
      "platforms": ["threads", "facebook", "instagram"],
      "priority": 90,
      "active": true,
      "last_collected_at": "2026-11-25T11:13:00+07:00",
      "collect_interval_minutes": 30
    }
  ]
}
```

**Aturan:**
- Muse hanya menarik topik dengan `active=true`
- `keywords` adalah daftar pencarian yang dipakai verbatim di `threads-cli search --query` dan `social.search`
- Jangan ubah `keywords` dari sisi Muse — perubahan keyword hanya lewat TRINETRA dashboard / API ini

#### B. Ingest — menerima data dari Muse

```
POST /api/v1/ingest/mentions
Header: X-TRINETRA-API-KEY: <key>
Header: Content-Type: application/json
```

Request body (batch, max 50 mention per request):
```json
{
  "source": "muse-connector",
  "collected_at": "2026-11-25T11:13:46+07:00",
  "topic_id": "top_febrie_001",
  "mentions": [
    {
      "platform": "threads",
      "platform_post_id": "18446101459181119",
      "platform_post_code": "DgHYtzLkaaT",
      "url": "https://www.threads.com/@bkmedan_/post/DgHYtzLkaaT",
      "author_username": "bkmedan_",
      "author_display_name": "Medan | BK Medan | Berita Medan",
      "author_follower_count": null,
      "author_is_verified": false,
      "author_profile_url": "https://www.threads.net/@bkmedan_",
      "posted_at": "2026-11-24T14:09:59+07:00",
      "text": "Mantan Jampidsus Febrie Adriansyah menyatakan kasus TPPU yang menjeratnya merupakan kriminalisasi...",
      "media_type": "video",
      "like_count": 37,
      "comment_count": 5,
      "repost_count": 6,
      "quote_count": 0,
      "language": "id",
      "raw_source": "threads-cli search",
      "collector_note": "duplikat muncul di 2 pencarian berbeda, kemungkinan thread yang sama"
    }
  ]
}
```

Response sukses:
```json
{
  "accepted": 1,
  "duplicates_skipped": 0,
  "rejected": 0,
  "errors": [],
  "ingest_id": "ing_20261125_111346_001"
}
```

**Aturan ingest (wajib diimplementasikan):**
1. **Dedup:** kunci unik = `(platform, platform_post_id)`. Jika sudah ada, skip dan hitung sebagai `duplicates_skipped`, jangan insert ganda. Contoh nyata: postingan @bkmedan_ yang sama muncul di 2 pencarian Threads — harus jadi 1 baris di DB.
2. **Validasi:** `platform` hanya `facebook | threads | instagram | youtube | rss`. `url` harus valid. `posted_at` harus ISO 8601. `text` boleh kosong hanya jika `media_type=video/image` dan ada caption kosong yang valid.
3. **Jangan simpan teks mentah berlebih:** simpan `text` apa adanya untuk analisis, tapi jangan simpan blob gambar/video. Simpan URL-nya saja.
4. **Idempotent:** kirim batch yang sama 2x harus menghasilkan `duplicates_skipped` yang sama, bukan data ganda.
5. **Rate limit ingest:** max 10 request / menit / API key di Fase 1. Kembalikan 429 dengan `Retry-After` jika melebihi.

#### C. Baca data — untuk dashboard & Muse

```
GET /api/v1/mentions?topic_id=top_febrie_001&platform=threads&since=2026-11-24T00:00:00+07:00&limit=20
GET /api/v1/mentions/{mention_id}
GET /api/v1/topics/{topic_id}/summary?window=24h
GET /api/v1/topics/{topic_id}/buzzer-signals?min_score=60&limit=20
GET /api/v1/accounts/{platform}/{username}
```

Response `summary` harus bisa mengisi dashboard yang sudah ada:
```json
{
  "topic_id": "top_febrie_001",
  "window": "24h",
  "total_mentions": 42,
  "by_platform": {"threads": 28, "facebook": 9, "instagram": 5},
  "sentiment": {"positive": 12, "negative": 58, "neutral": 30},
  "top_keywords": ["kriminalisasi", "TPPU", "penyadapan", "mafia"],
  "buzzer_signal_count": 2,
  "updated_at": "2026-11-25T11:15:00+07:00"
}
```

#### D. Sinyal Buzzer — untuk Radar Buzzer & Bot

```
GET /api/v1/buzzer-signals?topic_id=top_febrie_001
POST /api/v1/buzzer-signals/{signal_id}/review
```

Skema sinyal (dihitung TRINETRA, bukan Muse):
```json
{
  "signal_id": "bz_001",
  "topic_id": "top_febrie_001",
  "account_username": "realemo87",
  "platform": "threads",
  "score": 62,
  "level": "watch",
  "reasons": [
    {"code": "burst_same_second", "detail": "2 postingan di detik yang sama 2026-11-25T11:02:18+07:00 dengan narasi pro-program yang mirip"},
    {"code": "low_engagement_promo", "detail": "like 0-1, reply 1-4 untuk konten promosi program"}
  ],
  "evidence_post_ids": ["18147271879581204", "18096410843280717"],
  "status": "pending_review",
  "created_at": "2026-11-25T11:11:40+07:00"
}
```

**Aturan scoring (lihat Bagian 6). Jangan pernah menulis `is_buzzer=true` final tanpa review manusia.**

#### E. Health & Jobs

```
GET /api/v1/health
GET /api/v1/collector/status
```

---

## 6. Logika Analisis — Sentimen & Buzzer (Yang Harus Diimplementasikan)

### 6.1 Sentimen
- Input: `text` mention
- Output: `positive | negative | neutral`, plus `sentiment_score` -1.0 sampai 1.0 dan `confidence` 0-1
- Metode Fase 1: lexicon Indonesia + aturan sederhana, atau model yang sudah ada di TRINETRA. **Jangan klaim akurasi 100%.** Simpan `sentiment_method` di setiap baris.
- Contoh yang sudah diamati:
  - Febrie: komentar dominan negatif — frasa berulang "maling teriak maling", tuntutan hukuman berat. Jangan samakan "negatif" dengan "buzzer".
  - Koperasi Desa: campuran — ada berita netral (atap rusak di Bojonegoro), ada pro-program, ada kritis soal tengkulak.

### 6.2 Buzzer Score — 0 sampai 100

Hitung dari sinyal-sinyal berikut. Setiap sinyal punya bobot. Skor akhir bukan vonis.

| Sinyal | Kode | Bobot | Contoh nyata dari tes 2026-11-25 |
|---|---|---|---|
| Teks duplikat / sangat mirip antar akun | `duplicate_text` | 25 | Tidak ditemukan massal di sampel Febrie / Kopdes |
| Posting beruntun di detik/menit yang sama, akun sama | `burst_same_second` | 20 | @realemo87: 2 postingan di 11:02:18 yang sama, narasi pro-program mirip |
| Posting beruntun, akun berbeda, teks mirip | `coordinated_burst` | 25 | Belum ditemukan di sampel |
| Akun baru / follower sangat rendah tapi posting politik intens | `low_follower_high_volume` | 15 | Perlu data profil — follower count dari `threads-cli` / `instagram-cli profile` |
| Engagement tidak wajar | `anomalous_engagement` | 15 | Like tinggi tapi reply 0, atau sebaliknya. Di sampel Febrie: tidak ada anomali kuat |
| Akun terverifikasi / media resmi | `verified_media` | -20 (pengurang) | @kumparancom, @officialinewstv, @prabowo.gibran2 — ini media, bukan buzzer |

**Level:**
- 0-39: `low` — tidak ditampilkan di Radar Buzzer, hanya di log
- 40-69: `watch` — tampil di Radar Buzzer & Bot sebagai "perlu dipantau"
- 70-100: `high` — tampil sebagai "sinyal kuat", tapi tetap butuh review manusia sebelum disebut buzzer di laporan

**Aturan presentasi:**
- Di UI, selalu tulis **"Terindikasi" / "Sinyal"**, bukan "Buzzer terbukti".
- Tampilkan `reasons[]` dan `evidence_post_ids[]` agar operator bisa klik dan cek sendiri.
- Sediakan tombol review: `confirmed_buzzer | not_buzzer | need_more_data`. Simpan siapa yang mereview dan kapan.

### 6.3 Topik contoh untuk pengujian (wajib dipakai saat testing)

Gunakan 2 topik ini sebagai test case, karena sudah ada data nyata dari 2026-11-24 / 2026-11-25:

**Test Case 1 — Febrie Adriansyah**
- Keywords: `Febrie Adriansyah`, `Febrie Kejaksaan`, `Febrie TPPU`
- Harapan: total mention >0 di Threads, sentimen dominan negatif di komentar, ada 1-2 sinyal `watch` (duplikasi @afudotid, burst @realemo87 bukan di topik ini — jangan dicampur)
- Fakta yang harus cocok: pengunduran diri 11 Juli 2026, eksepsi ditolak 26 Okt 2026, sidang Tipikor Jakarta Pusat

**Test Case 2 — Koperasi Desa Merah Putih**
- Keywords: `Koperasi Desa Merah Putih`, `Kopdes Merah Putih`, `KDMP`
- Harapan: ada berita atap rusak Bojonegoro, ada postingan pro-program, ada postingan kritis
- Sinyal yang harus ketemu: @realemo87 burst_same_second (skor watch, bukan high)

Jika agentic tidak menemukan sinyal di atas saat testing, itu **bug di pipeline**, bukan berarti tidak ada sinyal.

---

## 7. Jadwal Collector (Muse) — Rekomendasi

> Ini rekomendasi untuk Muse / scheduler, bukan untuk TRINETRA backend. Agentic TRINETRA cukup sediakan `last_collected_at` dan `collect_interval_minutes` di tabel topik.

| Topik | Interval | Alasan |
|---|---|---|
| Febrie Adriansyah (sidang aktif) | 30 menit, jam 07.00-22.00 WIB | Sidang dan berita bergerak cepat |
| Koperasi Desa Merah Putih | 60 menit | Isu program, tidak secepat sidang |
| Topik Program Prioritas lain | 120 menit | Monitoring rutin |
| Feed umum (tanpa topik) | Jangan dijadwalkan | Tidak efektif untuk buzzer, seperti terbukti di tes 2026-11-25 |

**Jangan polling Threads lebih sering dari 30 menit untuk topik yang sama.** Threads punya scraping protection ketat. Jika kena 429, hentikan collector untuk topik itu sampai interval berikutnya, jangan retry langsung.

---

## 8. Skema Database (Minimal)

Agentic boleh menyesuaikan dengan DB yang sudah ada, tapi tabel-tabel ini harus ada:

```sql
-- Topik yang dipantau
topics (
  topic_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  keywords JSONB NOT NULL,
  platforms TEXT[] NOT NULL,
  priority INT,
  active BOOLEAN DEFAULT TRUE,
  collect_interval_minutes INT DEFAULT 60,
  last_collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mention yang sudah dinormalisasi (dedup di sini)
mentions (
  mention_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id TEXT REFERENCES topics(topic_id),
  platform TEXT NOT NULL, -- facebook | threads | instagram | youtube | rss
  platform_post_id TEXT NOT NULL,
  platform_post_code TEXT,
  url TEXT,
  author_username TEXT,
  author_display_name TEXT,
  author_follower_count INT,
  author_is_verified BOOLEAN,
  author_profile_url TEXT,
  posted_at TIMESTAMPTZ NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL,
  text TEXT,
  media_type TEXT,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  repost_count INT DEFAULT 0,
  quote_count INT DEFAULT 0,
  language TEXT DEFAULT 'id',
  sentiment TEXT, -- positive | negative | neutral
  sentiment_score FLOAT,
  sentiment_method TEXT,
  raw_source TEXT, -- threads-cli search, facebook-cli feed, dll
  UNIQUE(platform, platform_post_id)
);

-- Sinyal buzzer (hasil analisis, bukan vonis)
buzzer_signals (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id TEXT REFERENCES topics(topic_id),
  account_username TEXT NOT NULL,
  platform TEXT NOT NULL,
  score INT NOT NULL, -- 0-100
  level TEXT NOT NULL, -- low | watch | high
  reasons JSONB NOT NULL,
  evidence_post_ids TEXT[],
  status TEXT DEFAULT 'pending_review', -- pending_review | confirmed_buzzer | not_buzzer | need_more_data
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log ingest untuk audit
ingest_logs (
  ingest_id TEXT PRIMARY KEY,
  topic_id TEXT,
  source TEXT,
  accepted INT,
  duplicates_skipped INT,
  rejected INT,
  errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. Keamanan, Privasi & Kepatuhan (Wajib)

1. **Hanya postingan publik.** Jangan menarik DM, postingan private, atau data teman yang bukan teman user. Facebook CLI hanya bisa baca teman user — patuhi itu.
2. **Jangan profiling yang merugikan:** jangan inferensi etnis, agama, seksualitas, pandangan politik, kesehatan mental, atau finansial dari aktivitas sosial seseorang. Analisis buzzer hanya soal **pola posting** (duplikasi, burst, volume), bukan soal siapa orangnya.
3. **Jangan lacak anak di bawah umur.** Jika ada indikasi akun milik minor, skip.
4. **API Key:** simpan di environment variable / secret manager, jangan di repo, jangan di file .md ini, jangan di log. Rotasi jika bocor.
5. **Login TRINETRA:** endpoint ingest hanya boleh diakses dengan API Key Muse, bukan dengan login web Operator. Pisahkan auth web vs auth API.
6. **Data retention:** simpan mention minimal 90 hari untuk analisis tren. Sediakan endpoint hapus per `platform_post_id` jika ada permintaan takedown yang valid.
7. **Jangan simpan kredensial sosial di TRINETRA.** Kredensial Meta tetap di Muse / Meta Accounts Center. TRINETRA tidak boleh meminta password Facebook / Instagram / Threads user.
8. **Tampilkan sumber:** setiap mention di dashboard harus punya link ke postingan asli (URL Threads / FB / IG) agar operator bisa verifikasi.

---

## 10. Tugas untuk Agentic — Checklist

### Fase 1A — API Core (harus selesai dulu)
- [ ] Buat / periksa tabel `topics`, `mentions`, `buzzer_signals`, `ingest_logs` sesuai Bagian 8
- [ ] Implementasi `GET /api/v1/topics/active` dengan data awal 2 topik test case (Febrie + Kopdes)
- [ ] Implementasi `POST /api/v1/ingest/mentions` dengan dedup `(platform, platform_post_id)`, validasi, dan response `accepted / duplicates_skipped / rejected`
- [ ] Implementasi `GET /api/v1/mentions` + filter `topic_id`, `platform`, `since`, `limit`
- [ ] Implementasi `GET /api/v1/topics/{topic_id}/summary?window=24h`
- [ ] Implementasi auth API Key via header `X-TRINETRA-API-KEY`, dengan rate limit 10 req/menit/key
- [ ] Implementasi `GET /api/v1/health`

### Fase 1B — Analisis
- [ ] Implementasi sentimen sederhana (lexicon ID) + simpan `sentiment_method`
- [ ] Implementasi buzzer scoring sesuai Bagian 6.2, dengan `reasons[]` dan `evidence_post_ids[]`
- [ ] Implementasi `GET /api/v1/topics/{topic_id}/buzzer-signals`
- [ ] Implementasi `POST /api/v1/buzzer-signals/{signal_id}/review`

### Fase 1C — Dashboard
- [ ] Hubungkan `summary` ke Ruang Intelijen (total mention, sentimen, by_platform)
- [ ] Hubungkan `buzzer-signals` ke Radar Buzzer & Bot (tampilkan level `watch` dan `high` saja, dengan alasan)
- [ ] Tambahkan kolom "Sumber: Threads / Facebook / Instagram (via Muse)" di Eksplorasi Sebutan, agar beda dengan RSS / YouTube
- [ ] Pastikan setiap mention punya link asli yang bisa diklik

### Fase 1D — Testing (wajib lulus sebelum serah terima)
- [ ] Test ingest duplikat: kirim batch yang sama 2x → `duplicates_skipped` naik, total di DB tidak naik
- [ ] Test Febrie: ingest 20 mention Threads dari pencarian 2026-11-25 → summary muncul, sentimen negatif dominan di komentar (jika dihitung dari teks)
- [ ] Test Kopdes: ingest mention @realemo87 2 postingan 11:02:18 → muncul 1 sinyal `burst_same_second` level `watch`, skor 40-69
- [ ] Test rate limit: kirim 11 request ingest dalam 1 menit → request ke-11 dapat 429
- [ ] Test auth: tanpa API Key → 401, dengan key salah → 403

### Deliverable yang harus diserahkan agentic
1. Kode API + migrasi DB
2. File `.env.example` (tanpa nilai asli) — contoh: `TRINETRA_API_KEY=`, `DATABASE_URL=`
3. `README-API.md` singkat: cara run lokal, cara test ingest dengan `curl`
4. Laporan test Fase 1D (apa yang lulus / gagal, dengan bukti log)
5. Daftar hal yang **belum** dibangun dan kenapa (misal: TikTok, X, Mode B Graph API langsung)

---

## 11. Contoh `curl` untuk Testing (untuk agentic, bukan untuk user awam)

```bash
# Health
curl https://media.antiquetech.web.id/api/v1/health

# Daftar topik aktif
curl -H "X-TRINETRA-API-KEY: $TRINETRA_API_KEY" \
  https://media.antiquetech.web.id/api/v1/topics/active

# Ingest 1 mention (contoh Febrie)
curl -X POST -H "X-TRINETRA-API-KEY: $TRINETRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "muse-connector",
    "collected_at": "2026-11-25T11:13:46+07:00",
    "topic_id": "top_febrie_001",
    "mentions": [
      {
        "platform": "threads",
        "platform_post_id": "18446101459181119",
        "platform_post_code": "DgHYtzLkaaT",
        "url": "https://www.threads.com/@bkmedan_/post/DgHYtzLkaaT",
        "author_username": "bkmedan_",
        "author_display_name": "Medan | BK Medan | Berita Medan",
        "author_is_verified": false,
        "posted_at": "2026-11-24T14:09:59+07:00",
        "text": "Mantan Jampidsus Febrie Adriansyah menyatakan kasus TPPU yang menjeratnya merupakan kriminalisasi...",
        "media_type": "video",
        "like_count": 37,
        "comment_count": 5,
        "repost_count": 6,
        "language": "id",
        "raw_source": "threads-cli search"
      }
    ]
  }' \
  https://media.antiquetech.web.id/api/v1/ingest/mentions
```

---

## 12. Pertanyaan yang Sering Salah Dijawab Agentic (Baca Dulu)

**Q: "Apakah TRINETRA bisa scraping Instagram / Threads langsung?"**
A: Tidak di Fase 1. Pakai Muse sebagai collector via CLI resmi. Scraping langsung = risiko blokir 429 dan melanggar ToS.

**Q: "Kenapa Instagram tidak bisa search keyword?"**
A: Karena `instagram-cli` memang tidak punya search postingan by keyword. Pakai `social.search` untuk discovery, lalu `instagram-cli post --url` untuk detail. Atau pakai watchlist akun.

**Q: "Apakah akun @realemo87 sudah pasti buzzer?"**
A: Tidak. Skornya `watch` karena burst 2 postingan di detik yang sama. Itu sinyal, bukan vonis. Harus ada review manusia + data tambahan (riwayat posting, pola waktu).

**Q: "Apakah perlu TikTok / X sekarang?"**
A: Tidak. Konektor Muse saat ini hanya Facebook, Threads, Instagram. TikTok / X masuk Fase 2, setelah API Fase 1 stabil.

**Q: "Apakah Muse akan tetap jalan saat user offline?"**
A: Hanya jika ada jadwal / cron yang disetujui user. Muse tidak standby 24 jam tanpa jadwal. Untuk produksi multi-user, TRINETRA backend nantinya harus punya collector sendiri (Mode B), tapi itu di luar Fase 1.

---

## 13. Referensi

- TRINETRA: https://media.antiquetech.web.id/ — PulseScope Intelligence Hub, Operator TRINETRA
- Facebook Connector: `/opt/hatch/connectors/facebook_cli/CONNECTOR.md`
- Threads Connector: `/opt/hatch/connectors/threads/CONNECTOR.md`
- Instagram Connector: `/opt/hatch/connectors/instagram/CONNECTOR.md`
- Akun terverifikasi 2026-11-25: Facebook Antique Antique, Threads @a.nti.que, Instagram @a.nti.que
- Topik test: Febrie Adriansyah (sidang TPPU Tipikor, eksepsi ditolak 26 Okt 2026), Koperasi Desa Merah Putih

---

*Dokumen ini dibuat oleh Yuki (Muse) untuk user TRINETRA pada 2026-11-25, berdasarkan inspeksi website, tes konektor 3 platform, dan analisis topik Febrie & Koperasi Desa. Jika ada yang berubah di website / konektor, update Bagian 1, 3, dan 4 dulu sebelum coding.*
