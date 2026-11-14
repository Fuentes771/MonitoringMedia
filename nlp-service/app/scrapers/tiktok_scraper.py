import re
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from curl_cffi import requests
from app.scrapers.base_scraper import BaseScraper


TIKTOK_ALLOWED_HOSTS = ("tiktok.com", "www.tiktok.com", "m.tiktok.com", "vt.tiktok.com", "vm.tiktok.com")


class TikTokScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform="tiktok")

    def _extract_video_match(self, url: str) -> Optional[Tuple[str, str, str]]:
        match = re.search(
            r"tiktok\.com/@([a-zA-Z0-9_.\-]{1,40})/(video|photo)/(\d{15,22})",
            url,
            flags=re.IGNORECASE,
        )
        if not match:
            return None
        return match.group(1), match.group(2).lower(), match.group(3)

    def _verify_oembed(self, canonical_url: str) -> Tuple[Optional[Dict[str, Any]], int]:
        try:
            resp = requests.get(
                f"https://www.tiktok.com/oembed?url={canonical_url}",
                headers={"Accept": "application/json"},
                impersonate="chrome120",
                timeout=6,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, dict) and data.get("type") in ("video", "photo"):
                    return data, 200
            return None, resp.status_code
        except Exception:
            return None, 0

    def scrape(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        raw_items = self.search_web_syndication(
            query,
            site_domain="tiktok.com",
            limit=limit,
            extra_site_terms="video",
        )
        if not raw_items:
            raw_items = self.search_web_syndication(query, site_domain="tiktok.com", limit=limit)

        verified_items: List[Dict[str, Any]] = []
        fallback_items: List[Dict[str, Any]] = []
        seen_ids = set()

        for item in raw_items:
            url = item.get("url", "")
            if not self.is_target_domain(url, TIKTOK_ALLOWED_HOSTS):
                continue

            vid_info = self._extract_video_match(url)
            if vid_info:
                handle, media_type, video_id = vid_info
                if video_id in seen_ids:
                    continue

                snowflake_ts = self.parse_tiktok_snowflake_iso(video_id)
                if not snowflake_ts:
                    continue

                canonical_url = f"https://www.tiktok.com/@{handle}/{media_type}/{video_id}"
                oembed_data, oembed_code = self._verify_oembed(canonical_url)
                if oembed_code in (400, 404):
                    continue

                oembed_author = (oembed_data or {}).get("author_unique_id") or handle
                oembed_name = (oembed_data or {}).get("author_name")
                author_label = f"{oembed_name} (@{oembed_author})" if oembed_name else f"@{oembed_author}"

                oembed_title = (oembed_data or {}).get("title") or ""
                clean_text = re.sub(r"TikTok video from [^:]+:\s*", "", item.get("text", ""), flags=re.IGNORECASE)
                clean_text = clean_text.replace("...", "").strip()
                final_text = oembed_title.strip() if len(oembed_title.strip()) > len(clean_text) else clean_text
                if not final_text:
                    continue

                seen_ids.add(video_id)
                verified_items.append({
                    "id": f"tiktok_{video_id}",
                    "provider": "tiktok",
                    "author_name": author_label,
                    "author_handle": f"@{oembed_author}",
                    "source_url": f"https://www.tiktok.com/@{oembed_author}/{media_type}/{video_id}",
                    "link_status": "verified_post",
                    "text": final_text,
                    "published_at": snowflake_ts,
                    "metrics": None,
                    "metrics_available": False,
                    "is_demo": False,
                    "source": "local_enriched" if oembed_data else "local_scraper",
                })
            else:
                # Only allow genuine user/tag pages on tiktok.com to map to an encoded search fallback
                clean_text = re.sub(r"TikTok video from [^:]+:\s*", "", item.get("text", ""), flags=re.IGNORECASE)
                clean_text = clean_text.replace("...", "").strip()
                if not clean_text or len(clean_text) < 20:
                    continue
                user_match = re.search(r"tiktok\.com/@([a-zA-Z0-9_.\-]+)", url, flags=re.IGNORECASE)
                author_label = f"@{user_match.group(1)}" if user_match else "Pencarian TikTok"
                ext_id = f"tiktok_search_{hashlib.md5(url.encode()).hexdigest()[:16]}"
                if ext_id in seen_ids:
                    continue
                seen_ids.add(ext_id)
                fallback_items.append({
                    "id": ext_id,
                    "provider": "tiktok",
                    "author_name": author_label,
                    "source_url": self.build_search_fallback_url(query),
                    "original_discovered_url": self.strip_tracking_params(url),
                    "link_status": "search_fallback",
                    "text": clean_text,
                    "published_at": self.parse_relative_time_iso(item.get("age_hint")) or datetime.now(timezone.utc).isoformat(),
                    "metrics": None,
                    "metrics_available": False,
                    "is_demo": False,
                    "source": "local_search_fallback",
                })

        combined = verified_items + fallback_items
        return combined[:limit]
