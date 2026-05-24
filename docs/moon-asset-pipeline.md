# Moon assets (header orb)

## Source

- **Master:** `mission_2160p30.mp4` — full scene **7:38** (458.23 s), 3840×2160, local only (not deployed).
- Header uses full timeline encoded to WebM (under Cloudflare 24 MB via ~1280px + adaptive bitrate).

## Production output

| File | Use |
|------|-----|
| `mission_2160p30_alpha.webm` | VP9 + alpha, full length |
| `mission_2160p30_meta.json` | Duration / bitrate metadata from build |

```bash
npm run moon:build-alpha
```

Env: `MOON_TARGET_MB` (default 22), `MOON_SCALE_WIDTH` (default 1280), `MOON_TRIM_SECONDS` (0 = full video).

## Playback (site-shell)

- Night window: yesterday/today sunset → today/tomorrow sunrise (Open-Meteo astro).
- Video position: `nightProgress × 458.23 s` (entire clip spans the local night).
- Handoff to sun: **42 min** crossfade at dusk/dawn (opacity stack, moon + sun overlays).
