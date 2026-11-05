# PulseScope: Social Listening, Sentiment Analysis & Trend Intelligence Platform

PulseScope adalah platform intelijen percakapan publik dan monitoring sentimen multi-tenant real-time yang dirancang khusus untuk ekosistem digital Indonesia. Platform ini mengumpulkan, membersihkan, menganalisis, dan memvisualisasikan data dari berbagai kanal publik (Media Berita/RSS, YouTube, Reddit) untuk mendeteksi tren dan potensi krisis komunikasi lebih awal.

---

## 1. Arsitektur Sistem

Platform dibangun dengan arsitektur modular terdistribusi (monorepo):

```
PulseScope/
├── backend/            # REST API Laravel 13 (PHP 8.3+)
│   ├── app/            # Models, Controllers, Services (Ingestion, Trend, Alert)
│   ├── routes/         # Endpoint API v1 terstruktur
│   └── tests/          # Unit & Feature automated test suites (PHPUnit)
├── frontend/           # High-density Observability SPA (React 19 + TypeScript + Vite + Tailwind CSS)
│   ├── src/components/ # KPI cards, charts (Recharts), mentions explorer, forms
│   └── src/pages/      # Overview, Mentions, Topics, Alerts, DataSources
├── nlp-service/        # Dedicated Indonesian NLP Microservice (Python 3.12 + FastAPI)
│   ├── app/            # Hybrid Indonesian lexicon, slang normalizer, negation handling
│   └── tests/          # Unit tests (pytest)
└── docker/             # Production Docker containerization (Docker Compose, Nginx, Dockerfiles)
```

### Alur Data End-to-End:
1. **Ingestion Engine**: Mengambil data artikel publik secara berkala via RSS News Feeds (Google News Indonesia, Antara, Detik, Tempo) dan YouTube Data API v3.
2. **Deduplikasi**: Pengecekan ketat pada pasangan `(provider, external_id)` untuk memastikan tidak ada duplikasi data pada sinkronisasi berulang (idempoten).
3. **Analisis Sentimen Bahasa Indonesia**: Mengirimkan teks ke microservice FastAPI yang memproses slang lokal (`wkwk`, `zonk`, `mantul`, `kecewa`), inversi polaritas negasi (`tidak bagus`, `kurang memuaskan`, `belum berhasil`), dan menghitung skor confidence (0.0 - 1.0).
4. **Trend Momentum Engine**: Menghitung skor tren 0 - 100 secara dinamis berdasarkan 5 komponen: volume terkelompok, rasio pertumbuhan terhadap baseline, akselerasi, diversitas sumber, dan persistensi.
5. **Early Warning System (Alerts)**: Mengevaluasi lonjakan percakapan atau peningkatan drastis sentimen negatif dengan jendela cooldown untuk mencegah alert fatigue.
6. **High-Density Dashboard**: Antarmuka modern dengan status bar cakupan sumber data, provenance data lengkap, label DEMO DATA transparan, dan kemampuan ekspor laporan CSV streaming.

---

## 2. Fitur Utama

- **Multi-Tenant & Workspace Isolation**: Batas data ketat antar workspace dengan role-based access control (Owner, Admin, Analyst, Viewer).
- **Live Data Ingestion**: Langsung aktif tanpa konfigurasi kunci API untuk feed media berita nasional Indonesia. Adapter YouTube Data API v3 siap pakai dengan input kredensial aman.
- **Pembersihan & Ekstraksi Kata Kunci**: Ekstraksi unigram dan bigram dengan filtering stopword bahasa Indonesia untuk mengungkap kata kunci pendorong isu.
- **Early Warning & Manajemen Insiden**: Pencatatan kejadian alert dengan bukti (evidence), cuplikan teks penyebab, serta pelacakan status (`open`, `acknowledged`, `resolved`).
- **Data Provenance & Export**: Akses langsung ke tautan artikel asli, tanggal publikasi, dan ekspor instan seluruh dataset ke format CSV standar.

---

## 3. Akun Pengguna Bawaan (Seeded Demo Accounts)

Database telah disiapkan dengan pengguna multi-peran (Password: `password`):

