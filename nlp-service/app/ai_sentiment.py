import json
import logging
from typing import Dict, Any, Optional
from .nine_router import nine_router_client, NineRouterClient
from .sentiment import analyze_sentiment as fallback_analyze_sentiment

logger = logging.getLogger("pulsescope.ai_sentiment")

SYSTEM_SENTIMENT_PROMPT = """Anda adalah analis sentimen dan intelijen kebijakan publik Indonesia untuk platform PulseScope.
Tugas Anda adalah menganalisis teks (berita atau media sosial) terkait program-program strategis nasional Indonesia.

Tentukan:
1. label: "positive" | "neutral" | "negative"
2. confidence: angka antara 0.50 hingga 0.99
3. probabilities: objek berisi "positive", "neutral", "negative" yang berjumlah 1.0
4. aspect: aspek spesifik yang dibahas (misal: "alokasi anggaran", "distribusi menu", "kualitas beras", "skrining puskesmas", "syarat kredit", "transisi energi", dll.)
5. key_reason: 1 kalimat bahasa Indonesia lugas menjelaskan alasan sentimen tersebut
6. urgency: "low" | "medium" | "high" (apakah memuat keluhan kritis, ancaman keselamatan, atau isu viral mendesak)

Format keluaran WAJIB berupa JSON murni dengan format:
{
  "label": "positive"|"neutral"|"negative",
  "confidence": 0.92,
  "probabilities": {"positive": 0.85, "neutral": 0.10, "negative": 0.05},
  "aspect": "nama aspek",
  "key_reason": "alasan singkat sentimen",
  "urgency": "low"|"medium"|"high"
}
"""

def analyze_ai_sentiment(
    text: str,
    client: Optional[NineRouterClient] = None,
    force_fallback: bool = False
) -> Dict[str, Any]:
    """
    Analyze sentiment using 9Router LLM with fallback to hybrid lexicon engine.
    """
    if not text or len(text.strip()) < 3:
        return {
            "label": "unknown",
            "confidence": 0.50,
            "probabilities": {"positive": 0.10, "neutral": 0.80, "negative": 0.10},
            "aspect": "general",
            "key_reason": "Teks terlalu pendek untuk dianalisis",
            "urgency": "low",
            "engine": "fallback-short-text",
            "model_version": "v1.0-hybrid-id"
        }

    if force_fallback:
        fallback = fallback_analyze_sentiment(text)
        fallback["aspect"] = "general"
        fallback["key_reason"] = "Dianalisis menggunakan leksikon aturan lokal"
        fallback["urgency"] = "low"
        fallback["engine"] = "local-lexicon"
        return fallback

    router = client or nine_router_client

    messages = [
        {"role": "system", "content": SYSTEM_SENTIMENT_PROMPT},
        {"role": "user", "content": f"Teks yang dianalisis:\n\"\"\"{text.strip()}\"\"\""}
    ]

    res = router.chat_completion(
        messages=messages,
        temperature=0.1,
        max_tokens=250,
        json_mode=True
    )

    if res.get("success") and res.get("content"):
        content = res["content"].strip()
        try:
            # Handle potential markdown code fences in response
            if content.startswith("```"):
                lines = content.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                content = "\n".join(lines).strip()

            parsed = json.loads(content)
            label = parsed.get("label", "neutral").lower()
            if label not in ["positive", "neutral", "negative"]:
                label = "neutral"

            conf = float(parsed.get("confidence", 0.80))
            conf = max(0.50, min(0.99, conf))

            probs = parsed.get("probabilities", {})
            if not isinstance(probs, dict) or "positive" not in probs:
                if label == "positive":
                    probs = {"positive": conf, "neutral": round((1 - conf) * 0.7, 2), "negative": round((1 - conf) * 0.3, 2)}
                elif label == "negative":
                    probs = {"positive": round((1 - conf) * 0.3, 2), "neutral": round((1 - conf) * 0.7, 2), "negative": conf}
                else:
                    probs = {"positive": 0.15, "neutral": conf, "negative": round(1 - conf - 0.15, 2)}

            return {
                "label": label,
                "confidence": conf,
                "probabilities": probs,
                "aspect": parsed.get("aspect", "umum"),
                "key_reason": parsed.get("key_reason", f"Sentimen dinilai {label} oleh model AI."),
                "urgency": parsed.get("urgency", "low"),
                "engine": "9router-ai",
                "model_version": res.get("model", "9router-llm")
            }
        except Exception as err:
            logger.warning(f"Failed to parse 9Router JSON sentiment output: {err}. Raw content: {content}")

    # Fallback if 9router fails or returns invalid response
    fallback = fallback_analyze_sentiment(text)
    fallback["aspect"] = "umum"
    fallback["key_reason"] = "Dianalisis menggunakan leksikon aturan lokal (9Router offline/fallback)"
    fallback["urgency"] = "low"
    fallback["engine"] = "local-lexicon-fallback"
    return fallback

