import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from .sentiment import analyze_sentiment
from .keywords import extract_keywords
from .nine_router import nine_router_client
from .ai_sentiment import analyze_ai_sentiment
from .ai_summary import summarize_mention, summarize_topic, summarize_daily_window
from .ai_hot_issues import extract_hot_issues_from_headlines
from .ai_chat import process_rag_chat
from .ai_search import generate_search_queries, filter_relevance
from .bot_detection import evaluate_account_and_text_anomalies, analyze_buzzer_network
from .scrapers.router import router as scraper_router

_enable_docs = os.getenv("NLP_ENABLE_DOCS", "false").lower() in ("1", "true", "yes")
_cors_origins = [
    origin.strip()
    for origin in os.getenv("NLP_CORS_ORIGINS", "http://backend:8000,http://localhost:8000").split(",")
    if origin.strip()
]

app = FastAPI(
    title="TRINETRA NLP & AI Intelligence Service",
    version="2.0.0",
    description="Sentiment inference, 9Router AI gateway, topic executive digest, and context-bounded RAG chat.",
    docs_url="/docs" if _enable_docs else None,
    redoc_url="/redoc" if _enable_docs else None,
    openapi_url="/openapi.json" if _enable_docs else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# ----------------- Request Models ----------------- #

class AnalyzeRequest(BaseModel):
    text: str
    language: Optional[str] = "id"
    top_keywords: Optional[int] = 5
    use_ai: Optional[bool] = True
    author_name: Optional[str] = None
    provider: Optional[str] = None

class BatchAnalyzeItem(BaseModel):
    id: str | int
    text: str
    language: Optional[str] = "id"
    author_name: Optional[str] = None
    provider: Optional[str] = None
    top_keywords: Optional[int] = 5

class BatchAnalyzeRequest(BaseModel):
    items: List[BatchAnalyzeItem]
    use_ai: Optional[bool] = False

class SummarizeMentionRequest(BaseModel):
    text: str

class SummarizeTopicRequest(BaseModel):
    topic_name: str
    mentions: List[Dict[str, Any]]

class RagChatRequest(BaseModel):
    query: str
    context_mentions: List[Dict[str, Any]]
    topic_name: Optional[str] = None
    conversation_history: Optional[List[Dict[str, str]]] = None

class SearchQueryRequest(BaseModel):
    program_name: str

class RelevanceCheckRequest(BaseModel):
    program_name: str
    title: str
    snippet: str

class DailySummaryRequest(BaseModel):
    mentions: List[Dict[str, Any]]
    window_label: Optional[str] = "33 jam terakhir"

class HotIssuesClusterRequest(BaseModel):
    headlines: List[Dict[str, Any]]

class BuzzerNetworkRequest(BaseModel):
    mentions: List[Dict[str, Any]]

# ----------------- Routes ----------------- #

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "pulsescope-nlp",
        "version": "2.0.0"
    }

@app.get("/ai/health")
def ai_health_check():
    """
    Check 9Router connectivity and available models.
    """
    status = nine_router_client.check_health()
    return {
        "service": "pulsescope-ai-gateway",
        "9router": status
    }

