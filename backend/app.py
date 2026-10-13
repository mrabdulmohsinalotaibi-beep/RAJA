"""
RAJA private-free-media-backend.
Processes one YouTube video at a time and sends the file to the requester's device.
Requires ffmpeg, Python, yt-dlp. Never stores media permanently.
"""
import asyncio
import os
import re
import shutil
import tempfile
import time
from collections import defaultdict, deque
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

app = FastAPI(title="RAJA Media Backend", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://raja.athat.app", "https://raja-eyh.pages.dev"],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)

QUALITY = (144, 240, 360, 480, 720, 1080)
MAX_BYTES = 300 * 1024 * 1024
MAX_DURATION = 60 * 60  # limit volunteer/free server resources
VIDEO_ID = re.compile(r"^[a-zA-Z0-9_-]{11}$")
ACTIVE_DOWNLOADS = asyncio.Semaphore(2)
RATE: dict[str, deque] = defaultdict(deque)
RATE_LOCK = asyncio.Lock()
MAX_REQUESTS_PER_HOUR = 100


def canonical_url(raw: str) -> tuple[str, str]:
    try:
        u = urlsplit(raw)
        if u.scheme != "https" and u.scheme != "http":
            raise ValueError("Scheme")
        host = (u.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        if host.startswith("m."):
            host = host[2:]
        if host == "youtu.be":
            video_id = u.path.strip("/").split("/")[0]
        elif host in ("youtube.com", "youtube-nocookie.com"):
            if u.path == "/watch":
                video_id = parse_qs(u.query).get("v", [""])[0]
            elif u.path.startswith(("/shorts/", "/live/", "/embed/")):
                video_id = u.path.strip("/").split("/")[1]
            else:
                raise ValueError("not video URL")
        else:
            raise ValueError("not YouTube")
        if not VIDEO_ID.fullmatch(video_id):
            raise ValueError("bad video ID")
        return video_id, "https://www.youtube.com/watch?v=" + video_id
    except (ValueError, IndexError) as exc:
        raise HTTPException(400, "أدخل رابط فيديو YouTube صالحًا.") from exc


def youtube_options() -> dict:
    return {
        "noplaylist": True,
        "extract_flat": False,
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "socket_timeout": 12,
        "retries": 2,
        "fragment_retries": 2,
        "ignoreerrors": False,
        "no_color": True,
        "age_limit": 18,
    }


def extract_info(url: str) -> dict:
    with YoutubeDL(youtube_options()) as ydl:
        return ydl.extract_info(url, download=False)


def check_info(info: dict) -> None:
    if not info:
        raise HTTPException(422, "لم يتمكن YouTube من إتاحة بيانات المقطع.")
    duration = info.get("duration")
    if duration and duration > MAX_DURATION:
        raise HTTPException(422, "هذا المقطع أطول من ساعة؛ الخادم المجاني لا يدعم هذا الحجم.")


async def limit(request: Request) -> None:
    # Avoid trusting client-provided X-Forwarded-For chains.
    address = request.client.host if request.client else "unknown"
    async with RATE_LOCK:
        q = RATE[address]
        now = time.monotonic()
        while q and now - q[0] > 3600:
            q.popleft()
        if len(q) >= MAX_REQUESTS_PER_HOUR:
            raise HTTPException(429, "تجاوزت عدد المحاولات خلال الساعة. أعد المحاولة لاحقًا.")
        q.append(now)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "raja-media-backend"}


@app.get("/api/formats")
async def formats(request: Request, url: str = Query(..., max_length=500)) -> dict:
    await limit(request)
    video_id, canonical = canonical_url(url)
    try:
        info = await asyncio.wait_for(asyncio.to_thread(extract_info, canonical), timeout=65)
        check_info(info)
    except DownloadError as exc:
        raise HTTPException(422, "لم يتمكن الخادم المجاني من قراءة المقطع؛ قد يطلب YouTube التحقق من المستخدم.") from exc
    except TimeoutError as exc:
        raise HTTPException(504, "انتهت مهلة استعلام المقطع.") from exc
    formats = info.get("formats") or []
    videos = [f for f in formats if f.get("vcodec") not in (None, "none") and f.get("height") and
              (f.get("ext") == "mp4" or f.get("container") == "mp4")]
    audios = [f for f in formats if f.get("acodec") not in (None, "none")]
    sizes = sorted({int(f.get("height")) for f in videos if f.get("height") and int(f["height"]) <= 1080})
    # List only ceilings for resolutions actually present (no phantom 1080p on 360p video).
    qualities = sorted({next(q for q in QUALITY if q >= n) for n in sizes})
    choices = [{"format": "mp4", "quality": q, "kind": "video"} for q in qualities]
    if audios:
        choices.append({"format": "mp3", "quality": 192, "kind": "audio"})
    return {
        "ok": bool(choices),
        "id": video_id,
        "title": (info.get("title") or "RAJA")[:160],
        "duration": info.get("duration"),
        "choices": choices,
        "note": "تنزيل MP3 يحتاج FFmpeg. لا تعمل بعض روابط YouTube دون تسجيل الدخول.",
    }


def download_media(url: str, kind: str, quality: int, directory: str) -> Path:
    def progress(info: dict) -> None:
        if info.get("status") == "downloading" and info.get("downloaded_bytes", 0) > MAX_BYTES:
            raise DownloadError("Video exceeds free tier file size")

    def reject_long_video(info: dict, *, incomplete: bool = False) -> str | None:
        if info.get("duration") and info["duration"] > MAX_DURATION:
            return "Video exceeds free tier duration"
        return None

    opts = youtube_options()
    opts.update({
        "skip_download": False,
        "outtmpl": {"default": os.path.join(directory, "%(id)s.%(ext)s")},
        "max_filesize": MAX_BYTES,
        "continuedl": False,
        "overwrites": True,
        "progress_hooks": [progress],
        "match_filter": reject_long_video,
    })
    if kind == "mp3":
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}]
    else:
        # Prefer actual MP4 video plus M4A audio to avoid incompatible files.
        opts["format"] = (
            f"bestvideo[height<={quality}][ext=mp4]+bestaudio[ext=m4a]/"
            f"best[height<={quality}][ext=mp4]"
        )
        opts["merge_output_format"] = "mp4"
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
    if not info:
        raise RuntimeError("لم يتمكن yt-dlp من تنزيل المقطع.")
    extension = ".mp3" if kind == "mp3" else ".mp4"
    files = [p for p in Path(directory).glob("*") if p.is_file() and p.suffix.lower() == extension]
    if not files:
        raise RuntimeError("تعذّر تجهيز الملف بالصيغة المطلوبة.")
    path = max(files, key=lambda p: p.stat().st_size)
    if path.stat().st_size > MAX_BYTES:
        raise RuntimeError("الملف أكبر من 300 ميجابايت المسموح بها على الخادم المجاني.")
    return path


