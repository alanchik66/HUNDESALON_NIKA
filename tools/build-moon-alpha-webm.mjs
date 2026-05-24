/**
 * Builds header Moon WebM (VP9 alpha) from full mission_2160p30.mp4 (~7:38).
 *
 * Usage: npm run moon:build-alpha
 * Env: MOON_SCALE_WIDTH, MOON_TARGET_MB (default 22), MOON_TRIM_SECONDS=0 → full length
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moonDir = path.join(root, '3d-weather-codrops-main/dist-widget/assets/Moon');

const TRIM_SECONDS = Number(process.env.MOON_TRIM_SECONDS || 0);
const SCALE_WIDTH = Number(process.env.MOON_SCALE_WIDTH || 1280);
const TARGET_MB = Number(process.env.MOON_TARGET_MB || 22);
const BUILD_FALLBACK_MP4 = process.env.MOON_BUILD_FALLBACK_MP4 === '1';

const MP4_SOURCE = path.join(moonDir, 'mission_2160p30.mp4');
const WEBM_OUT = path.join(moonDir, 'mission_2160p30_alpha.webm');
const FALLBACK_MP4_OUT = path.join(moonDir, 'mission_2160p30_fallback.mp4');
const DURATION_META_OUT = path.join(moonDir, 'mission_2160p30_meta.json');

const LEGACY_FILES = ['mission_720p30.mp4', 'mission_720p30_alpha.webm', 'moon_alpha_from_mp4.webm'];

function resolveFfmpeg() {
  const local = path.join(root, 'tools/ffmpeg/bin/ffmpeg.exe');
  if (fs.existsSync(local)) {
    return local;
  }
  return 'ffmpeg';
}

function runFfmpeg(ffmpeg, args) {
  const result = spawnSync(ffmpeg, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function probeDurationSeconds(ffmpeg, filePath) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-i', filePath], {
    encoding: 'utf8',
    shell: false,
  });
  const text = `${result.stderr || ''}${result.stdout || ''}`;
  const match = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function removeLegacyAssets() {
  for (const name of LEGACY_FILES) {
    const target = path.join(moonDir, name);
    if (!fs.existsSync(target)) {
      continue;
    }
    fs.unlinkSync(target);
    console.log(`Removed legacy ${name}`);
  }
}

function buildWebm(ffmpeg, durationSec, bitrateK) {
  const key = 'format=rgba,colorkey=0x000000:0.08:0.05';
  const scale = `scale=${SCALE_WIDTH}:-2:flags=lanczos`;
  const trim = TRIM_SECONDS > 0 ? `trim=0:${TRIM_SECONDS},setpts=PTS-STARTPTS,` : '';
  const filter = `[0:v]${trim}${key},${scale},format=yuva420p[out]`;

  console.log(
    `Encoding ${path.basename(WEBM_OUT)} (${durationSec.toFixed(1)}s, ${SCALE_WIDTH}px, ${bitrateK}k)…`
  );

  runFfmpeg(ffmpeg, [
    '-y',
    '-i',
    MP4_SOURCE,
    '-filter_complex',
    filter,
    '-map',
    '[out]',
    '-an',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    `${bitrateK}k`,
    '-pix_fmt',
    'yuva420p',
    '-auto-alt-ref',
    '0',
    '-deadline',
    'good',
    '-cpu-used',
    '2',
    '-row-mt',
    '1',
    '-tile-columns',
    '2',
    '-threads',
    '0',
    '-metadata:s:v:0',
    'alpha_mode=1',
    WEBM_OUT,
  ]);

  const sizeMb = fs.statSync(WEBM_OUT).size / (1024 * 1024);
  console.log(`Done: ${WEBM_OUT} (${sizeMb.toFixed(2)} MB)`);

  if (sizeMb > 24) {
    console.warn('Warning: exceeds Cloudflare Pages 24 MB limit. Lower MOON_TARGET_MB or MOON_SCALE_WIDTH.');
  }

  return sizeMb;
}

function buildFallbackMp4(ffmpeg, durationSec) {
  const trim = TRIM_SECONDS > 0 ? `trim=0:${TRIM_SECONDS},setpts=PTS-STARTPTS,` : '';
  const filter = `${trim}scale=${SCALE_WIDTH}:-2:flags=lanczos`;

  console.log(`Encoding Safari fallback ${path.basename(FALLBACK_MP4_OUT)}…`);

  runFfmpeg(ffmpeg, [
    '-y',
    '-i',
    MP4_SOURCE,
    '-vf',
    filter,
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '26',
    '-preset',
    'medium',
    FALLBACK_MP4_OUT,
  ]);

  const sizeMb = (fs.statSync(FALLBACK_MP4_OUT).size / (1024 * 1024)).toFixed(2);
  console.log(`Done: ${FALLBACK_MP4_OUT} (${sizeMb} MB)`);
}

const ffmpeg = resolveFfmpeg();
const version = spawnSync(ffmpeg, ['-version'], { encoding: 'utf8' });
if (version.status !== 0) {
  console.error('ffmpeg not found.');
  process.exit(1);
}

if (!/enable-libvpx/i.test(version.stdout || '')) {
  console.error('ffmpeg build must include libvpx for VP9 alpha WebM.');
  process.exit(1);
}

if (!fs.existsSync(MP4_SOURCE)) {
  console.error(`Missing source: ${MP4_SOURCE}`);
  process.exit(1);
}

const sourceDuration = probeDurationSeconds(ffmpeg, MP4_SOURCE);
if (!sourceDuration) {
  console.error('Could not read mission_2160p30.mp4 duration.');
  process.exit(1);
}

const outputDuration = TRIM_SECONDS > 0 ? Math.min(TRIM_SECONDS, sourceDuration) : sourceDuration;
/** VP9 + alpha overshoots nominal -b:v (~1.9× in practice for this asset). */
const VP9_ALPHA_BITRATE_FACTOR = Number(process.env.MOON_VP9_FACTOR || 1.92);
const bitrateK = Math.max(
  140,
  Math.floor(((TARGET_MB * 1024 * 8) / outputDuration - 40) / VP9_ALPHA_BITRATE_FACTOR)
);

console.log(`Source duration: ${sourceDuration.toFixed(3)}s (${formatHms(sourceDuration)})`);
console.log(`Output duration: ${outputDuration.toFixed(3)}s, target ~${TARGET_MB} MB → ${bitrateK} kbit/s`);

buildWebm(ffmpeg, outputDuration, bitrateK);
if (BUILD_FALLBACK_MP4) {
  buildFallbackMp4(ffmpeg, outputDuration);
}
removeLegacyAssets();

const webmDuration = probeDurationSeconds(ffmpeg, WEBM_OUT) || outputDuration;
fs.writeFileSync(
  DURATION_META_OUT,
  `${JSON.stringify(
    {
      sourceDurationSec: sourceDuration,
      webmDurationSec: webmDuration,
      scaleWidth: SCALE_WIDTH,
      bitrateK,
    },
    null,
    2
  )}\n`
);
console.log(`Wrote ${DURATION_META_OUT}`);

function formatHms(seconds) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
