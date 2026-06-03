"""
Translation API: proxies translation requests to MyMemory's free public endpoint.
"""
from __future__ import annotations

import asyncio
import re
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from api.auth import get_current_user
from api.schemas import TranslateRequest, TranslateResponse
from models.models import User

router = APIRouter(prefix="/api", tags=["translate"])

CHUNK_SIZE = 480  # safe below MyMemory's ~500 char limit
SPLIT_PATTERN = re.compile(r"(?<=[。.!?！？\n])\s*")
REQUEST_TIMEOUT = 10.0


def _split_into_chunks(text: str) -> List[str]:
    """Split text into chunks <= CHUNK_SIZE, breaking on sentence boundaries."""
    text = text.strip()
    if len(text) <= CHUNK_SIZE:
        return [text]
    parts = SPLIT_PATTERN.split(text)
    chunks: List[str] = []
    current = ""
    for part in parts:
        if not part:
            continue
        if len(current) + len(part) + 1 <= CHUNK_SIZE:
            current = f"{current}{part}" if current else part
        else:
            if current:
                chunks.append(current)
            if len(part) > CHUNK_SIZE:
                # Hard-split a too-long segment on whitespace or hard cut
                for i in range(0, len(part), CHUNK_SIZE):
                    chunks.append(part[i : i + CHUNK_SIZE])
                current = ""
            else:
                current = part
    if current:
        chunks.append(current)
    return chunks


async def _call_mymemory(text: str, source: str, target: str) -> str:
    """Call MyMemory once for a single chunk. Returns translated text."""
    params = {"q": text, "langpair": f"{source}|{target}"}
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        resp = await client.get(
            "https://api.mymemory.translated.net/get", params=params
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MyMemory returned HTTP {resp.status_code}",
        )
    data = resp.json()
    translated = (data.get("responseData") or {}).get("translatedText", "")
    status_code = data.get("responseStatus")
    if status_code and int(status_code) >= 400:
        # MyMemory returns 200 with an error payload on quota/rate issues
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MyMemory error: {data.get('responseDetails', 'unknown')}",
        )
    return translated


@router.post("/translate", response_model=TranslateResponse)
async def translate(
    body: TranslateRequest,
    current_user: User = Depends(get_current_user),
) -> TranslateResponse:
    chunks = _split_into_chunks(body.text)
    if len(chunks) == 1:
        translated = await _call_mymemory(chunks[0], body.source, body.target)
    else:
        results = await asyncio.gather(
            *[
                _call_mymemory(chunk, body.source, body.target)
                for chunk in chunks
            ]
        )
        translated = "".join(results)
    return TranslateResponse(translated=translated, provider="mymemory")
