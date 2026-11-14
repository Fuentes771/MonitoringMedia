import re
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from curl_cffi import requests
from app.scrapers.base_scraper import BaseScraper


X_ALLOWED_HOSTS = ("x.com", "twitter.com", "mobile.twitter.com")
X_NON_USER_PATHS = {"i", "search", "hashtag", "explore", "home", "login", "intent", "compose", "settings", "privacy", "tos"}


class XScraper(BaseScraper):
    def __init__(self):
        super().__init__(platform="x")

    def _extract_status_match(self, url: str) -> Optional[Tuple[str, str]]:
        match = re.search(
            r"(?:x\.com|twitter\.com)/([a-zA-Z0-9_]{1,30})/status/(\d{15,22})",
            url,
            flags=re.IGNORECASE,
        )
        if not match:
            return None
        handle = match.group(1)
        if handle.lower() in X_NON_USER_PATHS:
            return None
        return handle, match.group(2)

    def _fetch_syndication_tweet(self, tweet_id: str) -> Tuple[Optional[Dict[str, Any]], int]:
        """Fetch live tweet metadata from X's public syndication endpoint."""
        try:
            resp = requests.get(
                f"https://cdn.syndication.twimg.com/tweet-result?id={tweet_id}&token=x",
                headers={"Accept": "application/json"},
                impersonate="chrome120",
                timeout=6,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, dict) and data.get("__typename") in ("Tweet", "TweetTombstone"):
                    if data.get("__typename") == "TweetTombstone":
                        return None, 404
                    return data, 200
            return None, resp.status_code
        except Exception:
            return None, 0

    def _fetch_oembed_author(self, canonical_url: str) -> Tuple[Optional[str], int]:
        """Backup reachability check when syndication endpoint throttles."""
        try:
            resp = requests.get(
                f"https://publish.twitter.com/oembed?url={canonical_url}",
                headers={"Accept": "application/json"},
                impersonate="chrome120",
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("author_name"), 200
            return None, resp.status_code
        except Exception:
            return None, 0

    def scrape(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        raw_items = self.search_web_syndication(
            query,
            site_domain="x.com",
            limit=limit,
            extra_site_terms="status",
        )
        if not raw_items:
            raw_items = self.search_web_syndication(query, site_domain="x.com", limit=limit)

        verified_items: List[Dict[str, Any]] = []
        fallback_items: List[Dict[str, Any]] = []
        seen_ids = set()

        for item in raw_items:
            url = item.get("url", "")
            if not self.is_target_domain(url, X_ALLOWED_HOSTS):
                continue

            status_info = self._extract_status_match(url)
            if status_info:
                raw_handle, tweet_id = status_info
                if tweet_id in seen_ids:
                    continue

                snowflake_ts = self.parse_x_snowflake_iso(tweet_id)
                if not snowflake_ts:
                    # Reject fabricated non-snowflake status IDs
                    continue

                synd_data, synd_code = self._fetch_syndication_tweet(tweet_id)
                if synd_code == 404:
                    # Confirmed deleted or non-existent tweet
                    continue

                if synd_data:
                    user = synd_data.get("user") or {}
                    screen_name = user.get("screen_name") or raw_handle
                    display_name = user.get("name") or f"@{screen_name}"
                    author_label = f"{display_name} (@{screen_name})" if display_name != f"@{screen_name}" else f"@{screen_name}"
                    canonical_url = f"https://x.com/{screen_name}/status/{tweet_id}"
                    tweet_text = (synd_data.get("text") or item.get("text") or "").strip()
                    published_at = synd_data.get("created_at") or snowflake_ts
                    metrics = {
                        "likes": int(synd_data.get("favorite_count") or 0),
                        "comments": int(synd_data.get("conversation_count") or 0),
                    }
                    if synd_data.get("retweet_count") is not None:
                        metrics["shares"] = int(synd_data.get("retweet_count") or 0)
                    metrics_available = True
                else:
                    canonical_url = f"https://x.com/{raw_handle}/status/{tweet_id}"
                    oembed_author, oembed_code = self._fetch_oembed_author(canonical_url)
                    if oembed_code == 404:
                        continue
                    author_label = f"{oembed_author} (@{raw_handle})" if oembed_author else f"@{raw_handle}"
                    tweet_text = re.sub(r"^(.*?)\s*on X:\s*", "", item.get("text", ""), flags=re.IGNORECASE)
                    tweet_text = tweet_text.replace("...", "").strip()
                    published_at = snowflake_ts
                    metrics = None
                    metrics_available = False

                if not tweet_text:
                    continue

                seen_ids.add(tweet_id)
                verified_items.append({
                    "id": f"x_{tweet_id}",
                    "provider": "x",
                    "author_name": author_label,
                    "author_handle": f"@{raw_handle}",
                    "source_url": canonical_url,
                    "link_status": "verified_post",
                    "text": tweet_text,
                    "published_at": published_at,
                    "metrics": metrics,
                    "metrics_available": metrics_available,
                    "is_comment": bool(synd_data and synd_data.get("parent")),
                    "parent_external_id": (
                        f"x_{synd_data['parent'].get('id_str')}"
                        if synd_data and isinstance(synd_data.get("parent"), dict) and synd_data["parent"].get("id_str")
                        else None
                    ),
                    "is_demo": False,
                    "source": "local_enriched" if synd_data else "local_scraper",
                })
            else:
                # Target-domain non-post result (profile or hashtag) becomes an encoded search link
                clean_text = re.sub(r"^(.*?)\s*on X:\s*", "", item.get("text", ""), flags=re.IGNORECASE)
                clean_text = clean_text.replace("...", "").strip()
                if not clean_text or len(clean_text) < 20:
                    continue
                user_match = re.search(r"(?:x\.com|twitter\.com)/([a-zA-Z0-9_]{1,30})", url, flags=re.IGNORECASE)
                handle = user_match.group(1) if user_match and user_match.group(1).lower() not in X_NON_USER_PATHS else "x_search"
                ext_id = f"x_search_{hashlib.md5(url.encode()).hexdigest()[:16]}"
                if ext_id in seen_ids:
                    continue
                seen_ids.add(ext_id)
                fallback_items.append({
                    "id": ext_id,
                    "provider": "x",
                    "author_name": f"@{handle}",
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
