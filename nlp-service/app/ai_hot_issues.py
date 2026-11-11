import json
import logging
import re
from typing import Dict, Any, List, Optional
from .nine_router import nine_router_client, NineRouterClient

logger = logging.getLogger("pulsescope.ai_hot_issues")

HOT_ISSUES_PROMPT = """Anda adalah analis intelijen media dan trending issue di PulseScope.
Tugas Anda adalah menganalisis headline berita terkini dari Google News Indonesia berikut dan mengekstrak 3 sampai 5 ISU PALING HANGAT / VIRAL / BREAKING NEWS yang sedang mendominasi perhatian publik saat ini.

Berikut daftar headline berita terkini:
{headlines_text}

Instruksi:
1. Kelompokkan berita yang membahas peristiwa yang sama menjadi satu kluster isu hangat.
2. Prioritaskan peristiwa besar seperti dinamika politik/pemerintahan (misal: pengunduran diri pejabat tinggi, pernyataan presiden/wapres, pergantian kabinet), krisis hukum, kebijakan fiskal/ekonomi, bencana nasional, atau peristiwa viral netizen yang mendominasi perhatian publik.
3. Untuk setiap kluster isu hangat, tentukan:
   - "name": Judul isu yang ringkas, jelas, dan baku (contoh: "Isu Pengunduran Diri Wapres Gibran", "Pernyataan Prabowo Terkait Isu Penyadapan").
   - "description": Ringkasan faktual 1-2 kalimat mengenai apa yang sedang terjadi dan mengapa ramai diperbincangkan.
   - "urgency_level": "critical" jika melibatkan krisis politik nasional, pejabat tertinggi negara, bencana darurat, atau gejolak keamanan; atau "elevated" jika isu hangat nasional umum.
   - "keywords": array 3-5 kata kunci pencarian bahasa Indonesia yang paling efektif untuk melacak sebutan isu ini di mesin pencari dan media sosial (contoh: ["gibran mundur", "pengunduran diri gibran", "wapres gibran"]).

Format keluaran WAJIB berupa JSON valid murni:
{
  "hot_issues": [
    {
      "name": "...",
      "description": "...",
      "urgency_level": "critical"|"elevated",
      "keywords": ["...", "..."]
    }
  ]
}
"""

def extract_hot_issues_from_headlines(
    headlines: List[Dict[str, str]],
    client: Optional[NineRouterClient] = None
) -> Dict[str, Any]:
    """
    Cluster and extract top breaking hot issues from a list of headlines using 9Router / Gemini AI.
    Falls back to intelligent heuristic extraction if AI is unavailable.
    """
    if not headlines:
        return {"hot_issues": [], "engine": "no-input"}

    # Format headlines list into prompt
    lines = []
    for i, h in enumerate(headlines[:40], start=1):
        title = h.get("title", "").strip()
        source = h.get("source", "").strip()
        lines.append(f"{i}. [{source}] {title}")
    
    headlines_text = "\n".join(lines)
    prompt = HOT_ISSUES_PROMPT.replace("{headlines_text}", headlines_text)

    router = client or nine_router_client
    messages = [
        {"role": "system", "content": "Anda adalah asisten AI ekstraksi tren dan intelijen berita. Keluarkan selalu format JSON valid."},
        {"role": "user", "content": prompt}
    ]

    try:
        res = router.chat_completion(messages=messages, temperature=0.2, max_tokens=1500)
        if res.get("success") and res.get("content"):
            content = res["content"].strip()
            # Clean markdown codeblocks
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
            parsed = json.loads(content)
            if "hot_issues" in parsed and isinstance(parsed["hot_issues"], list):
                valid_issues = []
                for item in parsed["hot_issues"]:
                    if item.get("name") and item.get("keywords"):
                        valid_issues.append({
                            "name": str(item["name"]).strip(),
                            "description": str(item.get("description", "")).strip(),
                            "urgency_level": "critical" if item.get("urgency_level") == "critical" else "elevated",
                            "keywords": [str(k).strip() for k in item["keywords"] if str(k).strip()],
                        })
                if valid_issues:
                    return {"hot_issues": valid_issues, "engine": "9router-gemini"}
    except Exception as e:
        logger.warning(f"Failed to extract hot issues via 9Router: {e}")

    # Intelligent Heuristic Fallback
    return _heuristic_hot_issues_extraction(headlines)

def _heuristic_hot_issues_extraction(headlines: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Fallback rule-based clustering if AI is offline.
    """
    issues = []
    seen_lead_words = set()

    critical_triggers = [
        "mundur", "pengunduran diri", "krisis", "darurat", "sadap", "penyadapan", 
        "korupsi", "ditangkap", "tersangka", "gempa", "tsunami", "meletus", "bentrok", "tewas"
    ]

    for h in headlines[:15]:
        raw_title = h.get("title", "")
        # Remove publisher suffix (e.g. - detikNews, - Kompas.com)
        clean_title = re.sub(r"\s*-\s*[^-\n]+$", "", raw_title).strip()
        if len(clean_title) < 15:
            continue

        lower_title = clean_title.lower()
        
        # Check critical urgency
        is_critical = any(trig in lower_title for trig in critical_triggers)

        # Extract main tokens to avoid duplicating the same story
        tokens = [w for w in re.findall(r"\b[a-zA-Z]{4,}\b", lower_title) if w not in {"yang", "dari", "pada", "untuk", "dengan", "dalam", "bisa", "akan", "juga"}]
        key_signature = " ".join(tokens[:3])
        if key_signature in seen_lead_words:
            continue
        seen_lead_words.add(key_signature)

        # Generate keywords
        keywords = [clean_title]
        if len(tokens) >= 2:
            keywords.append(f"{tokens[0]} {tokens[1]}")
        if len(tokens) >= 3:
            keywords.append(f"{tokens[0]} {tokens[2]}")

        issues.append({
            "name": clean_title,
            "description": f"Sorotan pemberitaan media dan lonjakan diskursus publik terkini mengenai '{clean_title}'.",
            "urgency_level": "critical" if is_critical else "elevated",
            "keywords": list(dict.fromkeys(keywords))[:4],
        })

        if len(issues) >= 5:
            break

    return {"hot_issues": issues, "engine": "heuristic-fallback"}