async def cleanup_temp(directory: str) -> None:
    shutil.rmtree(directory, ignore_errors=True)
    ACTIVE_DOWNLOADS.release()


@app.get("/api/download")
async def download(
    request: Request,
    url: str = Query(..., max_length=500),
    format: str = Query("mp4", pattern="^(mp4|mp3)$"),
    quality: int = Query(720, ge=144, le=1080),
):
    await limit(request)
    video_id, canonical = canonical_url(url)
    if format == "mp4" and quality not in QUALITY:
        raise HTTPException(400, "جودة الفيديو غير مدعومة.")
    try:
        await asyncio.wait_for(ACTIVE_DOWNLOADS.acquire(), timeout=1.0)
    except TimeoutError as exc:
        raise HTTPException(429, "الخادم مشغول بتنزيلات أخرى. أعد المحاولة بعد قليل.") from exc
    tempdir = tempfile.mkdtemp(prefix="raja_")
    try:
        output = await asyncio.to_thread(download_media, canonical, format, quality, tempdir)
        return FileResponse(
            str(output),
            filename=f"raja-{video_id}.{format}",
            media_type="audio/mpeg" if format == "mp3" else "video/mp4",
            headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
            background=BackgroundTask(cleanup_temp, tempdir),
        )
    except DownloadError as exc:
        shutil.rmtree(tempdir, ignore_errors=True)
        ACTIVE_DOWNLOADS.release()
        raise HTTPException(422, "تعذر التنزيل من YouTube. قد تكون هناك حماية أو قيود أو حاجة إلى تسجيل الدخول.") from exc
    except Exception as exc:
        shutil.rmtree(tempdir, ignore_errors=True)
        ACTIVE_DOWNLOADS.release()
        raise HTTPException(502, "فشل تجهيز الملف. أعد المحاولة بصيغة أو جودة أخرى.") from exc
