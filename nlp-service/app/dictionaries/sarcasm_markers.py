import re
from typing import Dict, Any, List

SARCASM_EMOJIS = {
    "🗿": "Emoji patung Moai (ekspresi datar/sinis khas netizen Indonesia)",
    "🤡": "Emoji badut (simbol sindiran kebijakan konyol/pencitraan)",
    "🙃": "Emoji senyum terbalik (ironi/ketidakpuasan terselubung)",
    "💀": "Emoji tengkorak (reaksi satir terhadap situasi absurd)",
}

AMBIGUOUS_IRONY_EMOJIS = {"👏", "🔥", "🙏", "😂", "🤣", "👍"}

PRAISE_WORDS = {
    "bagus", "mantap", "keren", "hebat", "luar biasa", "top", "terbaik",
    "menyala", "bangga", "jenius", "pintar", "pinter", "adil", "makmur",
    "sejahtera", "makasih", "terima kasih", "salut", "apresiasi", "setuju",
}

CYNICAL_POLITICAL_MARKERS = [
    "saking bagusnya",
    "saking hebatnya",
    "saking pintarnya",
    "uang rakyat",
    "duit rakyat",
    "foya-foya",
    "foya foya",
    "pajak naik",
    "rakyat miskin",
    "rakyat susah",
    "rakyat menjerit",
    "bikin susah",
    "tambah susah",
    "tambah miskin",
    "makin parah",
    "makin hancur",
    "biar sekalian hancur",
    "agak laen",
    "menyala abangkuh",
    "ga bahaya ta",
    "gak bahaya ta",
    "untung aja",
    "wakanda",
    "konoha",
    "nepotisme",
    "dinasti",
    "oligarki",
    "pencitraan",
    "omon-omon",
    "omon omon",
    "janji manis",
    "kena prank",
    "di-prank",
    "badut politik",
    "dagelan",
    "komedi",
    "lawak",
    "lucu banget",
]

CONTRADICTORY_PATTERNS = [
    (
        r"saking\s+(?:bagus|hebat|pintar|pinter|keren|adil|sukses|mantap)nya",
        "Pola hiperbola 'saking ...-nya' yang menyindir hasil buruk di lapangan",
    ),
    (
        r"(?:bagus|mantap|hebat|keren|top)\s+(?:banget|sekali|deh|lah|ya|kali).*?(?:rakyat|pajak|utang|hutang|korupsi|susah|miskin|hancur|naik|mahal|mundur|foya)",
        "Kontradiksi pujian awal dengan keluhan beban rakyat/kebijakan",
    ),
    (
        r"(?:makasih|terima\s+kasih)\s+(?:ya|loh|banget|banyak).*?(?:udah|sudah|bikin|buat).*?(?:susah|miskin|mahal|naik|hancur|rusak|sengsara|PHK)",
        "Ucapan terima kasih ironis atas dampak negatif kebijakan",
    ),
    (
        r"menyala\s+abangkuh",
        "Slang 'menyala abangkuh' dalam konteks sindiran terhadap perilaku pejabat/kebijakan",
    ),
    (
        r"agak\s+laen\s+(?:emang|memang|ini|pemerintah|pejabat|negeri)",
        "Ungkapan satir 'agak laen' yang menyoroti kejanggalan kebijakan",
    ),
    (
        r"(?:enak|nikmat)\s+(?:banget|kali|bener)\s+(?:jadi|uang|duit)\s+(?:pejabat|rakyat)",
        "Sindiran sinis terhadap privilese pejabat atau penggunaan anggaran publik",
    ),
]


def detect_sarcasm_heuristics(text: str, raw_label: str = "neutral") -> Dict[str, Any]:
    """
    Detect Indonesian political sarcasm/satire using lexicon, emoji, and contradiction rules.
    """
    if not text or len(text.strip()) < 5:
        return {
            "is_sarcasm": False,
            "sarcasm_score": 0.0,
            "sarcasm_reason": "",
            "matched_markers": [],
        }

    lower_text = text.lower()
    score = 0.0
    reasons: List[str] = []
    markers: List[str] = []

    # 1. Check explicit sarcasm emojis (🗿, 🤡, 🙃, 💀)
    for emoji_char, desc in SARCASM_EMOJIS.items():
        if emoji_char in text:
            score += 0.45
            reasons.append(desc)
            markers.append(emoji_char)

    # 2. Check praise word presence
    found_praise = [pw for pw in PRAISE_WORDS if re.search(rf"\b{re.escape(pw)}\b", lower_text)]

    # 3. Check cynical political markers
    found_cynical = [cm for cm in CYNICAL_POLITICAL_MARKERS if cm in lower_text]
    if found_cynical:
        markers.extend(found_cynical[:3])
        if found_praise:
            score += 0.55
            reasons.append(
                f"Kontradiksi pujian ({', '.join(found_praise[:2])}) dengan frasa sinis ({', '.join(found_cynical[:2])})"
            )
        else:
            score += 0.30
            reasons.append(f"Mengandung istilah satir politik ({', '.join(found_cynical[:2])})")

    # 4. Check regex contradictory patterns
    for pattern, reason_desc in CONTRADICTORY_PATTERNS:
        if re.search(pattern, lower_text):
            score += 0.55
            if reason_desc not in reasons:
                reasons.append(reason_desc)
            markers.append("contradictory_syntax")

    # 5. Check praise + ambiguous irony emojis + negative/cynical context
    found_ambig_emoji = [e for e in AMBIGUOUS_IRONY_EMOJIS if e in text]
    if found_praise and found_ambig_emoji and (found_cynical or "!" in text or "?" in text):
        score += 0.25
        markers.extend(found_ambig_emoji[:2])

    # 6. Check excessive punctuation or quotes around praise words (e.g. "hebat", "bagus")
    if re.search(r'["\'](?:bagus|hebat|mantap|adil|sukses|pintar|cerdas)["\']', lower_text):
        score += 0.50
        reasons.append("Tanda kutip ironis pada kata pujian")
        markers.append("ironic_quotes")

    final_score = round(min(0.98, score), 2)
    is_sarcasm = final_score >= 0.45

    primary_reason = "; ".join(reasons[:2]) if reasons else ""
    if is_sarcasm and not primary_reason:
        primary_reason = "Terdeteksi penggunaan diksi pujian semu/satir dalam konteks kritik kebijakan."

    return {
        "is_sarcasm": is_sarcasm,
        "sarcasm_score": final_score if is_sarcasm else round(final_score * 0.5, 2),
        "sarcasm_reason": primary_reason,
        "matched_markers": list(dict.fromkeys(markers)),
    }
