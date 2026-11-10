import pytest
from app.sentiment import analyze_sentiment
from app.keywords import extract_keywords

def test_positive_slang():
    res = analyze_sentiment("Layanannya mantul banget wkwk, sangat puas!")
    assert res["label"] == "positive"
    assert res["confidence"] > 0.60
    assert res["probabilities"]["positive"] > res["probabilities"]["negative"]

def test_negative_with_negation():
    # 'tidak bagus' should be negative
    res = analyze_sentiment("Aplikasinya nggak bagus sama sekali, sering error.")
    assert res["label"] == "negative"
    assert res["confidence"] > 0.60
    assert res["probabilities"]["negative"] > res["probabilities"]["positive"]

def test_negative_slang():
    res = analyze_sentiment("Zonk parah, saldo kepotong tapi transfer pending.")
    assert res["label"] == "negative"
    assert res["confidence"] > 0.60

def test_neutral_news():
    res = analyze_sentiment("PT Transportasi Jakarta menambah 30 unit bus listrik pada rute koridor utama.")
    assert res["label"] in ["neutral", "positive"]

def test_keyword_extraction():
    kws = extract_keywords("Antrean gate masuk LRT Jabodebek menumpuk parah di stasiun Dukuh Atas", top_n=3)
    assert len(kws) > 0
    words = [k["keyword"] for k in kws]
    assert any("lrt" in w or "antrean" in w for w in words)

