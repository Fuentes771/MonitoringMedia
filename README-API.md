# TRINETRA API: Konektor Penarikan Data Muse (Fase 1)

Dokumen ringkas ini menjelaskan cara mengonfigurasi, menjalankan, dan menguji jembatan konektor Muse (`Threads`, `Facebook`, `Instagram`) yang terintegrasi langsung dengan pipeline analitik dan dashboard TRINETRA.

## Prinsip Arsitektur

- **Mode A (Muse Push Connector):** TRINETRA tidak melakukan scraping langsung ke Meta. Muse menarik data publik memakai CLI resmi (`threads-cli`, `facebook-cli`, `instagram-cli`, dan `social.search`), menormalisasi payload, lalu mendorong batch ke TRINETRA.
- **Analitik Eksisting:** Seluruh mention yang masuk lewat Muse otomatis diproses secara sinkron oleh pipeline TRINETRA yang sudah ada: validasi URL kanonik (`SocialLinkValidator`), deduplikasi `(provider, external_id)` + *near-duplicate* SHA-256, klasifikasi sentimen/kata kunci/sarkasme/bot via NLP Service (`/batch-analyze`), evaluasi `BuzzerDetectionService`, komputasi `TrendService`, evaluasi `AlertService`, serta invalidasi cache dashboard.
- **Autentikasi Terpisah:** Endpoint collector Muse memakai header `X-TRINETRA-API-KEY`, terpisah dari login web Operator (Laravel Sanctum).

---

## Konfigurasi Environment

Salin `.env.example` (root dan `backend/.env.example`) lalu isi variabel berikut tanpa menyimpannya di repository:

```env
# Mendukung beberapa key dipisah koma untuk rotasi tanpa downtime
TRINETRA_API_KEY=ganti-dengan-secret-key-acak-minimal-32-karakter

# Opsional: kosongkan untuk otomatis memakai workspace utama (pulsescope-hub)
TRINETRA_MUSE_WORKSPACE_ID=

# Batas request POST /api/v1/ingest/mentions per menit per API key
TRINETRA_INGEST_RATE_LIMIT=10
```

## Menjalankan Lokal & Migrasi

```bash
cd backend
php artisan migrate
php artisan test
php artisan serve --host=127.0.0.1 --port=8000
```

Jika menggunakan Docker Compose, pastikan variabel `TRINETRA_API_KEY` ada di `.env` root lalu jalankan ulang container `backend`:

```bash
docker compose up -d --build backend frontend
docker compose exec backend php artisan migrate --force
```

---

## Daftar Endpoint Muse (`/api/v1/`)

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| `GET` | `/api/v1/health` | Publik | Cek kesehatan aplikasi, koneksi DB, dan status kesiapan `muse_configured`. |
| `GET` | `/api/v1/topics/active` | `X-TRINETRA-API-KEY` | Daftar topik aktif yang mengaktifkan platform Meta (`threads`, `facebook`, `instagram`) beserta keyword dan interval polling. |
| `POST` | `/api/v1/ingest/mentions` | `X-TRINETRA-API-KEY` | Terima batch hingga 50 mention, idempoten pada `(platform, platform_post_id)`, rate limit 10 req/menit/key (`429` + `Retry-After`). |
| `GET` | `/api/v1/collector/status` | `X-TRINETRA-API-KEY` | Status sinkronisasi per platform Meta, jumlah topik aktif, dan 5 riwayat `IngestionRun` terbaru. |
| `DELETE` | `/api/v1/ingest/mentions/{platform}/{platform_post_id}` | `X-TRINETRA-API-KEY` | Penghapusan mention untuk permintaan takedown kepatuhan (tercatat di `audit_logs`). |

**Kode status autentikasi:**
- `401 Unauthorized`: header `X-TRINETRA-API-KEY` tidak dikirim atau kosong.
- `403 Forbidden`: API key tidak cocok atau `TRINETRA_API_KEY` belum diisi di server.
- `429 Too Many Requests`: melebihi `TRINETRA_INGEST_RATE_LIMIT` per menit (menyertakan header `Retry-After`).

---

## Contoh Uji `curl`

Ganti `$BASE_URL` (misal `http://127.0.0.1:8000` atau `https://media.antiquetech.web.id`) dan `$TRINETRA_API_KEY` dengan nilai lokal Anda.

### 1. Health Check
```bash
curl -s "$BASE_URL/api/v1/health"
```

### 2. Ambil Daftar Topik Aktif
```bash
curl -s \
  -H "X-TRINETRA-API-KEY: $TRINETRA_API_KEY" \
  "$BASE_URL/api/v1/topics/active"
```

### 3. Ingest Batch Mention (Idempoten)
`topic_id` menerima baik `external_key` (contoh `top_kopdes_001`) maupun integer `id` topik TRINETRA (atau dapat dikosongkan untuk auto-match kata kunci topik aktif).

```bash
curl -s -X POST \
  -H "X-TRINETRA-API-KEY: $TRINETRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "muse-connector",
    "collected_at": "2026-11-25T11:13:46+07:00",
    "topic_id": "top_kopdes_001",
    "mentions": [
      {
        "platform": "threads",
        "platform_post_id": "18147271879581204",
        "platform_post_code": "DgAbCdEfGh1",
        "url": "https://www.threads.com/@realemo87/post/DgAbCdEfGh1",
        "author_username": "realemo87",
        "author_display_name": "realemo87",
        "author_follower_count": null,
        "author_is_verified": false,
        "author_profile_url": "https://www.threads.net/@realemo87",
        "posted_at": "2026-11-25T11:02:18+07:00",
        "text": "Koperasi Desa Merah Putih mulai berjalan di beberapa desa untuk bantu petani.",
        "media_type": "text",
        "like_count": 1,
        "comment_count": 2,
        "repost_count": 0,
        "quote_count": 0,
        "language": "id",
        "raw_source": "threads-cli search"
      }
    ]
  }' \
  "$BASE_URL/api/v1/ingest/mentions"
```

Kirim ulang perintah di atas sekali lagi untuk memastikan respons mengembalikan `"accepted": 0, "duplicates_skipped": 1` tanpa menambah baris ganda di database.

### 4. Cek Status Collector
```bash
curl -s \
  -H "X-TRINETRA-API-KEY: $TRINETRA_API_KEY" \
  "$BASE_URL/api/v1/collector/status"
```

### 5. Hapus Mention (Takedown Kepatuhan)
```bash
curl -s -X DELETE \
  -H "X-TRINETRA-API-KEY: $TRINETRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Permintaan takedown pemilik akun"}' \
  "$BASE_URL/api/v1/ingest/mentions/threads/18147271879581204"
```

---

## Cakupan yang Sengaja Ditunda (Di Luar Fase 1)

- **Mode B (Meta Graph API langsung dari backend TRINETRA):** Membutuhkan Meta App, App Review, dan token jangka panjang terpisah.
- **Konektor TikTok dan X di sisi Muse:** Belum tersedia di Muse pada Fase 1; di TRINETRA keduanya tetap dilayani oleh adapter eksisting (`RapidAPI` / `LocalScraper`).
- **Skema `buzzer_signals` dan endpoint review terpisah:** Sesuai arahan arsitektur, analitik sentimen, deteksi bot/copypasta, sarkasme, tren, dan alert tetap menggunakan layanan TRINETRA yang telah dibangun (`IngestionService`, `BuzzerDetectionService`, `TrendService`, `AlertService`).
