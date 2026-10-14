import os
import re
from urllib.parse import urlparse

import yt_dlp
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, HttpUrl

app = FastAPI(title="VideosDropper Self-Hosted Resolver", docs_url=None, redoc_url=None)
SECRET = os.environ.get("RESOLVER_SECRET", "")
SHORTCODE_PATH = re.compile(r"^/(reel|reels|p|tv)/[A-Za-z0-9_-]+/?$")


class ResolveRequest(BaseModel):
    url: HttpUrl


def validate_instagram_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname not in {
        "instagram.com", "www.instagram.com", "m.instagram.com"
    }:
        raise HTTPException(status_code=400, detail="Use a public Instagram Reel, video, or post URL.")
    if not SHORTCODE_PATH.fullmatch(parsed.path):
        raise HTTPException(status_code=400, detail="Unsupported Instagram URL format.")
    return value


def choose_video(info):
    entries = info.get("entries") if isinstance(info, dict) else None
    candidates = list(entries or []) if entries else [info]
    for entry in candidates:
        if not isinstance(entry, dict):
            continue
        formats = entry.get("formats") or []
        formats = sorted(
            formats,
            key=lambda item: (
                item.get("vcodec") not in (None, "none"),
                item.get("ext") == "mp4",
                item.get("height") or 0,
                item.get("tbr") or 0,
            ),
            reverse=True,
        )
        for item in formats:
            url = item.get("url")
            if (
                isinstance(url, str)
                and url.startswith("https://")
                and item.get("vcodec") != "none"
                and item.get("ext") in ("mp4", "m4v", "mov")
            ):
                return {
                    "downloadUrl": url,
                    "title": (entry.get("title") or info.get("title") or "Instagram video")[:180],
                }
        direct_url = entry.get("url")
        if isinstance(direct_url, str) and direct_url.startswith("https://") and entry.get("ext") == "mp4":
            return {
                "downloadUrl": direct_url,
                "title": (entry.get("title") or "Instagram video")[:180],
            }
    return None


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/resolve")
def resolve(body: ResolveRequest, x_resolver_secret: str | None = Header(default=None)):
    if not SECRET:
        raise HTTPException(status_code=503, detail="Resolver secret is not configured.")
    if not x_resolver_secret or x_resolver_secret != SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized.")
    target = validate_instagram_url(str(body.url))
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 12,
        "retries": 1,
        "extractor_retries": 1,
        "ignoreerrors": False,
    }
    try:
        with yt_dlp.YoutubeDL(options) as downloader:
            info = downloader.extract_info(target, download=False)
        result = choose_video(info)
        if result:
            return result
        raise HTTPException(status_code=422, detail="No downloadable public video was found for this post.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Instagram blocked the request or did not expose public video media. Try again later.",
        )
