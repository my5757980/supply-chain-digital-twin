"""Shared stub LLM client for agent tests.

Agents depend on the small `ChatClient` protocol rather than a vendor SDK,
so tests can supply this instead of mocking HTTP or an SDK object.
"""

from __future__ import annotations

import json
from typing import Any


class StubChatClient:
    def __init__(self, reply_text: str) -> None:
        self.reply_text = reply_text
        self.prompts: list[str] = []

    def complete(self, prompt: str, *, max_tokens: int) -> str:
        self.prompts.append(prompt)
        return self.reply_text


def json_reply(payload: dict[str, Any]) -> str:
    return json.dumps(payload)


def fenced_json_reply(payload: dict[str, Any]) -> str:
    """Models commonly wrap JSON in a markdown fence — the parser must
    tolerate it."""
    return "```json\n" + json.dumps(payload) + "\n```"
