# Native YouTube playback investigation — 2026-10-15

Requested outcome: paste a YouTube link and play native media inside RAJA without the ad-supported iframe.

**Status: blocked; no production playback change deployed.** Diagnostics completing successfully means the probes ran, not that playback succeeded.

## Live evidence

GitHub Actions run: https://github.com/mrabdulmohsinalotaibi-beep/RAJA/actions/runs/38769199699

Test video: `aqz-KE-bpKQ` (Blender Foundation Big Buck Bunny). Earlier probes used `BaW_jenozKc`, which returned video-unavailable and was replaced for extractor validation.

| Path | Actual result |
| --- | --- |
| All 15 Piped APIs currently linked in the project's public-instance documentation | Connection failures, HTTP 403/500/502/526; no usable stream |
| All 5 public Invidious instances currently documented | HTTP 401/403/500; no usable stream |
| Existing RAJA Render backend, direct public formats request | HTTP 422; extractor could not read video |
| Current youtubei.js, native audio-format resolution | Streaming data not available |
| yt-dlp 2026.8.19, current default clients and Node runtime | Sign in to confirm you're not a bot |
| bgutil PO-token plugin + provider 2.0.2, mweb/web_safari/android_vr | Same login/bot restriction before a usable format was available |
| Production Pages formats API without a user session | HTTP 401, expected authentication requirement; not a media extraction result |

No native media delivery succeeded. No accounts/cookies were used. No media retained. Results are specific to the tested hosts/network and time; they do not establish that these projects never work elsewhere.

## Implications

The current failure happens before a native player receives media. UI changes, hiding the iframe, or labeling a button ad-free cannot resolve that. A different authorized extraction connection/backend would need to demonstrate actual media-byte delivery, seeking and playback before integration. A PO token does not itself solve IP-based login restrictions.

Any eventual integration should keep expiring source URLs server-side, validate video identifiers, support byte ranges and expiry recovery, and preserve RAJA's native pause/resume and checkpoints. Never silently substitute the ad-supported iframe for a promised ad-free mode.

## Primary references

- https://docs.piped.video/docs/api-documentation/
- https://github.com/TeamPiped/documentation/blob/main/content/docs/public-instances/index.md
- https://docs.invidious.io/instances/
- https://ytjs.dev/guide/browser-usage
- https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
- https://github.com/Brainicism/bgutil-ytdlp-pot-provider

The diagnostic workflow is opt-in (pull request changes to its own files or manual dispatch), uses read-only repository permissions and bounded request timeouts. It has no production deploy hook.
