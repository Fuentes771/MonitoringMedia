from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from app.scrapers.x_scraper import XScraper
from app.scrapers.tiktok_scraper import TikTokScraper
from app.scrapers.instagram_scraper import InstagramScraper
from app.scrapers.facebook_scraper import FacebookScraper
from app.scrapers.youtube_scraper import YouTubeScraper

router = APIRouter()

SCRAPERS = {
    "x": XScraper(),
    "tiktok": TikTokScraper(),
    "instagram": InstagramScraper(),
    "facebook": FacebookScraper(),
    "youtube": YouTubeScraper(),
}


class ScrapeRequest(BaseModel):
    platform: str = Field(..., description="Platform target: 'x', 'tiktok', 'instagram', 'facebook', or 'youtube'")
    query: str = Field(..., description="Search query or keyword")
    limit: Optional[int] = Field(10, ge=1, le=50, description="Max items to retrieve")


class ScrapeResponse(BaseModel):
    status: str
    platform: str
    query: str
    count: int
    verified_count: int = 0
    fallback_count: int = 0
    engine_status: str = "ok"
    status_message: str = ""
    items: List[Dict[str, Any]]


@router.get("/status")
def get_scraper_status():
    return {
        "status": "ready",
        "engine": "local_python_curl_cffi_hybrid",
        "supported_platforms": list(SCRAPERS.keys()),
        "version": "2.0.0",
    }


@router.post("/scrape", response_model=ScrapeResponse)
def scrape_social_media(req: ScrapeRequest):
    platform_key = req.platform.lower().strip()
    if platform_key not in SCRAPERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported platform '{req.platform}'. Supported platforms: {list(SCRAPERS.keys())}",
        )

    scraper = SCRAPERS[platform_key]
    try:
        result = scraper.scrape_with_meta(query=req.query, limit=req.limit or 10)
        items = result["items"]
        return ScrapeResponse(
            status="success",
            platform=platform_key,
            query=req.query,
            count=len(items),
            verified_count=result.get("verified_count", 0),
            fallback_count=result.get("fallback_count", 0),
            engine_status=result.get("engine_status", "empty"),
            status_message=result.get("status_message", ""),
            items=items,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Local scraper error on {platform_key}: {str(e)}")
