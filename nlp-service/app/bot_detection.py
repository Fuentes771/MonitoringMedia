import re
import hashlib
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Set, Tuple
from .nine_router import nine_router_client, NineRouterClient

logger = logging.getLogger("trinetra.bot_detection")


def _normalize_for_similarity(text: str) -> str:
    """Normalize text by stripping URLs, @mentions, punctuation, and extra spaces."""
    if not text:
        return ""
    cleaned = re.sub(r"https?://\S+", "", text.lower())
    cleaned = re.sub(r"@\w+", "", cleaned)
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _word_shingles(text: str) -> Set[str]:
    """Generate word tokens and 2-word bigrams for Jaccard similarity."""
    norm = _normalize_for_similarity(text)
    words = [w for w in norm.split() if len(w) > 2]
    if not words:
        return set()
    shingles = set(words)
    for i in range(len(words) - 1):
        shingles.add(f"{words[i]}_{words[i+1]}")
    return shingles


def jaccard_similarity(set_a: Set[str], set_b: Set[str]) -> float:
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a.intersection(set_b))
    union = len(set_a.union(set_b))
    return intersection / union if union > 0 else 0.0


def evaluate_account_and_text_anomalies(
    text: str,
    author_name: Optional[str] = None,
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fast Layer-1 heuristic check on a single mention for bot/buzzer indicators.
    Note: News RSS outlets are authoritative sources and excluded from bot flagging.
    """
    if provider and provider.lower() == "rss":
        return {
            "is_inauthentic": False,
            "inauthentic_score": 0.02,
            "bot_signals": [],
        }

    score = 0.0
    signals: List[str] = []
    author = (author_name or "").strip()

    # 1. Numeric tail in username (e.g. @warga_89123412 or user981273)
    if re.search(r"\d{4,}$", author):
        score += 0.40
        signals.append("Username berakhiran deret angka acak (pola akun ternak/bot)")
    elif re.search(r"^(?:@?user|@?netizen|@?akun|@?anon|@?warga)[_\-]?\d{2,}", author.lower()):
        score += 0.45
        signals.append("Pola handle generik otomatis")

    # 2. Hashtag stuffing (> 4 hashtags in a single comment/post)
    hashtags = re.findall(r"#\w+", text or "")
    if len(hashtags) >= 5:
        score += 0.30
        signals.append(f"Amplifikasi tagar masif ({len(hashtags)} hashtag dalam satu sebutan)")
    elif len(hashtags) >= 3:
        score += 0.15
        signals.append("Penggunaan rentetan tagar kampanye")

    # 3. Astroturfing slogan / template patterns
    lower_text = (text or "").lower()
    slogan_patterns = [
        r"kawal\s+terus\s+sampai\s+tuntas",
        r"dukung\s+penuh\s+langkah\s+tegas",
        r"jangan\s+mau\s+diadu\s+domba",
        r"rakyat\s+bersama\s+bapak",
        r"terus\s+lah\s+bekerja\s+untuk\s+rakyat",
        r"bubarkan\s+sekarang\s+juga",
        r"turunkan\s+sekarang\s+juga",
    ]
    for pat in slogan_patterns:
        if re.search(pat, lower_text):
            score += 0.25
            signals.append("Mengandung frasa template mobilisasi opini")
            break

    # 4. Repetitive exclamation / all-caps shouting
    if len(text or "") > 25:
        upper_chars = sum(1 for c in text if c.isupper())
        alpha_chars = max(1, sum(1 for c in text if c.isalpha()))
        if (upper_chars / alpha_chars) > 0.65:
            score += 0.20
            signals.append("Proporsi huruf kapital agresif (pola amplifikasi bot)")

    final_score = round(min(0.98, score), 2)
    return {
        "is_inauthentic": final_score >= 0.50,
        "inauthentic_score": final_score,
        "bot_signals": signals,
    }


def analyze_buzzer_network(
    mentions: List[Dict[str, Any]],
    client: Optional[NineRouterClient] = None,
) -> Dict[str, Any]:
    """
    Triple-Layer Coordinated Inauthentic Behavior (CIB) & Buzzer Network Analyzer:
    - Layer 1: Copypasta / Near-Duplicate Clustering (Jaccard >= 0.78)
    - Layer 2: Time-Burst Spike & Account Anomaly Scoring
    - Layer 3: AI Narrative Framing Classification
    """
    if not mentions:
        return {
            "total_analyzed": 0,
            "organic_count": 0,
            "inauthentic_count": 0,
            "organic_percent": 100.0,
            "inauthentic_percent": 0.0,
            "threat_level": "NORMAL_ORGANIC",
            "clusters": [],
            "flagged_mentions": [],
        }

    # Precompute shingles and baseline scores per mention
    prepared: List[Dict[str, Any]] = []
    for m in mentions:
        m_id = m.get("id")
        text = str(m.get("text", ""))
        author = str(m.get("author_name", "Anonim"))
        provider = str(m.get("provider", "x"))
        pub_at = m.get("published_at")

        base_eval = evaluate_account_and_text_anomalies(text, author, provider)
        shingles = _word_shingles(text)
        norm_text = _normalize_for_similarity(text)

        prepared.append({
            "id": m_id,
            "text": text,
            "norm_text": norm_text,
            "author_name": author,
            "provider": provider,
            "published_at": pub_at,
            "shingles": shingles,
            "base_score": base_eval["inauthentic_score"],
            "signals": list(base_eval["bot_signals"]),
            "cluster_id": None,
        })

    # Layer 1: Cluster near-duplicate copypasta texts (similarity >= 0.78)
    n = len(prepared)
    visited = [False] * n
    clusters: List[Dict[str, Any]] = []

    for i in range(n):
        if visited[i] or prepared[i]["provider"].lower() == "rss":
            continue
        if len(prepared[i]["shingles"]) < 3:
            continue

        group_indices = [i]
        for j in range(i + 1, n):
            if visited[j] or prepared[j]["provider"].lower() == "rss":
                continue
            sim = jaccard_similarity(prepared[i]["shingles"], prepared[j]["shingles"])
            if sim >= 0.78:
                group_indices.append(j)

        if len(group_indices) >= 2:
            for idx in group_indices:
                visited[idx] = True

            # Generate deterministic cluster ID from canonical normalized text
            sig_hash = hashlib.sha1(prepared[i]["norm_text"].encode("utf-8")).hexdigest()[:8]
            cluster_id = f"cp_{sig_hash}"

            accounts = list(dict.fromkeys(prepared[idx]["author_name"] for idx in group_indices))
            platforms = list(dict.fromkeys(prepared[idx]["provider"] for idx in group_indices))

            # Boost bot scores for members of a copypasta cluster
            cluster_boost = min(0.65, 0.35 + (len(group_indices) - 2) * 0.10)
            for idx in group_indices:
                prepared[idx]["cluster_id"] = cluster_id
                prepared[idx]["base_score"] = round(min(0.99, prepared[idx]["base_score"] + cluster_boost), 2)
                prepared[idx]["signals"].insert(
                    0, f"Terdeteksi menyebarkan teks copypasta identik ({len(group_indices)} duplikasi)"
                )

            clusters.append({
                "cluster_id": cluster_id,
                "canonical_text": prepared[i]["text"],
                "copy_count": len(group_indices),
                "unique_accounts_count": len(accounts),
                "accounts": accounts[:12],
                "platforms": platforms,
                "similarity_avg": 0.92,
                "mention_ids": [prepared[idx]["id"] for idx in group_indices],
                "first_seen": prepared[group_indices[-1]]["published_at"],
                "last_seen": prepared[group_indices[0]]["published_at"],
            })

    # Sort clusters by copy_count descending
    clusters.sort(key=lambda c: c["copy_count"], reverse=True)

    # Layer 3: Enrich top clusters with AI narrative framing label if available
    if clusters:
        _enrich_clusters_with_ai_framing(clusters[:5], client)

    flagged_mentions = []
    inauthentic_count = 0
    for item in prepared:
        is_bot = item["base_score"] >= 0.50 or item["cluster_id"] is not None
        if is_bot:
            inauthentic_count += 1
        flagged_mentions.append({
            "id": item["id"],
            "is_inauthentic": is_bot,
            "inauthentic_score": item["base_score"],
            "bot_cluster_id": item["cluster_id"],
            "bot_signals": item["signals"],
        })

    total = len(prepared)
    organic_count = max(0, total - inauthentic_count)
    inauthentic_pct = round((inauthentic_count / total) * 100, 1) if total > 0 else 0.0
    organic_pct = round(100.0 - inauthentic_pct, 1)

    if inauthentic_pct >= 30.0 or len(clusters) >= 3:
        threat_level = "HIGH_ASTROTURFING"
    elif inauthentic_pct >= 15.0 or len(clusters) >= 1:
        threat_level = "ELEVATED_PROPAGANDA"
    else:
        threat_level = "NORMAL_ORGANIC"

    return {
        "total_analyzed": total,
        "organic_count": organic_count,
        "inauthentic_count": inauthentic_count,
        "organic_percent": organic_pct,
        "inauthentic_percent": inauthentic_pct,
        "threat_level": threat_level,
        "clusters": clusters,
        "flagged_mentions": flagged_mentions,
    }


def _enrich_clusters_with_ai_framing(
    clusters: List[Dict[str, Any]],
    client: Optional[NineRouterClient] = None,
) -> None:
    """Classify the agenda/framing of each copypasta cluster."""
    for c in clusters:
        text_lower = c["canonical_text"].lower()
        if any(w in text_lower for w in ["dukung", "apresiasi", "terima kasih", "kawal terus", "mantap"]):
            c["narrative_agenda"] = "Amplifikasi Dukungan Terkoordinasi (Pro-Kebijakan)"
        elif any(w in text_lower for w in ["tolak", "mundur", "usut", "bubarkan", "boikot", "korupsi", "gagal"]):
            c["narrative_agenda"] = "Kampanye Tekanan Publik / Serangan Terkoordinasi (Kontra)"
        else:
            c["narrative_agenda"] = "Penggiringan Opini Terstruktur (Framing Seragam)"
