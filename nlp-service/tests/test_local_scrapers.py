import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.ai_chat import process_rag_chat
from app.scrapers.base_scraper import BaseScraper
from app.scrapers.x_scraper import XScraper
from app.scrapers.tiktok_scraper import TikTokScraper
from app.scrapers.instagram_scraper import InstagramScraper
from app.scrapers.facebook_scraper import FacebookScraper
from app.scrapers.youtube_scraper import YouTubeScraper

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_scraper_cache():
    BaseScraper.clear_search_cache()
    yield
    BaseScraper.clear_search_cache()


def test_scraper_status():
    resp = client.get("/api/v1/scraper/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    for p in ("x", "tiktok", "instagram", "facebook", "youtube"):
        assert p in data["supported_platforms"]


def test_scraper_invalid_platform():
    resp = client.post("/api/v1/scraper/scrape", json={
        "platform": "unsupported_xyz",
        "query": "test",
        "limit": 5,
    })
    assert resp.status_code == 400


def test_empty_or_throttled_ddg_never_generates_fake_post_urls():
    """Verify BaseScraper does not fabricate /post/<hash> items when search fails."""
    scraper = XScraper()
    with patch("app.scrapers.base_scraper.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 202
        mock_resp.text = "challenge-form anomaly-modal"
        mock_get.return_value = mock_resp

        meta = scraper.scrape_with_meta("Danantara Prabowo", limit=5)
        assert meta["items"] == []
        assert meta["verified_count"] == 0
        assert meta["engine_status"] == "rate_limited"


def test_x_scraper_enrichment_and_search_fallback():
    scraper = XScraper()
    raw_ddg = [
        {"url": "https://x.com/Indolevelup/status/2114676540395135082", "text": "Dummy snippet"},
        {"url": "https://x.com/hashtag/Prabowo", "text": "Tagar diskusi politik nasional Indonesia di platform X"},
        # Cross-domain leak that must be rejected
        {"url": "https://www.suara.com/news/artikel", "text": "Artikel berita luar domain X"},
    ]
    mock_synd = {
        "__typename": "Tweet",
        "id_str": "2114676540395135082",
        "text": "Badan Gizi Nasional memperkuat pengawasan program.",
        "created_at": "2026-10-26T11:12:30.000Z",
        "favorite_count": 42,
        "conversation_count": 7,
        "retweet_count": 12,
        "user": {"name": "Indonesia Level Up", "screen_name": "Indolevelup"},
    }
    with patch.object(scraper, "search_web_syndication", return_value=raw_ddg), \
         patch.object(scraper, "_fetch_syndication_tweet", return_value=(mock_synd, 200)):
        items = scraper.scrape("Badan Gizi Nasional", limit=5)

    assert len(items) == 2
    verified = items[0]
    assert verified["link_status"] == "verified_post"
    assert verified["source_url"] == "https://x.com/Indolevelup/status/2114676540395135082"
    assert verified["published_at"] == "2026-10-26T11:12:30.000Z"
    assert verified["metrics"]["likes"] == 42
    assert verified["metrics_available"] is True

    fallback = items[1]
    assert fallback["link_status"] == "search_fallback"
    assert " " not in fallback["source_url"]
    assert "x.com/search?q=Badan+Gizi+Nasional" in fallback["source_url"]
    assert fallback["metrics"] is None
    assert fallback["metrics_available"] is False


def test_x_scraper_rejects_deleted_tweet():
    scraper = XScraper()
    raw_ddg = [{"url": "https://x.com/user/status/2114676540395135082", "text": "Tweet text"}]
    with patch.object(scraper, "search_web_syndication", return_value=raw_ddg), \
         patch.object(scraper, "_fetch_syndication_tweet", return_value=(None, 404)):
        items = scraper.scrape("Badan Gizi", limit=3)
    assert items == []


def test_tiktok_scraper_validates_snowflake_and_rejects_fake_id():
    scraper = TikTokScraper()
    raw_ddg = [
        # Real 19-digit snowflake ID
        {"url": "https://www.tiktok.com/@detikcom/video/7602134172550827272", "text": "Presiden Prabowo sampaikan arahan MBG"},
        # Too-short fake demo ID (year 1970)
        {"url": "https://www.tiktok.com/@guru_penggerak/video/74312890123", "text": "Video palsu"},
        # Tag page maps cleanly to search_fallback
        {"url": "https://www.tiktok.com/tag/mbg", "text": "Kumpulan konten publik diskusi Makan Bergizi Gratis di TikTok"},
    ]
    with patch.object(scraper, "search_web_syndication", return_value=raw_ddg), \
         patch.object(scraper, "_verify_oembed", return_value=({"author_unique_id": "detikcom", "author_name": "detikcom", "title": "Presiden Prabowo sampaikan arahan MBG"}, 200)):
        items = scraper.scrape("Makan Bergizi Gratis", limit=5)

    assert len(items) == 2
    assert items[0]["link_status"] == "verified_post"
    assert items[0]["source_url"] == "https://www.tiktok.com/@detikcom/video/7602134172550827272"
    assert items[0]["published_at"].startswith("2026-02-02")
    assert items[1]["link_status"] == "search_fallback"
    assert " " not in items[1]["source_url"]


def test_instagram_scraper_blocks_popular_mirror_and_verifies_embed():
    scraper = InstagramScraper()
    raw_ddg = [
        {"url": "https://www-fallback.instagram.com/popular/spam-item/", "text": "Spam popular item from fallback mirror"},
        {"url": "https://www.instagram.com/p/De8TYP6lIm4/", "text": "BBC News Indonesia laporan terbaru"},
    ]
    embed_mock = {
        "username": "bbcindonesia",
        "caption": "Naiknya Prabowo Subianto dan Gibran Rakabuming Raka di pelantikan",
        "comments": 128,
        "likes": None,
        "published_at": None,
    }
    with patch.object(scraper, "search_web_syndication", return_value=raw_ddg), \
         patch.object(scraper, "_enrich_via_embed", return_value=(embed_mock, 200)):
        items = scraper.scrape("Prabowo", limit=5)

    assert len(items) == 1
    assert items[0]["link_status"] == "verified_post"
    assert items[0]["author_name"] == "@bbcindonesia"
    assert items[0]["source_url"] == "https://www.instagram.com/p/De8TYP6lIm4/"
    assert items[0]["metrics"]["comments"] == 128


def test_facebook_scraper_rejects_foreign_domain_and_encodes_group_fallback():
    scraper = FacebookScraper()
    raw_ddg = [
        {"url": "https://www.suara.com/bisnis/2026/10/20/artikel", "text": "Artikel portal berita bukan Facebook"},
        {"url": "https://www.facebook.com/groups/2279817449142863/", "text": "Program Makan Bergizi Gratis diskusi komunitas Facebook Indonesia"},
        {"url": "https://www.facebook.com/reel/885240781079158/?mibextid=xyz", "text": "Presiden Prabowo menghadiri acara resmi"},
    ]
    with patch.object(scraper, "search_web_syndication", return_value=raw_ddg), \
         patch.object(scraper, "_verify_live_post", return_value=("Presiden Prabowo menghadiri acara resmi", 200)):
        items = scraper.scrape("Makan Bergizi Gratis", limit=5)

    assert len(items) == 2
    assert items[0]["link_status"] == "verified_post"
    assert items[0]["source_url"] == "https://www.facebook.com/reel/885240781079158/"
    assert items[1]["link_status"] == "search_fallback"
    assert items[1]["source_url"] == "https://www.facebook.com/search/posts/?q=Makan+Bergizi+Gratis"


def test_youtube_scraper_parses_yt_initial_data():
    scraper = YouTubeScraper()
    fake_initial_data = {
        "contents": {
            "twoColumnSearchResultsRenderer": {
                "primaryContents": {
                    "sectionListRenderer": {
                        "contents": [
                            {
                                "itemSectionRenderer": {
                                    "contents": [
                                        {
                                            "videoRenderer": {
                                                "videoId": "aIUWJ9t-Etk",
                                                "title": {"runs": [{"text": "Dialog Publik Makan Bergizi Gratis"}]},
                                                "ownerText": {"runs": [{"text": "Kanal Nasional"}]},
                                                "viewCountText": {"simpleText": "125,400 views"},
                                                "publishedTimeText": {"simpleText": "2 days ago"},
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            }
        }
    }
    html_payload = f"<script>var ytInitialData = {json.dumps(fake_initial_data)};</script>"
    with patch("app.scrapers.youtube_scraper.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = html_payload
        mock_get.return_value = mock_resp

        items = scraper.scrape("Makan Bergizi Gratis", limit=3)

    assert len(items) == 1
    assert items[0]["source_url"] == "https://www.youtube.com/watch?v=aIUWJ9t-Etk"
    assert items[0]["link_status"] == "verified_post"
    assert items[0]["metrics"]["views"] == 125400
    assert items[0]["metrics_available"] is True
    assert items[0]["author_name"] == "Kanal Nasional"


def test_live_scrape_never_returns_post_hash_urls():
    """Live smoke check over API endpoints asserting no /post/<hash> URL is returned."""
    for plat in ("x", "youtube"):
        resp = client.post("/api/v1/scraper/scrape", json={"platform": plat, "query": "Prabowo", "limit": 3})
        assert resp.status_code == 200
        body = resp.json()
        for item in body["items"]:
            assert "/post/" not in item["source_url"]
            assert "www-fallback." not in item["source_url"]
            assert " " not in item["source_url"]


def test_batch_analyze_includes_bot_and_sarcasm_signals():
    resp = client.post("/batch-analyze", json={
        "use_ai": False,
        "items": [
            {
                "id": 101,
                "text": "Program MBG sangat membantu anak sekolah di daerah kami.",
                "author_name": "Warga Daerah",
                "provider": "rss",
                "top_keywords": 4,
            },
            {
                "id": 102,
                "text": "Bagus sekali kebijakannya, saking hebatnya rakyat susah terus 🤡 #KawalTerus #Mantap #Sukses #Hebat",
                "author_name": "user_987654",
                "provider": "x",
                "top_keywords": 4,
            },
        ],
    })
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 2

    item1 = results[0]
    assert item1["id"] == 101
    assert "aspect" in item1["sentiment"]
    assert "key_reason" in item1["sentiment"]
    assert item1["bot_analysis"]["is_inauthentic"] is False

    item2 = results[1]
    assert item2["id"] == 102
    assert item2["sentiment"]["is_sarcasm"] is True
    assert item2["sentiment"]["label"] == "negative"
    assert item2["bot_analysis"]["is_inauthentic"] is True
    assert len(item2["bot_analysis"]["bot_signals"]) >= 1


def test_scraper_secondary_syndication_fallback_and_ttl_cache():
    scraper = XScraper()
    bing_rss = """<?xml version="1.0" encoding="utf-8" ?>
    <rss version="2.0"><channel>
      <item>
        <title>Diskusi MBG</title>
        <link>https://x.com/Indolevelup/status/2114676540395135082</link>
        <description>Program Makan Bergizi Gratis terus dievaluasi di berbagai daerah.</description>
        <pubDate>Tue, 10 Nov 2026 10:00:00 GMT</pubDate>
      </item>
    </channel></rss>"""

    call_urls = []

    def fake_get(url, **kwargs):
        call_urls.append(url)
        mock_resp = MagicMock()
        if "duckduckgo.com" in url:
            mock_resp.status_code = 202
            mock_resp.text = "challenge-form anomaly-modal"
        else:
            mock_resp.status_code = 200
            mock_resp.text = bing_rss
        return mock_resp

    with patch("app.scrapers.base_scraper.requests.get", side_effect=fake_get):
        first_res = scraper.search_web_syndication("Makan Bergizi Gratis", site_domain="x.com", limit=5, extra_site_terms="status")
        assert len(first_res) == 1
        assert first_res[0]["url"] == "https://x.com/Indolevelup/status/2114676540395135082"
        calls_after_first = len(call_urls)
        # Circuit breaker should hit DDG once (not twice) before falling back to Bing RSS
        ddg_calls = [u for u in call_urls if "duckduckgo.com" in u]
        assert len(ddg_calls) == 1

        # Second identical search must be served from TTL cache with zero extra HTTP calls
        second_res = scraper.search_web_syndication("Makan Bergizi Gratis", site_domain="x.com", limit=5, extra_site_terms="status")
        assert len(second_res) == 1
        assert len(call_urls) == calls_after_first


def test_rag_chat_offline_structured_fallback():
    offline_client = MagicMock()
    offline_client.chat_completion.return_value = {"success": False, "error": "9Router unreachable"}

    mentions = [
        {"id": 1, "author_name": "Kompas", "provider": "rss", "sentiment": "positive", "text": "Penyaluran MBG berjalan lancar di Jawa Barat."},
        {"id": 2, "author_name": "Tempo", "provider": "rss", "sentiment": "negative", "text": "Terdapat kendala logistik distribusi bahan pangan di wilayah terpencil."},
    ]
    res = process_rag_chat(
        query="Bagaimana perkembangan MBG?",
        context_mentions=mentions,
        topic_name="Makan Bergizi Gratis (MBG)",
        client=offline_client,
    )
    assert res["engine"] == "local-context-fallback"
    assert res["grounded"] is True
    assert "Ringkasan Eksekutif" in res["answer"]
    assert "Distribusi Sentimen Publik" in res["answer"]
    assert "50% (1 sebutan)" in res["answer"]
    assert "—" not in res["answer"]
