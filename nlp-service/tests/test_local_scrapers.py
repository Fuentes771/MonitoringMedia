import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.scrapers.base_scraper import BaseScraper
from app.scrapers.x_scraper import XScraper
from app.scrapers.tiktok_scraper import TikTokScraper
from app.scrapers.instagram_scraper import InstagramScraper
from app.scrapers.facebook_scraper import FacebookScraper
from app.scrapers.youtube_scraper import YouTubeScraper

client = TestClient(app)


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
