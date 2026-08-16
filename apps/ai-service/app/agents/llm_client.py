"""Single place the AI service talks to an LLM provider.

Uses an OpenAI-compatible chat-completions endpoint so the provider is a
configuration choice, not an architectural one (research.md §2). Agents
depend on this thin wrapper rather than any vendor SDK, which is what
makes swapping providers a config change.
"""

from __future__ import annotations

import json
from typing import Any, Protocol

import httpx

from app.config import settings


class ChatClient(Protocol):
    """What the agents actually need — small enough that tests can supply
    a stub without pulling in a vendor SDK."""

    def complete(self, prompt: str, *, max_tokens: int) -> str: ...


class LlmError(RuntimeError):
    """Raised when the provider rejects the request or returns something
    unusable. Callers decide whether that's fatal."""


class OpenAiCompatibleClient:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        self._api_key = api_key or settings.llm_api_key
        self._base_url = (base_url or settings.llm_base_url).rstrip("/")
        self._model = model or settings.llm_model
        self._client = client or httpx.Client(timeout=30.0)

    def complete(self, prompt: str, *, max_tokens: int) -> str:
        if not self._api_key:
            raise LlmError(
                "No LLM API key configured — set LLM_API_KEY in apps/ai-service/.env"
            )
        try:
            response = self._client.post(
                f"{self._base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise LlmError(str(exc)) from exc

        payload: dict[str, Any] = response.json()
        try:
            return str(payload["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError) as exc:
            raise LlmError(f"Unexpected response shape from LLM provider: {payload}") from exc


def parse_json_reply(raw_text: str) -> Any:
    """Models often wrap JSON in a ```json fence, or add a sentence around
    it. Tolerate both rather than failing the whole prediction over
    formatting."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fall back to the outermost {...} block if the model added prose.
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise
