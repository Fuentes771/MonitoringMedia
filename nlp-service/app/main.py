from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from .sentiment import analyze_sentiment
from .keywords import extract_keywords

app = FastAPI(
    title="PulseScope NLP Service",
    version="1.0.0",
    description="Sentiment inference and keyword extraction engine for PulseScope social listening."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    text: str
    language: Optional[str] = "id"
    top_keywords: Optional[int] = 5

class BatchAnalyzeItem(BaseModel):
    id: str | int
    text: str
    language: Optional[str] = "id"

class BatchAnalyzeRequest(BaseModel):
    items: List[BatchAnalyzeItem]

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "pulsescope-nlp",
        "version": "1.0.0"
    }

@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    if not req.text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    sentiment = analyze_sentiment(req.text)
    keywords = extract_keywords(req.text, top_n=req.top_keywords)

    return {
        "sentiment": sentiment,
        "keywords": keywords
    }

@app.post("/batch-analyze")
def batch_analyze(req: BatchAnalyzeRequest):
    results = []
    for item in req.items:
        sent = analyze_sentiment(item.text)
        kw = extract_keywords(item.text, top_n=5)
        results.append({
            "id": item.id,
            "sentiment": sent,
            "keywords": kw
        })
    return {"results": results}
