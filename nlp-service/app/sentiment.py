import re
import math
from typing import Dict, Any, List
from .dictionaries.slang import SLANG_SENTIMENT_MAP, SLANG_NORMALIZER
from .dictionaries.negations import NEGATION_WORDS, INTENSIFIERS
from .dictionaries.sentiment_lexicon import SENTIMENT_LEXICON
from .dictionaries.sarcasm_markers import detect_sarcasm_heuristics

MODEL_VERSION = "v1.0-hybrid-id"

# Emoji patterns
EMOJI_SENTIMENT = {
    "😊": 1.5, "😃": 1.5, "😄": 1.5, "😁": 1.5, "😍": 1.8, "👍": 1.6, "🔥": 1.5, "🎉": 1.7, "❤️": 1.7, "✨": 1.4,
    "😞": -1.5, "😢": -1.6, "😭": -1.7, "😡": -1.8, "😠": -1.8, "👎": -1.6, "💔": -1.8, "🤮": -1.9, "🤬": -2.0, "🤦": -1.4
}

def clean_tokens(text: str) -> List[str]:
    # Lowercase and split tokens while preserving alphanumeric and relevant emojis
    tokens = re.findall(r'[a-zA-Z0-9_-]+|[😊😃😄😁😍👍🔥🎉❤️✨😞😢😭😡😠👎💔🤮🤬🤦]', text.lower())
    normalized = []
    for t in tokens:
        normalized.append(SLANG_NORMALIZER.get(t, t))
    return normalized

def analyze_sentiment(text: str) -> Dict[str, Any]:
    """
    Hybrid sentiment inference engine tuned for Indonesian informal & formal text.
    Handles negation inversions, slang words, intensifiers, and emojis.
    """
    if not text or len(text.strip()) < 3:
        return {
            "label": "unknown",
            "confidence": 0.50,
            "probabilities": {
                "positive": 0.10,
                "neutral": 0.80,
                "negative": 0.10
            },
            "model_version": MODEL_VERSION
        }

    tokens = clean_tokens(text)
    if not tokens:
        return {
            "label": "unknown",
            "confidence": 0.50,
            "probabilities": {"positive": 0.10, "neutral": 0.80, "negative": 0.10},
            "model_version": MODEL_VERSION
        }

    pos_score = 0.0
    neg_score = 0.0
    hit_count = 0

    n = len(tokens)
    i = 0
    while i < n:
        token = tokens[i]
        
        # Check emoji
        if token in EMOJI_SENTIMENT:
            val = EMOJI_SENTIMENT[token]
            if val > 0:
                pos_score += val
            else:
                neg_score += abs(val)
            hit_count += 1
            i += 1
            continue

        # Look up word score in Lexicon or Slang map
        word_val = SENTIMENT_LEXICON.get(token) or SLANG_SENTIMENT_MAP.get(token)

        # Check intensifiers
        multiplier = 1.0
        if i + 1 < n and tokens[i+1] in INTENSIFIERS:
            multiplier = INTENSIFIERS[tokens[i+1]]

        # Check negation in previous 1 or 2 tokens
        is_negated = False
        if i > 0 and tokens[i-1] in NEGATION_WORDS:
            is_negated = True
        elif i > 1 and tokens[i-2] in NEGATION_WORDS:
            is_negated = True

        if word_val is not None:
            hit_count += 1
            effective_val = word_val * multiplier
            if is_negated:
                # Invert polarity
                if effective_val > 0:
                    neg_score += effective_val * 1.1 # Negating a positive makes it firmly negative
                else:
                    pos_score += abs(effective_val) * 0.7 # Negating negative ('tidak buruk') is mildly positive/neutral
            else:
                if effective_val > 0:
                    pos_score += effective_val
                else:
                    neg_score += abs(effective_val)
        
        i += 1

    # Neutral prior
    neutral_score = 1.5 if hit_count == 0 else 0.8

    # Apply softmax to compute normalized probabilities
    # Scale values to avoid overflow
    raw_vals = [pos_score, neutral_score, neg_score]
    max_val = max(raw_vals)
    exp_vals = [math.exp(v - max_val) for v in raw_vals]
    sum_exp = sum(exp_vals)
    
    p_pos = round(exp_vals[0] / sum_exp, 4)
    p_neu = round(exp_vals[1] / sum_exp, 4)
    p_neg = round(exp_vals[2] / sum_exp, 4)

    # Determine winning label
    net_diff = pos_score - neg_score
    if hit_count == 0:
        label = "neutral"
        confidence = p_neu
    elif abs(net_diff) < 0.4:
        label = "neutral"
        confidence = max(p_neu, 0.65)
    elif net_diff > 0:
        label = "positive"
        confidence = p_pos
    else:
        label = "negative"
        confidence = p_neg

    # PRD low-confidence threshold fallback
    if confidence < 0.55:
        label = "unknown"

    # Evaluate Indonesian political sarcasm / satire
    sarcasm = detect_sarcasm_heuristics(text, label)
    if sarcasm["is_sarcasm"]:
        label = "negative"
        confidence = max(confidence, sarcasm["sarcasm_score"], 0.85)
        p_neg = round(max(0.80, sarcasm["sarcasm_score"]), 4)
        p_pos = round((1.0 - p_neg) * 0.3, 4)
        p_neu = round(1.0 - p_neg - p_pos, 4)

    return {
        "label": label,
        "confidence": round(float(confidence), 2),
        "probabilities": {
            "positive": p_pos,
            "neutral": p_neu,
            "negative": p_neg
        },
        "is_sarcasm": sarcasm["is_sarcasm"],
        "sarcasm_score": sarcasm["sarcasm_score"],
        "sarcasm_reason": sarcasm["sarcasm_reason"],
        "sarcasm_markers": sarcasm["matched_markers"],
        "model_version": MODEL_VERSION
    }

