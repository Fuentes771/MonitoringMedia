import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.ai_sentiment import analyze_ai_sentiment
from app.ai_summary import summarize_topic, summarize_mention
from app.ai_chat import process_rag_chat
from app.ai_search import generate_search_queries, filter_relevance, PROGRAM_KNOWLEDGE_BASE
from app.nine_router import NineRouterClient

client = TestClient(app)

def test_api_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

def test_ai_health_endpoint():
    res = client.get("/ai/health")
    assert res.status_code == 200
    data = res.json()
    assert "9router" in data
    assert "status" in data["9router"]

def test_ai_sentiment_fallback_when_offline():
    # Force fallback to verify resilience
    res = analyze_ai_sentiment("Uji coba Makan Bergizi Gratis di SD berjalan sangat lancar dan bergizi!", force_fallback=True)
    assert res["label"] == "positive"
    assert "aspect" in res
    assert "key_reason" in res
    assert "urgency" in res
    assert "confidence" in res
    assert res["probabilities"]["positive"] > res["probabilities"]["negative"]

def test_ai_rag_chat_strict_guardrail_empty_context():
    # Strict guardrail: when context is empty, it MUST refuse to hallucinate
    res = process_rag_chat(
        query="Bagaimana kabar pelaksanaan Makan Bergizi Gratis di Jawa Tengah?",
        context_mentions=[],
        topic_name="Makan Bergizi Gratis (MBG)"
    )
    assert res["grounded"] is False
    assert res["mentions_count"] == 0
    assert "belum ada sebutan" in res["answer"].lower()

def test_ai_rag_chat_with_context_citations():
    mentions = [
        {
            "id": 1,
            "author_name": "Kompas Metro",
            "published_at": "2026-11-06 10:00:00",
            "sentiment": "positive",
            "source_url": "https://kompas.com/mbg-lancar",
            "text": "Uji coba Makan Bergizi Gratis di 10 sekolah Semarang menuai pujian orang tua murid."
        },
        {
            "id": 2,
            "author_name": "Detik News",
            "published_at": "2026-11-06 12:00:00",
            "sentiment": "negative",
            "source_url": "https://detik.com/mbg-terlambat",
            "text": "Beberapa wali murid mengeluhkan keterlambatan distribusi kotak makan di jam istirahat."
        }
    ]

    res = process_rag_chat(
        query="Apa kendala yang muncul dalam uji coba MBG?",
        context_mentions=mentions,
        topic_name="Makan Bergizi Gratis (MBG)"
    )
    assert res["grounded"] is True
    assert res["mentions_count"] == 2
    assert len(res["citations"]) == 2
    assert res["citations"][0]["author"] == "Kompas Metro"
    assert res["citations"][1]["sentiment"] == "negative"

def test_ai_topic_summary_with_mentions():
    mentions = [
        {
            "id": 10,
            "text": "Program 3 Juta Rumah mulai groundbreaking di Jawa Barat dengan skema KPR bersubsidi.",
            "sentiment": "positive",
            "author_name": "Antara News"
        },
        {
            "id": 11,
            "text": "Masyarakat berharap proses verifikasi kelayakan penerima rumah subsidi dipercepat tanpa calo.",
            "sentiment": "neutral",
            "author_name": "Tempo"
        }
    ]

    res = summarize_topic("Program 3 Juta Rumah", mentions)
    assert "topic_name" in res
    assert res["topic_name"] == "Program 3 Juta Rumah"
    assert res["mentions_analyzed"] == 2
    assert "dominant_sentiment" in res
    assert "key_positive_themes" in res

def test_all_17_programs_knowledge_base():
    # Verify all 17 strategic programs exist in knowledge base
    expected_17 = [
        "Makan Bergizi Gratis (MBG)",
        "Cek Kesehatan Gratis (CKG)",
        "Sekolah Rakyat",
        "Sekolah Unggul Garuda",
        "Revitalisasi Sekolah",
        "Digitalisasi Pembelajaran",
        "Magang Nasional",
        "Koperasi Desa/Kelurahan Merah Putih",
        "Program 3 Juta Rumah",
        "Kampung Nelayan Merah Putih",
        "PNM Mekaar",
        "Penghapusan Piutang Macet UMKM",
        "Swasembada Pangan",
        "Hilirisasi Nasional",
        "Ketahanan Energi",
        "Gerakan Indonesia ASRI",
        "Bank Emas (Bullion Bank)"
    ]
    for prog in expected_17:
        assert prog in PROGRAM_KNOWLEDGE_BASE
        q = generate_search_queries(prog)
        assert len(q["google_news_queries"]) > 0
        assert len(q["social_media_keywords"]) > 0

def test_filter_relevance_exclusion():
    rel = filter_relevance(
        program_name="Makan Bergizi Gratis (MBG)",
        title="Dibutuhkan segera lowongan kerja akuntan catering MBG",
        snippet="Loker dibuka untuk lulusan S1"
    )
    assert rel["relevant"] is False

def test_fastapi_analyze_with_ai_flag():
    res = client.post("/analyze", json={
        "text": "Pembangunan lumbung pangan dan cetak sawah baru berhasil tingkatkan produksi beras nasional.",
        "top_keywords": 3,
        "use_ai": True
    })
    assert res.status_code == 200
    data = res.json()
    assert "sentiment" in data
    assert "aspect" in data["sentiment"]
    assert "key_reason" in data["sentiment"]
    assert "keywords" in data

def test_ai_daily_summary_endpoint():
    res = client.post("/ai/daily-summary", json={
        "mentions": [
            {
                "topic": "Makan Bergizi Gratis (MBG)",
                "sentiment": "positive",
                "text": "BGN aktifkan 953 dapur di 34 provinsi layani 1,5 juta penerima manfaat."
            },
            {
                "topic": "Makan Bergizi Gratis (MBG)",
                "sentiment": "negative",
                "text": "Tujuh dapur di Tegal disuspend karena kelalaian administrasi pelaporan."
            }
        ],
        "window_label": "33 jam terakhir"
    })
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert len(data["summary"]) > 10

