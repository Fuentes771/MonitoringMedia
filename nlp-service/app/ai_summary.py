import json
import logging
import re
from typing import Dict, Any, List, Optional
from .nine_router import nine_router_client, NineRouterClient

logger = logging.getLogger("pulsescope.ai_summary")

TOPIC_SUMMARY_PROMPT = """Anda adalah analis intelijen media senior di PulseScope.
Tugas Anda adalah membuat 'Executive Intelligence Briefing' mengenai persepsi publik dan pemberitaan terkini terkait topik program prioritas pemerintah: "{topic_name}".

Anda DIBERIKAN kumpulan data sebutan (mentions) berita dan media sosial yang tersimpan dalam sistem.
Analisis kumpulan data tersebut dan sajikan ringkasan eksekutif terstruktur dalam format JSON:
{
  "topic_name": "{topic_name}",
  "mentions_analyzed": {count},
  "executive_overview": "Ringkasan situasi 1-2 paragraf mengenai apa yang sedang diperbincangkan publik/media secara faktual berdasarkan data.",
  "dominant_sentiment": "positive"|"neutral"|"negative"|"mixed",
  "key_positive_themes": ["poin positif 1", "poin positif 2"],
  "key_critical_themes": ["isu/kekhawatiran/keluhan 1", "isu 2"],
  "geographic_or_sector_notes": "Catatan wilayah atau sektor spesifik jika ditemukan dalam data sebutan.",
  "strategic_recommendations": ["rekomendasi komunikasi publik atau mitigasi isu 1", "rekomendasi 2"]
}

PENTING:
- Hanya gunakan fakta dan tema yang benar-benar ada dalam data sebutan yang diberikan.
- Format keluaran WAJIB berupa JSON valid murni tanpa teks pengantar di luar JSON.
"""

def summarize_mention(
    text: str,
    client: Optional[NineRouterClient] = None
) -> Dict[str, Any]:
    """
    Summarize a single news or social media item into 1-2 concise sentences.
    """
    if not text or len(text.strip()) < 20:
        return {"summary": text.strip(), "engine": "pass-through"}

    router = client or nine_router_client
    messages = [
        {
            "role": "system",
            "content": "Anda adalah asisten peringkas berita PulseScope. Buat ringkasan 1-2 kalimat bahasa Indonesia yang padat dan informatif dari teks berikut."
        },
        {"role": "user", "content": text[:1500]}
    ]

    res = router.chat_completion(messages=messages, temperature=0.2, max_tokens=120)
    if res.get("success") and res.get("content"):
        return {"summary": res["content"].strip(), "engine": "9router-ai"}

    # Fallback heuristic summary
    first_sentence = text.split(".")[0].strip()
    return {"summary": (first_sentence + ".") if first_sentence else text[:150], "engine": "fallback-extractive"}

def summarize_topic(
    topic_name: str,
    mentions: List[Dict[str, Any]],
    client: Optional[NineRouterClient] = None
) -> Dict[str, Any]:
    """
    Generate an Executive Intelligence Briefing across recent mentions for a monitored program.
    """
    if not mentions:
        return {
            "topic_name": topic_name,
            "mentions_analyzed": 0,
            "executive_overview": f"Belum ada data sebutan publik yang terkumpul untuk topik '{topic_name}'. Silakan lakukan sinkronisasi sumber berita terlebih dahulu.",
            "dominant_sentiment": "neutral",
            "key_positive_themes": [],
            "key_critical_themes": [],
            "geographic_or_sector_notes": "-",
            "strategic_recommendations": ["Lakukan ingest data berita/medsos untuk topik ini."],
            "engine": "no-data"
        }

    router = client or nine_router_client

    # Build compact context from mentions
    context_lines = []
    pos_count = 0
    neg_count = 0
    neu_count = 0

    for i, m in enumerate(mentions[:30], 1):
        txt = m.get("text", "")[:250].replace("\n", " ")
        author = m.get("author_name") or m.get("source_url") or "Media Publik"
        sent = m.get("sentiment") or "neutral"
        if sent == "positive":
            pos_count += 1
        elif sent == "negative":
            neg_count += 1
        else:
            neu_count += 1
        date = m.get("published_at", "")
        context_lines.append(f"[{i}] ({sent.upper()} - {author} - {date}): {txt}")

    mentions_payload = "\n".join(context_lines)

    system_prompt = TOPIC_SUMMARY_PROMPT.replace("{topic_name}", topic_name).replace("{count}", str(len(mentions)))
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Berikut daftar sebutan terkini ({len(mentions)} items):\n{mentions_payload}"}
    ]

    res = router.chat_completion(
        messages=messages,
        temperature=0.2,
        max_tokens=800,
        json_mode=True
    )

    if res.get("success") and res.get("content"):
        content = res["content"].strip()
        try:
            if content.startswith("```"):
                lines = content.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                content = "\n".join(lines).strip()
            parsed = json.loads(content)
            parsed["engine"] = "9router-ai"
            parsed["model"] = res.get("model")
            return parsed
        except Exception as err:
            logger.warning(f"Failed to parse topic summary JSON: {err}. Raw: {content[:200]}")

    # Fallback rule-based digest if 9router unavailable
    dominant = "neutral"
    if pos_count > neg_count and pos_count > neu_count:
        dominant = "positive"
    elif neg_count > pos_count and neg_count > neu_count:
        dominant = "negative"
    elif pos_count > 0 and neg_count > 0:
        dominant = "mixed"

    return {
        "topic_name": topic_name,
        "mentions_analyzed": len(mentions),
        "executive_overview": f"Berdasarkan analisis {len(mentions)} sebutan untuk '{topic_name}', sentimen publik didominasi oleh kecenderungan {dominant} ({pos_count} positif, {neu_count} netral, {neg_count} negatif).",
        "dominant_sentiment": dominant,
        "key_positive_themes": [f"{pos_count} pemberitaan mengapresiasi implementasi awal program"],
        "key_critical_themes": [f"{neg_count} pemberitaan menyoroti kendala teknis atau tantangan anggaran"],
        "geographic_or_sector_notes": "Data dihimpun dari feed RSS berita publik.",
        "strategic_recommendations": [
            "Tingkatkan amplifikasi capaian program pada kanal media utama.",
            "Lakukan klarifikasi segera terhadap isu kritis yang muncul."
        ],
        "engine": "local-fallback"
    }

