"""
Indonesian Negation Words and Modifiers.
Used for handling sentiment polarity inversion (e.g., 'nggak bagus' -> negative).
"""

NEGATION_WORDS = {
    "tidak", "tak", "nggak", "gak", "gk", "ga", "tdk", "bukan",
    "kurang", "belum", "tanpa", "jangan", "anti"
}

INTENSIFIERS = {
    "banget": 1.4,
    "bgt": 1.4,
    "sangat": 1.4,
    "sekali": 1.3,
    "amat": 1.3,
    "super": 1.4,
    "parah": 1.5,
    "terlalu": 1.3,
    "ekstrem": 1.5,
    "beneran": 1.2,
    "bener": 1.2,
    "pol": 1.3,
}

