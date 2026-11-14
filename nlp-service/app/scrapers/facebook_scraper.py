import re
import html as html_lib
import hashlib
import urllib.parse
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from curl_cffi import requests
from app.scrapers.base_scraper import BaseScraper


FB_ALLOWED_HOSTS = ("facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch")
FB_KEEP_PARAMS = {"id", "story_fbid", "fbid", "v", "set"}
FB_NON_AUTHOR_SEGMENTS = {"reel", "watch", "share", "groups", "permalink.php", "story.php", "photo.php", "posts", "videos", "search"}


class FacebookScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform="facebook")

    def _normalize_fb_url(self, url: str) -> str:
        clean = self.strip_tracking_params(url, keep_params=FB_KEEP_PARAMS)
        parsed = urllib.parse.urlparse(clean)
        host = (parsed.hostname or "").lower()
        if host in ("m.facebook.com", "web.facebook.com", "facebook.com"):
            return urllib.parse.urlunparse(("https", "www.facebook.com", parsed.path, "", parsed.query, ""))
        return clean

    def _extract_canonical_post(self, url: str) -> Optional[Tuple[Optional[str], str]]:
        """Check whether a Facebook URL targets a specific post, reel, or video."""
        patterns = [
            r"facebook\.com/([^/?#]+)/(?:posts|videos)/([a-zA-Z0-9_.\-]+)",
            r"facebook\.com/groups/([^/?#]+)/(?:posts|permalink)/([a-zA-Z0-9_.\-]+)",
            r"facebook\.com/(reel)/(\d+)",
            r"facebook\.com/(watch)/?\?(?:[^#]*&)?v=(\d+)",
            r"facebook\.com/(permalink\.php|story\.php)\?.*story_fbid=([a-zA-Z0-9_.\-]+)",
            r"facebook\.com/share/(?:p|r|v)/([a-zA-Z0-9_\-]+)",
            r"fb\.watch/([a-zA-Z0-9_\-]+)",
        ]
        for pat in patterns:
            m = re.search(pat, url, flags=re.IGNORECASE)
            if m:
                if len(m.groups()) == 1:
                    return None, m.group(1)
                grp1, grp2 = m.group(1), m.group(2)
                author = None if grp1.lower() in FB_NON_AUTHOR_SEGMENTS else grp1
                return author, grp2
        return None

    def _verify_live_post(self, canonical_url: str) -> Tuple[Optional[str], int]:
        """Confirm public reachability and parse og:title post text when exposed."""
        try:
            resp = requests.get(
                canonical_url,
                headers=self.headers,
                impersonate="chrome120",
                allow_redirects=True,
                timeout=7,
            )
            if resp.status_code == 404:
                return None, 404
            if resp.status_code != 200:
                return None, resp.status_code

            body = resp.text or ""
            lowered = body.lower()
            if "this content isn't available" in lowered or "konten ini tidak tersedia" in lowered:
                return None, 404

            og_match = re.search(r'<meta\s+property="og:title"\s+content="([^"]*)"', body, flags=re.IGNORECASE)
            if not og_match:
                og_match = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', body, flags=re.IGNORECASE)

            if og_match and og_match.group(1).strip():
                title_val = html_lib.unescape(og_match.group(1)).strip()
                if title_val.lower() not in ("facebook", "log into facebook", "masuk ke facebook"):
                    return title_val, 200

            # Facebook dead post links frequently return HTTP 200 without any og:title
            return None, 422
        except Exception:
            return None, 0

    def scrape(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        raw_items = self.search_web_syndication(
            query,
            site_domain="facebook.com",
            limit=limit,
            extra_site_terms="(inurl:/posts/ OR inurl:/reel/ OR inurl:/videos/)",
        )
        if not raw_items:
            raw_items = self.search_web_syndication(query, site_domain="facebook.com", limit=limit)

        verified_items: List[Dict[str, Any]] = []
        fallback_items: List[Dict[str, Any]] = []
        seen_ids = set()

        for item in raw_items:
            raw_url = item.get("url", "")
            if not self.is_target_domain(raw_url, FB_ALLOWED_HOSTS):
                continue

            norm_url = self._normalize_fb_url(raw_url)
            post_info = self._extract_canonical_post(norm_url)

            if post_info:
                slug_author, post_id = post_info
                if post_id in seen_ids:
                    continue

                og_text, http_code = self._verify_live_post(norm_url)
                if http_code in (404, 422):
                    continue

                clean_ddg = re.sub(r"(?:Log in or sign up to view|Facebook)\s*", "", item.get("text", ""), flags=re.IGNORECASE)
                clean_ddg = clean_ddg.replace("...", "").strip()
                final_text = og_text if (og_text and len(og_text) >= len(clean_ddg)) else clean_ddg
                if not final_text:
                    continue

                author_name = slug_author.replace(".", " ").title() if slug_author else "Pengguna Facebook"
                seen_ids.add(post_id)
                verified_items.append({
                    "id": f"fb_{post_id}",
                    "provider": "facebook",
                    "author_name": author_name,
                    "source_url": norm_url,
                    "link_status": "verified_post",
                    "text": final_text,
                    "published_at": self.parse_relative_time_iso(item.get("age_hint")) or datetime.now(timezone.utc).isoformat(),
                    "metrics": None,
                    "metrics_available": False,
                    "is_demo": False,
                    "source": "local_enriched" if og_text else "local_scraper",
                })
            else:
                # Non-post Facebook domain hits (e.g. groups or page home) become encoded search fallback
                clean_text = re.sub(r"(?:Log in or sign up to view|Facebook)\s*", "", item.get("text", ""), flags=re.IGNORECASE)
                clean_text = clean_text.replace("...", "").strip()
                if not clean_text or len(clean_text) < 20:
                    continue

                group_match = re.search(r"facebook\.com/groups/([^/?#]+)", norm_url, flags=re.IGNORECASE)
                author_name = f"Komunitas Facebook ({group_match.group(1)[:18]})" if group_match else "Pencarian Facebook"
                ext_id = f"fb_search_{hashlib.md5(norm_url.encode()).hexdigest()[:16]}"
                if ext_id in seen_ids:
                    continue
                seen_ids.add(ext_id)
                fallback_items.append({
                    "id": ext_id,
                    "provider": "facebook",
                    "author_name": author_name,
                    "source_url": self.build_search_fallback_url(query),
                    "original_discovered_url": norm_url,
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