def summarize_daily_window(
    mentions: List[Dict[str, Any]],
    window_label: str = "33 jam terakhir",
    client: Optional[NineRouterClient] = None
) -> Dict[str, Any]:
    """
    Generate a punchy 2-3 sentence executive factual summary of field developments in the 33-hour window.
    """
    if not mentions:
        return {
            "summary": f"Dalam periode pemantauan {window_label}, tidak ada isu kritis atau anomali baru yang terdeteksi pada 17 Program Prioritas Nasional.",
            "engine": "no-data"
        }

    router = client or nine_router_client

    context_lines = []
    for i, m in enumerate(mentions[:20], 1):
        txt = m.get("text", "")[:180].replace("\n", " ")
        topic = m.get("topic") or "Umum"
        sent = (m.get("sentiment") or "neutral").upper()
        context_lines.append(f"- [{topic} - {sent}]: {txt}")

    mentions_payload = "\n".join(context_lines)

    system_prompt = (
        "Anda adalah PulseScope Intelligence Officer untuk pimpinan dan eksekutif kabinet.\n"
        f"Tugas Anda: buat ringkasan eksekutif 2-3 kalimat padat, to-the-point, dan kaya fakta/angka mengenai dinamika peristiwa di lapangan selama periode: {window_label}.\n\n"
        "ATURAN MUTLAK:\n"
        "1. Tepat 2-3 kalimat lugas dan padat, tanpa kata pengantar klise.\n"
        "2. Langsung sebutkan program mana yang mengalami pergerakan signifikan, aksi/capaian konkret di lapangan, serta isu kritis atau kendala utama.\n"
        "3. DILARANG MENYERTAKAN SITASI ATAU NAMA MEDIA/TANGGAL DALAM TANDA KURUNG (misal: DILARANG ada '(Kompas, 06 Nov)' atau '[InfoPublik]').\n"
        "4. DILARANG menyebut nama model AI atau 9Router.\n"
        "5. Gaya bahasa: intelijen eksekutif, faktual, presisi, dan tajam."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"DATA PERISTIWA 33 JAM TERAKHIR:\n{mentions_payload}\n\nBuat ringkasan 2-3 kalimat:"}
    ]

    res = router.chat_completion(messages=messages, temperature=0.2, max_tokens=220)
    if res.get("success") and res.get("content"):
        cleaned = res["content"].strip()
        cleaned = re.sub(r'\([^)]*(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)[^)]*\)', '', cleaned, flags=re.I)
        cleaned = re.sub(r'\([^)]*(?:InfoPublik|Kompas|Tempo|Detik|Antara|Disway|Tirto|Media|Berita)[^)]*\)', '', cleaned, flags=re.I)
        cleaned = cleaned.replace("**", "").strip()
        return {"summary": cleaned, "engine": "9router-ai"}

    # Fallback
    pos = sum(1 for m in mentions if m.get("sentiment") == "positive")
    neg = sum(1 for m in mentions if m.get("sentiment") == "negative")
    return {
        "summary": f"Dalam periode pemantauan 33 jam terakhir tercatat {len(mentions)} perkembangan peristiwa pada 17 Program Prioritas Nasional, dengan dinamika persepsi mencakup {pos} perkembangan positif dan {neg} catatan kritis dari publik.",
        "engine": "fallback"
    }