| Peran | Email | Workspace |
| :--- | :--- | :--- |
| **Owner** | `owner@pulsescope.id` | PulseScope Intelligence Hub |
| **Admin** | `admin@pulsescope.id` | PulseScope Intelligence Hub |
| **Analyst** | `analyst@pulsescope.id` | PulseScope Intelligence Hub |
| **Viewer** | `viewer@pulsescope.id` | PulseScope Intelligence Hub |

---

## 4. Cara Menjalankan Secara Lokal (Development)

### Prasyarat:
- PHP 8.2+ dengan ekstensi `pdo_pgsql`, `pgsql`, `pcntl`, `curl`
- Composer 2+
- Node.js 20+ & pnpm
- Python 3.10+
- PostgreSQL (port 5432) & Redis (port 6379)

### Langkah 1: Jalankan Microservice NLP (FastAPI)
```bash
cd nlp-service
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```
*Healthcheck: `http://127.0.0.1:8001/health`*

### Langkah 2: Jalankan Backend API (Laravel 13)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --port 8000
```
*Healthcheck: `http://127.0.0.1:8000/api/v1/dashboard/overview`*

### Perintah Sinkronisasi Manual:
```bash
# Mengambil berita real-time dan menganalisis sentimen untuk semua topik aktif
php artisan pulsescope:sync
```

### Langkah 3: Jalankan Frontend Dashboard (React + Vite)
```bash
cd frontend
pnpm install
pnpm run dev -- --port 5173
```
*Akses antarmuka web di: `http://127.0.0.1:5173`*

---

## 5. Cara Menjalankan via Docker Compose (Production)

Pastikan Docker Desktop aktif di sistem Anda, lalu jalankan:

```bash
docker compose up --build -d
```

### Port Layanan:
- **Frontend SPA**: `http://localhost:8080` (dilayani Nginx terbalik ke Backend API)
- **Backend API**: `http://localhost:8000`
- **FastAPI NLP**: `http://localhost:8001`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

---

## 6. Daftar Endpoint API v1

| Kategori | Method | Endpoint | Deskripsi |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/login` | Autentikasi token Sanctum |
| **Auth** | `GET` | `/api/v1/me` | Profil pengguna & workspace |
| **Dashboard** | `GET` | `/api/v1/dashboard/overview` | Ringkasan KPI, sentimen, platform, cakupan |
| **Dashboard** | `GET` | `/api/v1/dashboard/timeseries` | Tren volume per hari dengan breakdown sentimen |
| **Topik** | `GET` | `/api/v1/workspaces/{id}/topics` | Daftar topik pantauan workspace |
| **Topik** | `POST` | `/api/v1/workspaces/{id}/topics` | Buat monitor topik baru |
| **Topik** | `POST` | `/api/v1/topics/{id}/sync` | Pemicu sinkronisasi instan per topik |
| **Mentions** | `GET` | `/api/v1/mentions` | Eksplorasi mention berpaginasi dengan filter |
| **Trends** | `GET` | `/api/v1/trends` | Tren momentum dan perincian formula |
| **Connectors** | `GET` | `/api/v1/connectors` | Status konektivitas RSS, YouTube, Reddit |
| **Connectors** | `POST` | `/api/v1/connectors/{provider}/connect` | Konfigurasi API key pihak ketiga |
| **Alerts** | `GET` | `/api/v1/alerts` | Aturan alert aktif dan riwayat kejadian |
| **Alerts** | `PATCH` | `/api/v1/alerts/events/{id}` | Update status insiden (`acknowledged`, `resolved`) |
| **Reports** | `POST` | `/api/v1/reports/export` | Unduh laporan streaming file CSV |

---

## 7. Verifikasi Pengujian Otomatis

Seluruh pengujian unit dan fitur telah lulus 100%:

### Pengujian Backend (PHPUnit)
```bash
cd backend
php artisan test
```
*Hasil: 13 tests passed, 121 assertions (1.2 detik).*

### Pengujian NLP Microservice (Pytest)
```bash
cd nlp-service
pytest
```
*Hasil: 5 tests passed (0.04 detik).*

### Pemeriksaan TypeScript & Build Frontend
```bash
cd frontend
pnpm run build
```
*Hasil: 0 TypeScript errors, bundle berhasil dikompilasi.*
