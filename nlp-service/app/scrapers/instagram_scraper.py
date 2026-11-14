import re
import html as html_lib
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from bs4 import BeautifulSoup
from curl_cffi import requests
from app.scrapers.base_scraper import BaseScraper


IG_ALLOWED_HOSTS = ("instagram.com", "www.instagram.com", "m.instagram.com")
IG_NON_USER_SEGMENTS = {"p", "reel", "reels", "tv", "explore", "stories", "accounts", "popular", "directory"}


class InstagramScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform="instagram")

    def _extract_post_match(self, url: str) -> Optional[Tuple[Optional[str], str, str]]:
        match = re.search(
            r"instagram\.com/(?:([a-zA-Z0-9_.]+)/)?(p|reel|reels|tv)/([a-zA-Z0-9_\-]{5,30})",
            url,
            flags=re.IGNORECASE,
        )
        if not match:
            return None
        maybe_user = match.group(1)
        media_type = match.group(2).lower()
        if media_type == "reels":
            media_type = "reel"
        shortcode = match.group(3)
        if maybe_user and maybe_user.lower() in IG_NON_USER_SEGMENTS:
            maybe_user = None
        return maybe_user, media_type, shortcode

    def _enrich_via_embed(self, media_type: str, shortcode: str) -> Tuple[Optional[Dict[str, Any]], int]:
        """Verify post existence and extract author/caption/comments via Instagram /embed/."""
        embed_url = f"https://www.instagram.com/{media_type}/{shortcode}/embed/"
        try:
            resp = requests.get(
                embed_url,
                headers=self.headers,
                impersonate="chrome120",
                timeout=7,
            )
            if resp.status_code != 200:
                return None, resp.status_code

            body = resp.text or ""
            lowered = body.lower()
            if "may have been removed" in lowered or "link you followed may be broken" in lowered:
                return None, 404

            has_media = "shortcode_media" in body
            if not has_media:
                # Try generic embed selector fallback before assuming dead
                soup_check = BeautifulSoup(body, "html.parser")
                if not soup_check.select_one(".UsernameText, .EmbeddedMediaImage, video"):
                    return None, 404

            unescaped = body.replace('\\"', '"').replace("\\\\", "\\")
            soup = BeautifulSoup(body, "html.parser")

            username = None
            uname_el = soup.select_one(".UsernameText")
            if uname_el and uname_el.get_text(strip=True):
                username = uname_el.get_text(strip=True).lstrip("@")
            if not username:
                m_user = re.search(r'"username"\s*:\s*"([a-zA-Z0-9_.]+)"', unescaped)
                if m_user:
                    username = m_user.group(1)

            caption = None
            cap_el = soup.select_one(".Caption")
            if cap_el:
                # Strip the leading username link inside .Caption if duplicated
                caption = cap_el.get_text(" ", strip=True)
            if not caption:
                m_cap = re.search(r'"edge_media_to_caption"\s*:\s*\{\s*"edges"\s*:\s*\[\s*\{\s*"node"\s*:\s*\{\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"', unescaped)
                if m_cap:
                    raw_cap = m_cap.group(1)
                    try:
                        caption = bytes(raw_cap, "utf-8").decode("unicode_escape")
                    except Exception:
                        caption = raw_cap

            comment_count = None
            m_com = re.search(r'"edge_media_to_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)', unescaped)
            if m_com:
                comment_count = int(m_com.group(1))

            like_count = None
            m_like = re.search(r'"edge_media_preview_like"\s*:\s*\{\s*"count"\s*:\s*(\d+)', unescaped)
            if m_like:
                like_count = int(m_like.group(1))

            timestamp_iso = None
            time_el = soup.select_one("time[datetime]")
            if time_el and time_el.get("datetime"):
                timestamp_iso = time_el.get("datetime")
            else:
                m_ts = re.search(r'"taken_at_timestamp"\s*:\s*(\d+)', unescaped)
                if m_ts:
                    timestamp_iso = datetime.fromtimestamp(int(m_ts.group(1)), tz=timezone.utc).isoformat()

            return {
                "username": username,
                "caption": html_lib.unescape(caption).strip() if caption else None,
                "comments": comment_count,
                "likes": like_count,
                "published_at": timestamp_iso,
            }, 200
        except Exception:
            return None, 0

    def scrape(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        raw_items = self.search_web_syndication(
            query,
            site_domain="instagram.com",
            limit=limit,
            extra_site_terms="(inurl:/p/ OR inurl:/reel/)",
        )
        if not raw_items:
            raw_items = self.search_web_syndication(query, site_domain="instagram.com", limit=limit)

        verified_items: List[Dict[str, Any]] = []
        fallback_items: List[Dict[str, Any]] = []
        seen_ids = set()

        for item in raw_items:
            url = item.get("url", "")
            # Reject invalid mirror/popular hosts even before canonical extraction
            if not self.is_target_domain(url, IG_ALLOWED_HOSTS) or "/popular/" in url.lower():
                continue

            post_info = self._extract_post_match(url)
            if post_info:
                url_user, media_type, shortcode = post_info
                if shortcode in seen_ids:
                    continue

                embed_data, status_code = self._enrich_via_embed(media_type, shortcode)
                if status_code == 404:
                    continue

                resolved_user = (embed_data or {}).get("username") or url_user
                author_name = f"@{resolved_user}" if resolved_user else "@instagram_creator"

                clean_ddg = re.sub(
                    r"(?:See Instagram photos and videos from|likes, comments -)\s*",
                    "",
                    item.get("text", ""),
                    flags=re.IGNORECASE,
                ).replace("...", "").strip()

                embed_cap = (embed_data or {}).get("caption") or ""
                final_text = embed_cap if len(embed_cap) >= len(clean_ddg) else clean_ddg
                if not final_text:
                    continue

                metrics: Dict[str, int] = {}
                if embed_data and embed_data.get("likes") is not None:
                    metrics["likes"] = embed_data["likes"]
                if embed_data and embed_data.get("comments") is not None:
                    metrics["comments"] = embed_data["comments"]

                seen_ids.add(shortcode)
                verified_items.append({
                    "id": f"ig_{shortcode}",
                    "provider": "instagram",
                    "author_name": author_name,
                    "source_url": f"https://www.instagram.com/{media_type}/{shortcode}/",
                    "link_status": "verified_post",
                    "text": final_text,
                    "published_at": (embed_data or {}).get("published_at")
                    or self.parse_relative_time_iso(item.get("age_hint"))
                    or datetime.now(timezone.utc).isoformat(),
                    "metrics": metrics if metrics else None,
                    "metrics_available": bool(metrics),
                    "is_demo": False,
                    "source": "local_enriched" if embed_data else "local_scraper",
                })
            else:
                # Target-domain non-post URL (profile/tag) maps to encoded IG search fallback
                clean_text = re.sub(
                    r"(?:See Instagram photos and videos from|Instagram photos and videos)\s*",
                    "",
                    item.get("text", ""),
                    flags=re.IGNORECASE,
                ).replace("...", "").strip()
                if not clean_text or len(clean_text) < 20:
                    continue
                user_match = re.search(r"instagram\.com/([a-zA-Z0-9_.]+)/?", url, flags=re.IGNORECASE)
                handle = (
                    f"@{user_match.group(1)}"
                    if user_match and user_match.group(1).lower() not in IG_NON_USER_SEGMENTS
                    else "Pencarian Instagram"
                )
                ext_id = f"ig_search_{hashlib.md5(url.encode()).hexdigest()[:16]}"
                if ext_id in seen_ids:
                    continue
                seen_ids.add(ext_id)
                fallback_items.append({
                    "id": ext_id,
                    "provider": "instagram",
                    "author_name": handle,
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
