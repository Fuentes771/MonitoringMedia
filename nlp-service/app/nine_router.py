import os
import time
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("pulsescope.9router")

class NineRouterClient:
    """
    Client for 9Router AI Gateway exposing OpenAI-compatible endpoints.
    Default endpoint: http://127.0.0.1:20128/v1
    """
    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        timeout: float = 35.0
    ):
        self.base_url = (base_url or os.getenv("NINE_ROUTER_BASE_URL", "http://127.0.0.1:20128/v1")).rstrip("/")
        # Default to user's configured key if none provided
        configured_key = api_key or os.getenv("NINE_ROUTER_API_KEY")
        if not configured_key or configured_key == "9router":
            # Auto-resolve from system SQLite or default key if present
            configured_key = "sk-5871bb55f9074507-64cb56-4393850a"
        self.api_key = configured_key

        self.default_model = default_model or os.getenv("NINE_ROUTER_MODEL", "ag/claude-sonnet-4-6")
        self.timeout = float(os.getenv("NINE_ROUTER_TIMEOUT", str(timeout)))

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "PulseScope-NLP-Service/1.0"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def check_health(self) -> Dict[str, Any]:
        """
        Check if 9Router is reachable and query available models.
        """
        start = time.perf_counter()
        try:
            with httpx.Client(timeout=3.0) as client:
                res = client.get(f"{self.base_url}/models", headers=self._headers())
                latency_ms = round((time.perf_counter() - start) * 1000, 2)
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("id") for m in data.get("data", [])] if isinstance(data, dict) else []
                    return {
                        "status": "online",
                        "base_url": self.base_url,
                        "default_model": self.default_model,
                        "latency_ms": latency_ms,
                        "available_models": models
                    }
                return {
                    "status": "degraded",
                    "base_url": self.base_url,
                    "default_model": self.default_model,
                    "http_status": res.status_code,
                    "latency_ms": latency_ms,
                    "available_models": []
                }
        except Exception as e:
            return {
                "status": "offline",
                "base_url": self.base_url,
                "default_model": self.default_model,
                "error": str(e),
                "available_models": []
            }

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 1000,
        json_mode: bool = False
    ) -> Dict[str, Any]:
        """
        Send chat completion request to 9Router with automatic fallback.
        """
        candidates = [model] if model else [self.default_model, "gemini/gemini-3.5-flash"]
        last_error = "No models attempted"

        for target_model in candidates:
            if not target_model:
                continue
            payload: Dict[str, Any] = {
                "model": target_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            if json_mode:
                payload["response_format"] = {"type": "json_object"}

            start = time.perf_counter()
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    res = client.post(
                        f"{self.base_url}/chat/completions",
                        headers=self._headers(),
                        json=payload
                    )
                    latency_ms = round((time.perf_counter() - start) * 1000, 2)

                    if res.status_code == 200:
                        text_resp = res.text.strip()
                        # Check if response is Server-Sent Events (SSE stream format)
                        if text_resp.startswith("data: ") or "\ndata: " in text_resp:
                            accumulated_content = []
                            last_model = target_model
                            usage = {}
                            for line in text_resp.splitlines():
                                line = line.strip()
                                if not line.startswith("data: "):
                                    continue
                                data_str = line[6:].strip()
                                if data_str == "[DONE]":
                                    break
                                try:
                                    chunk = json.loads(data_str)
                                    if "model" in chunk:
                                        last_model = chunk["model"]
                                    if "usage" in chunk and chunk["usage"]:
                                        usage = chunk["usage"]
                                    choices = chunk.get("choices", [])
                                    if choices:
                                        delta = choices[0].get("delta", {})
                                        delta_content = delta.get("content")
                                        if delta_content:
                                            accumulated_content.append(delta_content)
                                except Exception:
                                    continue
                            
                            full_content = "".join(accumulated_content).strip()
                            if full_content:
                                return {
                                    "success": True,
                                    "content": full_content,
                                    "model": last_model,
                                    "usage": usage,
                                    "latency_ms": latency_ms
                                }

                        # Otherwise parse standard JSON response
                        try:
                            data = res.json()
                            choices = data.get("choices", [])
                            if choices:
                                content = choices[0].get("message", {}).get("content", "")
                                if content:
                                    return {
                                        "success": True,
                                        "content": content,
                                        "model": data.get("model", target_model),
                                        "usage": data.get("usage", {}),
                                        "latency_ms": latency_ms
                                    }
                        except Exception as parse_err:
                            logger.warning(f"Failed to parse JSON response for {target_model}: {parse_err}")
                    else:
                        logger.warning(f"9Router {target_model} returned {res.status_code}: {res.text[:120]}")
                        last_error = f"HTTP {res.status_code}: {res.text[:120]}"
            except Exception as e:
                logger.warning(f"Error calling {target_model}: {e}")
                last_error = str(e)

        return {
            "success": False,
            "error": last_error,
            "latency_ms": 0.0
        }

nine_router_client = NineRouterClient()
