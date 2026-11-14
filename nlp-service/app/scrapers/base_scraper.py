import re
import time
import random
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple, Set
from bs4 import BeautifulSoup
from curl_cffi import requests


TWITTER_EPOCH_MS = 1288834974657


class BaseScraper:
    """Base HTTP scraper with domain guards, canonical URL encoding, and search telemetry."""

    def __init__(self, platform: str):
        self.platform = platform
        self.headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Upgrade-Insecure-Requests": "1",
        }
        self._last_search_meta: Dict[str, Any] = {
            "engine_status": "idle",
            "status_message": "",
            "raw_count": 0,
        }

    def decode_ddg_url(self, raw_href: str) -> str:
        """Decode DuckDuckGo redirect link to canonical destination URL."""
        if not raw_href:
            return ""
        if "uddg=" in raw_href:
            match = re.search(r"uddg=([^&]+)", raw_href)
            if match:
                try:
                    return urllib.parse.unquote(match.group(1))
                except Exception:
                    pass
        if raw_href.startswith("//"):
            return "https:" + raw_href
        return raw_href

    def is_target_domain(self, url: str, allowed_hosts: Tuple[str, ...]) -> bool:
        """Verify URL hostname strictly belongs to an allowed platform host."""
        if not url:
            return False
        try:
            parsed = urllib.parse.urlparse(url.strip())
            host = (parsed.hostname or "").lower()
            if not host or "fallback." in host:
                return False
            return any(host == h or host.endswith(f".{h}") for h in allowed_hosts)
        except Exception:
            return False

    def strip_tracking_params(self, url: str, keep_params: Optional[Set[str]] = None) -> str:
        """Remove tracking parameters while preserving essential identity params."""
        try:
            parsed = urllib.parse.urlparse(url.strip())
            if not parsed.scheme or not parsed.netloc:
                return url.strip()
            query_items = urllib.parse.parse_qsl(parsed.query, keep_blank_values=False)
            if keep_params is not None:
                filtered = [(k, v) for k, v in query_items if k in keep_params]
            else:
                tracking_prefixes = ("utm_", "fbclid", "igshid", "igsh", "s", "t", "ref", "__tn__", "mibextid")
                filtered = [
                    (k, v)
                    for k, v in query_items
                    if not any(k.lower() == p or k.lower().startswith(p) for p in tracking_prefixes)
                ]
            new_query = urllib.parse.urlencode(filtered, doseq=True)
            return urllib.parse.urlunparse((
                "https",
                parsed.netloc.lower(),
                parsed.path,
                "",
                new_query,
                "",
            ))
        except Exception:
            return url.strip()

    def build_search_fallback_url(self, query: str) -> str:
        """Build a properly URL-encoded platform search URL for unverified fallback results."""
        q = urllib.parse.quote_plus((query or "").strip())
        if self.platform == "x":
            return f"https://x.com/search?q={q}&f=live"
        if self.platform == "tiktok":
            return f"https://www.tiktok.com/search?q={q}"
        if self.platform == "instagram":
            return f"https://www.instagram.com/explore/search/keyword/?q={q}"
        if self.platform == "facebook":
            return f"https://www.facebook.com/search/posts/?q={q}"
        if self.platform == "youtube":
            return f"https://www.youtube.com/results?search_query={q}"
        return f"https://www.google.com/search?q={q}"

    def parse_x_snowflake_iso(self, status_id: str) -> Optional[str]:
        """Decode exact UTC ISO-8601 timestamp from an X/Twitter Snowflake ID."""
        try:
            sid = int(status_id)
            ts_ms = (sid >> 22) + TWITTER_EPOCH_MS
            dt = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc)
            if dt.year < 2012 or dt > datetime.now(timezone.utc) + timedelta(days=2):
                return None
            return dt.isoformat()
        except Exception:
            return None

    def parse_tiktok_snowflake_iso(self, video_id: str) -> Optional[str]:
        """Decode exact UTC ISO-8601 timestamp from a TikTok 64-bit video ID."""
        try:
            vid = int(video_id)
            ts_sec = vid >> 32
            dt = datetime.fromtimestamp(ts_sec, tz=timezone.utc)
            if dt.year < 2016 or dt > datetime.now(timezone.utc) + timedelta(days=2):
                return None
            return dt.isoformat()
        except Exception:
            return None

    def parse_relative_time_iso(self, label: Optional[str]) -> Optional[str]:
        """Parse English/Indonesian relative age text (e.g. '2 hari lalu', '8mo ago') into ISO UTC."""
        if not label:
            return None
        text = label.strip().lower()
        now = datetime.now(timezone.utc)
        match = re.search(r"(\d+)\s*(s|sec|second|detik|m|min|minute|menit|h|hr|hour|jam|d|day|hari|w|wk|week|minggu|mo|month|bulan|y|yr|year|tahun)", text)
        if not match:
            return None
        val = int(match.group(1))
        unit = match.group(2)
        if unit in ("s", "sec", "second", "detik"):
            dt = now - timedelta(seconds=val)
        elif unit in ("m", "min", "minute", "menit"):
            dt = now - timedelta(minutes=val)
        elif unit in ("h", "hr", "hour", "jam"):
            dt = now - timedelta(hours=val)
        elif unit in ("d", "day", "hari"):
            dt = now - timedelta(days=val)
        elif unit in ("w", "wk", "week", "minggu"):
            dt = now - timedelta(weeks=val)
        elif unit in ("mo", "month", "bulan"):
            dt = now - timedelta(days=val * 30)
        elif unit in ("y", "yr", "year", "tahun"):
            dt = now - timedelta(days=val * 365)
        else:
            return None
        return dt.isoformat()

    def _run_ddg_query(self, search_query: str) -> Tuple[int, str]:
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(search_query)}&kl=id-id"
        resp = requests.get(
            url,
            headers=self.headers,
            impersonate="chrome120",
            timeout=10,
        )
        return resp.status_code, resp.text or ""

    def search_web_syndication(
        self,
        query: str,
        site_domain: str,
        limit: int = 10,
        extra_site_terms: str = "",
    ) -> List[Dict[str, Any]]:
        """
        Query DuckDuckGo HTML strictly scoped to site_domain so foreign sites never pollute results.
        Never synthesizes fake posts or /post/<hash> URLs if search returns empty.
        """
        clean_query = re.sub(r"\s+", " ", (query or "").strip())
        if not clean_query:
            self._last_search_meta = {
                "engine_status": "empty",
                "status_message": "Query pencarian kosong.",
                "raw_count": 0,
            }
            return []

        primary_q = f"site:{site_domain} {extra_site_terms} {clean_query}".strip()
        fallback_q = f"site:{site_domain} {clean_query}".strip()

        attempts = [primary_q]
        if fallback_q != primary_q:
            attempts.append(fallback_q)
        else:
            # Strip punctuation and quote focus terms while still locking to site_domain
            words = [w for w in re.sub(r"[^\w\s]", " ", clean_query).split() if len(w) > 1]
            if words:
                focused_q = f"site:{site_domain} " + " ".join(words[:4])
                if focused_q != primary_q:
                    attempts.append(focused_q)

        last_status = 0
        for idx, q_str in enumerate(attempts):
            try:
                if idx > 0:
                    time.sleep(random.uniform(0.25, 0.55))
                status_code, html = self._run_ddg_query(q_str)
                last_status = status_code

                # DDG anti-bot anomaly page or throttling (202/403/429 or challenge form)
                is_challenge = (
                    status_code in (202, 403, 429)
                    or "anomaly-modal" in html
                    or "challenge-form" in html
                    or len(html) < 500
                )
                if status_code != 200 or is_challenge:
                    continue

                soup = BeautifulSoup(html, "html.parser")
                results: List[Dict[str, Any]] = []
                snippets = soup.select(".result__snippet")
                anchors = soup.select(".result__title a")

                count = min(len(snippets), len(anchors), limit * 3)
                for i in range(count):
                    raw_href = anchors[i].get("href", "")
                    dest_url = self.decode_ddg_url(raw_href)
                    if not dest_url or "fallback." in dest_url:
                        continue

                    snippet_text = snippets[i].get_text(" ", strip=True)
                    title_text = anchors[i].get_text(" ", strip=True)
                    full_text = f"{title_text}. {snippet_text}".strip()
                    if not full_text or len(full_text) < 12:
                        continue

                    date_el = None
                    parent_res = anchors[i].find_parent(class_="result")
                    if parent_res:
                        date_el = parent_res.select_one(".result__timestamp, .result__extras__url")

                    results.append({
                        "url": dest_url,
                        "text": full_text,
                        "title": title_text,
                        "snippet": snippet_text,
                        "age_hint": date_el.get_text(" ", strip=True) if date_el else "",
                    })

                if results:
                    self._last_search_meta = {
                        "engine_status": "ok",
                        "status_message": f"{len(results)} kandidat ditemukan pada indeks {site_domain}.",
                        "raw_count": len(results),
                    }
                    return results
            except Exception as exc:
                self._last_search_meta = {
                    "engine_status": "error",
                    "status_message": f"Gagal mengakses indeks pencarian {site_domain}: {str(exc)[:120]}",
                    "raw_count": 0,
                }
                continue

        if last_status in (202, 403, 429):
            self._last_search_meta = {
                "engine_status": "rate_limited",
                "status_message": f"Indeks pencarian sementara membatasi permintaan untuk {site_domain} (HTTP {last_status}). Coba beberapa saat lagi atau gunakan RapidAPI.",
                "raw_count": 0,
            }
        else:
            self._last_search_meta = {
                "engine_status": "empty",
                "status_message": f"Tidak ditemukan postingan terindeks pada {site_domain} untuk kueri '{clean_query}'.",
                "raw_count": 0,
            }
        return []

    def scrape(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def scrape_with_meta(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """Run scrape() and summarize verified vs search-fallback counts for diagnostics."""
        items = self.scrape(query=query, limit=limit)
        verified_count = sum(1 for it in items if it.get("link_status") == "verified_post")
        fallback_count = sum(1 for it in items if it.get("link_status") == "search_fallback")

        meta = dict(self._last_search_meta)
        if items:
            if verified_count > 0 and fallback_count == 0:
                meta["engine_status"] = "ok"
                meta["status_message"] = f"{verified_count} tautan postingan terverifikasi."
            elif verified_count > 0:
                meta["engine_status"] = "partial_fallback"
                meta["status_message"] = f"{verified_count} tautan postingan terverifikasi, {fallback_count} tautan pencarian."
            else:
                meta["engine_status"] = "search_fallback_only"
                meta["status_message"] = f"{fallback_count} hasil memakai tautan pencarian platform (perlu verifikasi)."

        return {
            "items": items,
            "verified_count": verified_count,
            "fallback_count": fallback_count,
            "engine_status": meta.get("engine_status", "empty"),
            "status_message": meta.get("status_message", ""),
        }
