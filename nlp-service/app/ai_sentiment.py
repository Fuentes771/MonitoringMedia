import json
import logging
from typing import Dict, Any, Optional
from .nine_router import nine_router_client, NineRouterClient
from .sentiment import analyze_sentiment as fallback_analyze_sentiment
from .dictionaries.sarcasm_markers import detect_sarcasm_heuristics

logger = logging.getLogger("trinetra.ai_sentiment")

SYSTEM_SENTIMENT_PROMPT = """Anda adalah analis sentimen dan intelijen kebijakan publik Indonesia untuk platform TRINETRA.
Tugas Anda adalah menganalisis teks (berita atau media sosial) terkait program strategis dan isu hangat nasional Indonesia, termasuk mendeteksi SARKASME / SATIR politik netizen Indonesia (seperti pujian palsu, penggunaan emoji 🗿/🤡, frasa 'saking bagusnya', 'menyala abangkuh', 'agak laen', dll.).

Tentukan:
1. label: "positive" | "neutral" | "negative" (PENTING: Jika teks mengandung sarkasme/sindiran berkedok pujian, WAJIB set label ke "negative").
2. confidence: angka antara 0.50 hingga 0.99
3. probabilities: objek berisi "positive", "neutral", "negative" yang berjumlah 1.0
4. aspect: aspek spesifik yang dibahas (misal: "alokasi anggaran", "transparansi pejabat", "kualitas distribusi", "beban pajak", dll.)
5. key_reason: 1 kalimat bahasa Indonesia lugas menjelaskan alasan sentimen tersebut
6. urgency: "low" | "medium" | "high"
7. is_sarcasm: boolean (true jika merupakan sindiran/satir/pujian palsu, false jika bukan)
8. sarcasm_score: angka 0.00 hingga 0.99
9. sarcasm_reason: penjelasan singkat mengapa kalimat tersebut terindikasi sarkasme/satir (kosongkan jika bukan sarkasme)

Format keluaran WAJIB berupa JSON murni:
{
  "label": "positive"|"neutral"|"negative",
  "confidence": 0.92,
  "probabilities": {"positive": 0.05, "neutral": 0.10, "negative": 0.85},
  "aspect": "nama aspek",
  "key_reason": "alasan singkat sentimen",
  "urgency": "low"|"medium"|"high",
  "is_sarcasm": true|false,
  "sarcasm_score": 0.88,
  "sarcasm_reason": "Penjelasan pujian ironis atau sindiran netizen"
}
"""

def analyze_ai_sentiment(
    text: str,
    client: Optional[NineRouterClient] = None,
    force_fallback: bool = False
) -> Dict[str, Any]:
    """
    Analyze sentiment & political sarcasm using 9Router LLM + Hybrid Indonesian Sarcasm Lexicon.
    """
    if not text or len(text.strip()) < 3:
        return {
            "label": "unknown",
            "confidence": 0.50,
            "probabilities": {"positive": 0.10, "neutral": 0.80, "negative": 0.10},
            "aspect": "general",
            "key_reason": "Teks terlalu pendek untuk dianalisis",
            "urgency": "low",
            "is_sarcasm": False,
            "sarcasm_score": 0.0,
            "sarcasm_reason": "",
            "engine": "fallback-short-text",
            "model_version": "v2.0-hybrid-id"
        }

    # Always run fast local sarcasm heuristics as baseline
    heuristics = detect_sarcasm_heuristics(text)

    if force_fallback:
        fallback = fallback_analyze_sentiment(text)
        fallback["aspect"] = "general"
        fallback["key_reason"] = (
            fallback["sarcasm_reason"]
            if fallback.get("is_sarcasm") and fallback.get("sarcasm_reason")
            else "Dianalisis menggunakan leksikon aturan lokal"
        )
        fallback["urgency"] = "medium" if fallback.get("is_sarcasm") else "low"
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
        max_tokens=300,
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
            label = parsed.get("label", "neutral").lower()
            if label not in ["positive", "neutral", "negative"]:
                label = "neutral"

            ai_sarcasm = bool(parsed.get("is_sarcasm", False))
            ai_sarcasm_score = float(parsed.get("sarcasm_score", 0.0))
            ai_sarcasm_reason = str(parsed.get("sarcasm_reason", "")).strip()

            # Combine AI sarcasm detection with local Indonesian slang heuristics
            is_sarcasm = ai_sarcasm or heuristics["is_sarcasm"]
            sarcasm_score = round(max(ai_sarcasm_score, heuristics["sarcasm_score"]), 2)
            sarcasm_reason = ai_sarcasm_reason or heuristics["sarcasm_reason"]

            # Enforce auto-flip to negative when sarcasm is detected
            if is_sarcasm:
                label = "negative"

            conf = float(parsed.get("confidence", 0.85))
            if is_sarcasm:
                conf = max(conf, sarcasm_score, 0.85)
            conf = max(0.50, min(0.99, conf))

            probs = parsed.get("probabilities", {})
            if is_sarcasm or not isinstance(probs, dict) or "positive" not in probs:
                if label == "positive":
                    probs = {"positive": conf, "neutral": round((1 - conf) * 0.7, 2), "negative": round((1 - conf) * 0.3, 2)}
                elif label == "negative":
                    probs = {"positive": round((1 - conf) * 0.3, 2), "neutral": round((1 - conf) * 0.7, 2), "negative": conf}
                else:
                    probs = {"positive": 0.15, "neutral": conf, "negative": round(1 - conf - 0.15, 2)}

            key_reason = parsed.get("key_reason", f"Sentimen dinilai {label} oleh model AI.")
            if is_sarcasm and sarcasm_reason and sarcasm_reason.lower() not in key_reason.lower():
                key_reason = f"[Sarkasme Terdeteksi] {sarcasm_reason}"

            return {
                "label": label,
                "confidence": conf,
                "probabilities": probs,
                "aspect": parsed.get("aspect", "umum"),
                "key_reason": key_reason,
                "urgency": parsed.get("urgency", "medium" if is_sarcasm else "low"),
                "is_sarcasm": is_sarcasm,
                "sarcasm_score": sarcasm_score,
                "sarcasm_reason": sarcasm_reason,
                "sarcasm_markers": heuristics["matched_markers"],
                "engine": "9router-ai-hybrid",
                "model_version": res.get("model", "9router-llm")
            }
        except Exception as err:
            logger.warning(f"Failed to parse 9Router JSON sentiment output: {err}. Raw content: {content}")

    # Fallback if 9router fails or returns invalid response
    fallback = fallback_analyze_sentiment(text)
    fallback["aspect"] = "umum"
    fallback["key_reason"] = (
        f"[Sarkasme Terdeteksi] {fallback['sarcasm_reason']}"
        if fallback.get("is_sarcasm") and fallback.get("sarcasm_reason")
        else "Dianalisis menggunakan leksikon aturan lokal (9Router offline/fallback)"
    )
    fallback["urgency"] = "medium" if fallback.get("is_sarcasm") else "low"
    fallback["engine"] = "local-lexicon-fallback"
    return fallback
