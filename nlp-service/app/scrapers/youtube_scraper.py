import json
import re
import urllib.parse
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from curl_cffi import requests
from app.scrapers.base_scraper import BaseScraper


class YouTubeScraper(BaseScraper):
    """Free YouTube public search scraper using embedded ytInitialData JSON."""

    def __init__(self):
        super().__init__(platform="youtube")

    def _parse_view_count(self, view_text: Optional[str]) -> Optional[int]:
        if not view_text:
            return None
        digits = re.sub(r"[^\d]", "", view_text)
        if digits:
            try:
                return int(digits)
            except Exception:
                return None
        return None

    def scrape(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        clean_query = re.sub(r"\s+", " ", (query or "").strip())
        if not clean_query:
            self._last_search_meta = {
                "engine_status": "empty",
                "status_message": "Query pencarian YouTube kosong.",
                "raw_count": 0,
            }
            return []

        url = f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(clean_query)}"
        try:
            resp = requests.get(url, headers=self.headers, impersonate="chrome120", timeout=10)
            if resp.status_code != 200 or "ytInitialData" not in resp.text:
                self._last_search_meta = {
                    "engine_status": "error",
                    "status_message": f"YouTube search mengembalikan status HTTP {resp.status_code}.",
                    "raw_count": 0,
                }
                return []

            match = re.search(r"var ytInitialData = (\{.*?\});</script>", resp.text)
            if not match:
                self._last_search_meta = {
                    "engine_status": "empty",
                    "status_message": "Payload ytInitialData YouTube tidak ditemukan.",
                    "raw_count": 0,
                }
                return []

            data = json.loads(match.group(1))
            sections = (
                data.get("contents", {})
                .get("twoColumnSearchResultsRenderer", {})
                .get("primaryContents", {})
                .get("sectionListRenderer", {})
                .get("contents", [])
            )

            items: List[Dict[str, Any]] = []
            seen_ids = set()

            for sec in sections:
                contents = sec.get("itemSectionRenderer", {}).get("contents", [])
                for entry in contents:
                    vr = entry.get("videoRenderer")
                    if not vr:
                        continue
                    video_id = vr.get("videoId")
                    if not video_id or video_id in seen_ids:
                        continue

                    title = "".join(r.get("text", "") for r in (vr.get("title") or {}).get("runs", [])).strip()
                    author = "".join(r.get("text", "") for r in (vr.get("ownerText") or {}).get("runs", [])).strip()

                    snippet_runs = []
                    for meta_snip in vr.get("detailedMetadataSnippets", []) or []:
                        snippet_runs.extend(meta_snip.get("snippetText", {}).get("runs", []) or [])
                    desc = "".join(r.get("text", "") for r in snippet_runs).strip()

                    full_text = f"{title}. {desc}".strip() if desc else title
                    if not full_text:
                        continue

                    view_text = (vr.get("viewCountText") or {}).get("simpleText")
                    views = self._parse_view_count(view_text)
                    pub_label = (vr.get("publishedTimeText") or {}).get("simpleText")
                    published_at = self.parse_relative_time_iso(pub_label) or datetime.now(timezone.utc).isoformat()

                    seen_ids.add(video_id)
                    items.append({
                        "id": f"yt_{video_id}",
                        "provider": "youtube",
                        "author_name": author or "YouTube Channel",
                        "source_url": f"https://www.youtube.com/watch?v={video_id}",
                        "link_status": "verified_post",
                        "text": full_text,
                        "published_at": published_at,
                        "metrics": {"views": views} if views is not None else None,
                        "metrics_available": views is not None,
                        "is_demo": False,
                        "source": "local_enriched",
                    })
                    if len(items) >= limit:
                        break
                if len(items) >= limit:
                    break

            self._last_search_meta = {
                "engine_status": "ok" if items else "empty",
                "status_message": (
                    f"{len(items)} video YouTube terverifikasi ditemukan."
                    if items
                    else f"Tidak ditemukan video YouTube untuk '{clean_query}'."
                ),
                "raw_count": len(items),
            }
            return items
        except Exception as exc:
            self._last_search_meta = {
                "engine_status": "error",
                "status_message": f"Gagal menarik data YouTube: {str(exc)[:120]}",
                "raw_count": 0,
            }
            return []

