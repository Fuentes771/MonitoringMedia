from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from app.scrapers.x_scraper import XScraper
from app.scrapers.tiktok_scraper import TikTokScraper
from app.scrapers.instagram_scraper import InstagramScraper
from app.scrapers.facebook_scraper import FacebookScraper

router = APIRouter()

x_scraper = XScraper()
tiktok_scraper = TikTokScraper()
instagram_scraper = InstagramScraper()
facebook_scraper = FacebookScraper()

SCRAPERS = {
    "x": x_scraper,
    "tiktok": tiktok_scraper,
    "instagram": instagram_scraper,
    "facebook": facebook_scraper,
}

class ScrapeRequest(BaseModel):
    platform: str = Field(..., description="Platform target: 'x', 'tiktok', 'instagram', or 'facebook'")
    query: str = Field(..., description="Search query or keyword")
    limit: Optional[int] = Field(10, ge=1, le=50, description="Max items to retrieve")

class ScrapeResponse(BaseModel):
    status: str
    platform: str
    query: str
    count: int
    items: List[Dict[str, Any]]

@router.get("/status")
def get_scraper_status():
    return {
        "status": "ready",
        "engine": "local_python_curl_cffi",
        "supported_platforms": list(SCRAPERS.keys()),
        "version": "1.0.0"
    }

@router.post("/scrape", response_model=ScrapeResponse)
def scrape_social_media(req: ScrapeRequest):
    platform_key = req.platform.lower().strip()
    if platform_key not in SCRAPERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported platform '{req.platform}'. Supported platforms: {list(SCRAPERS.keys())}"
        )

    scraper = SCRAPERS[platform_key]
    try:
        items = scraper.scrape(query=req.query, limit=req.limit)
        return ScrapeResponse(
            status="success",
            platform=platform_key,
            query=req.query,
            count=len(items),
            items=items
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Local scraper error on {platform_key}: {str(e)}")

