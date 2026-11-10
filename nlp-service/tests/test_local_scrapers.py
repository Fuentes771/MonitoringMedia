import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.scrapers.x_scraper import XScraper
from app.scrapers.tiktok_scraper import TikTokScraper
from app.scrapers.instagram_scraper import InstagramScraper
from app.scrapers.facebook_scraper import FacebookScraper

client = TestClient(app)

def test_scraper_status():
    resp = client.get("/api/v1/scraper/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    assert data["engine"] == "local_python_curl_cffi"
    assert "x" in data["supported_platforms"]
    assert "tiktok" in data["supported_platforms"]
    assert "instagram" in data["supported_platforms"]
    assert "facebook" in data["supported_platforms"]

def test_scraper_invalid_platform():
    resp = client.post("/api/v1/scraper/scrape", json={
        "platform": "unsupported_xyz",
        "query": "test",
        "limit": 5
    })
    assert resp.status_code == 400

def test_x_scraper_structure():
    scraper = XScraper()
    items = scraper.scrape("Prabowo", limit=3)
    assert isinstance(items, list)
    if items:
        item = items[0]
        assert item["provider"] == "x"
        assert "author_name" in item
        assert "text" in item
        assert "metrics" in item
        assert "source_url" in item

def test_tiktok_scraper_structure():
    scraper = TikTokScraper()
    items = scraper.scrape("Prabowo", limit=3)
    assert isinstance(items, list)
    if items:
        item = items[0]
        assert item["provider"] == "tiktok"
        assert "author_name" in item
        assert "text" in item
        assert "metrics" in item

def test_instagram_scraper_structure():
    scraper = InstagramScraper()
    items = scraper.scrape("Indonesia", limit=3)
    assert isinstance(items, list)
    if items:
        item = items[0]
        assert item["provider"] == "instagram"
        assert "author_name" in item

def test_facebook_scraper_structure():
    scraper = FacebookScraper()
    items = scraper.scrape("Indonesia", limit=3)
    assert isinstance(items, list)
    if items:
        item = items[0]
        assert item["provider"] == "facebook"
        assert "author_name" in item