def _analyze_single_item(
    text: str,
    use_ai: bool = True,
    top_keywords: int = 5,
    author_name: Optional[str] = None,
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    if use_ai:
        sentiment = analyze_ai_sentiment(text)
    else:
        sentiment = analyze_sentiment(text)
        sentiment["aspect"] = "general"
        sentiment["key_reason"] = (
            f"[Sarkasme Terdeteksi] {sentiment['sarcasm_reason']}"
            if sentiment.get("is_sarcasm") and sentiment.get("sarcasm_reason")
            else "Analisis leksikon lokal"
        )
        sentiment["urgency"] = "medium" if sentiment.get("is_sarcasm") else "low"

    keywords = extract_keywords(text, top_n=top_keywords)
    bot_analysis = evaluate_account_and_text_anomalies(
        text=text,
        author_name=author_name,
        provider=provider
    )

    return {
        "sentiment": sentiment,
        "keywords": keywords,
        "bot_analysis": bot_analysis
    }

@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    if not req.text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    return _analyze_single_item(
        text=req.text,
        use_ai=bool(req.use_ai),
        top_keywords=req.top_keywords or 5,
        author_name=req.author_name,
        provider=req.provider,
    )

@app.post("/batch-analyze")
def batch_analyze(req: BatchAnalyzeRequest):
    results = []
    for item in req.items:
        if not item.text or not item.text.strip():
            results.append({
                "id": item.id,
                "sentiment": {
                    "label": "neutral",
                    "confidence": 0.5,
                    "probabilities": {"positive": 0.15, "neutral": 0.70, "negative": 0.15},
                    "aspect": "general",
                    "key_reason": "Teks kosong",
                    "urgency": "low",
                    "is_sarcasm": False,
                    "sarcasm_score": 0.0,
                    "sarcasm_reason": "",
                    "sarcasm_markers": [],
                },
                "keywords": [],
                "bot_analysis": {
                    "is_inauthentic": False,
                    "inauthentic_score": 0.0,
                    "bot_signals": [],
                },
            })
            continue

        analysis = _analyze_single_item(
            text=item.text,
            use_ai=bool(req.use_ai),
            top_keywords=item.top_keywords or 5,
            author_name=item.author_name,
            provider=item.provider,
        )
        results.append({
            "id": item.id,
            **analysis,
        })
    return {"results": results}

@app.post("/ai/analyze-sentiment")
def ai_analyze_sentiment_endpoint(req: AnalyzeRequest):
    """
    Dedicated AI sentiment endpoint with aspect and rationale.
    """
    if not req.text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    sentiment = analyze_ai_sentiment(req.text)
    keywords = extract_keywords(req.text, top_n=req.top_keywords)
    return {
        "sentiment": sentiment,
        "keywords": keywords
    }

@app.post("/ai/summarize-mention")
def ai_summarize_mention(req: SummarizeMentionRequest):
    return summarize_mention(req.text)

@app.post("/ai/summarize-topic")
def ai_summarize_topic(req: SummarizeTopicRequest):
    """
    Generate an Executive Intelligence Briefing across recent mentions of a national program.
    """
    return summarize_topic(req.topic_name, req.mentions)

@app.post("/ai/chat")
def ai_rag_chat(req: RagChatRequest):
    """
    Context-bounded RAG chat restricted strictly to provided mentions.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    return process_rag_chat(
        query=req.query,
        context_mentions=req.context_mentions,
        topic_name=req.topic_name,
        conversation_history=req.conversation_history
    )

@app.post("/ai/search-queries")
def ai_search_queries(req: SearchQueryRequest):
    """
    Generate targeted search queries for a national program.
    """
    return generate_search_queries(req.program_name)

@app.post("/ai/check-relevance")
def ai_check_relevance(req: RelevanceCheckRequest):
    return filter_relevance(req.program_name, req.title, req.snippet)

@app.post("/ai/daily-summary")
def ai_daily_summary(req: DailySummaryRequest):
    """
    Generate punchy 2-3 sentence executive factual summary of field events in the 33-hour window.
    """
    return summarize_daily_window(req.mentions, req.window_label or "33 jam terakhir")

@app.post("/ai/cluster-hot-issues")
def ai_cluster_hot_issues_endpoint(req: HotIssuesClusterRequest):
    """
    Extract and cluster top breaking hot issues from recent news headlines.
    """
    return extract_hot_issues_from_headlines(req.headlines)

@app.post("/ai/analyze-buzzer-network")
def ai_analyze_buzzer_network_endpoint(req: BuzzerNetworkRequest):
    """
    Triple-Layer CIB, Copypasta & Bot Network Analyzer across mentions.
    """
    return analyze_buzzer_network(req.mentions)

# Mount Social Media Scraper Router
app.include_router(scraper_router, prefix="/api/v1/scraper", tags=["scraper"])
app.include_router(scraper_router, prefix="/scraper", tags=["scraper"])
