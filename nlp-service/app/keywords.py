import re
from typing import List, Dict, Any
from collections import Counter
from .dictionaries.stopwords_id import STOPWORDS_ID

def extract_keywords(text: str, top_n: int = 5) -> List[Dict[str, Any]]:
    """
    Extract meaningful Indonesian unigrams and bigrams, excluding common stopwords.
    """
    if not text:
        return []

    # Clean text to alphanumeric and spaces
    clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', text.lower())
    words = [w for w in clean.split() if len(w) > 2 and w not in STOPWORDS_ID]

    if not words:
        return []

    # Generate unigrams and bigrams
    candidates = []
    candidates.extend(words)

    # Bigrams
    for i in range(len(words) - 1):
        bigram = f"{words[i]} {words[i+1]}"
        candidates.append(bigram)

    counts = Counter(candidates)
    most_common = counts.most_common(top_n)

    result = []
    total_tokens = max(len(words), 1)
    for kw, freq in most_common:
        score = round(freq / total_tokens, 3)
        result.append({
            "keyword": kw,
            "score": score,
            "frequency": freq
        })

    return result

