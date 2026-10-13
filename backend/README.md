# RAJA free backend

An optional single-purpose media processing API written in FastAPI with yt-dlp + FFmpeg. It downloads eligible public YouTube media into a temporary file, converts if requested, and streams the result to the requesting device. No file is retained after a successful response.

## Deploy to Render (free plan)

1. Connect the GitHub repo `mrabdulmohsinalotaibi-beep/RAJA` to Render.
2. Create a Blueprint using `render.yaml`, or create a Web Service using Docker, root directory `backend`, and `backend/Dockerfile`.
3. Verify `https://<service-host>/health` shows `{"ok":true}`.
4. In Cloudflare Pages **raja**, Production environment variables, set `MEDIA_BACKEND_URL=https://<service-host>` (HTTPS only, without a trailing slash).
5. Redeploy Cloudflare Pages after setting the variable.

Do not copy an untrusted backend URL or connect unknown public services. Server-side requests in the API accept only validated YouTube video identifiers. Cloudflare Pages forwards requests using a private, server-side configured hostname.

Endpoints:
- `GET /health`
- `GET /api/formats?url=https%3A%2F%2Fyoutu.be%2F...`
- `GET /api/download?url=...&format=mp4&quality=720`
- `GET /api/download?url=...&format=mp3&quality=192`

**Free plan caveats:** sleeping instances need to wake; a YouTube anti-bot/login block can prevent downloads; processing and bandwidth are bounded. No promises that any specific video downloads, and do not use on content you do not have permission to save.

Security note: The API has a simple in-memory per-IP throttle, limited concurrency, restricted domains, and a 300 MB output limit. For public production use with many users, add stronger abuse controls and monitoring. The backend stores no user accounts or media libraries.
