/**
 * Rebuilds header Sun WebM: padded square canvas (flares not clipped),
 * gentle black key (keeps corona), ~2× perceived brightness.
 *
 * Source: nasa_sun_loop.mp4 (NASA SDO, see sun:fetch-nasa) or legacy MP4.
 * Output: sun_alpha.webm (VP9 yuva420p)
 *
 * Usage: npm run sun:fetch-nasa && npm run sun:build-alpha
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sunDir = path.join(root, '3d-weather-codrops-main/dist-widget/assets/Sun');

const LOOP_SECONDS = Number(process.env.SUN_LOOP_SECONDS || 10);
const BITRATE_K = Number(process.env.SUN_WEBM_BITRATE_K || 4200);
const CANVAS_SIZE = Number(process.env.SUN_CANVAS_SIZE || 1080);
const BRIGHTNESS = Number(process.env.SUN_BRIGHTNESS || 0.28);
const VERTICAL_BIAS = Number(process.env.SUN_PAD_Y_BIAS || 0.04);
/** Preserve dim star pixels when keying black space (NASA SDO on black). */
const KEY_SIMILARITY = Number(process.env.SUN_KEY_SIMILARITY || 0.12);
const KEY_BLEND = Number(process.env.SUN_KEY_BLEND || 0.06);

/** Prefer Eyes screen capture if imported via sun:import-reference */
const MP4_CANDIDATES = ['sun_reference.mp4', 'nasa_sun_loop.mp4', 'sun_source.mp4'];

const WEBM_OUT = path.join(sunDir, 'sun_alpha.webm');

function resolveFfmpeg() {
  const local = path.join(root, 'tools/ffmpeg/bin/ffmpeg.exe');
  if (fs.existsSync(local)) {
    return local;
  }
  return 'ffmpeg';
}

function resolveMp4Source() {
  for (const name of MP4_CANDIDATES) {
    const candidate = path.join(sunDir, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).size > 50000) {
      return candidate;
    }
  }
  return null;
}

function runFfmpeg(ffmpeg, args) {
  const result = spawnSync(ffmpeg, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function buildFromMp4(ffmpeg, mp4Source) {
  const padY = `(${CANVAS_SIZE}-ih)/2+ih*${VERTICAL_BIAS}`;
  const filter = [
    `[0:v]trim=0:${LOOP_SECONDS},setpts=PTS-STARTPTS`,
    'format=rgba',
    `colorkey=0x000000:${KEY_SIMILARITY}:${KEY_BLEND}`,
    `eq=brightness=${BRIGHTNESS}:saturation=1.14:contrast=1.06:gamma=0.92`,
    `scale=${CANVAS_SIZE}:-2:force_original_aspect_ratio=decrease:flags=lanczos`,
    `pad=${CANVAS_SIZE}:${CANVAS_SIZE}:(ow-iw)/2:${padY}:color=0x00000000`,
    'format=yuva420p[out]',
  ].join(',');

  console.log(
    `Encoding ${path.basename(WEBM_OUT)} (${LOOP_SECONDS}s, ${CANVAS_SIZE}px square, brightness +${BRIGHTNESS})…`
  );

  runFfmpeg(ffmpeg, [
    '-y',
    '-i',
    mp4Source,
    '-filter_complex',
    filter,
    '-map',
    '[out]',
    '-an',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    `${BITRATE_K}k`,
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

  const sizeMb = (fs.statSync(WEBM_OUT).size / (1024 * 1024)).toFixed(2);
  console.log(`Done: ${WEBM_OUT} (${sizeMb} MB)`);
}

const ffmpeg = resolveFfmpeg();
const version = spawnSync(ffmpeg, ['-version'], { encoding: 'utf8' });
if (version.status !== 0) {
  console.error('ffmpeg not found. Install ffmpeg with libvpx or add tools/ffmpeg/bin.');
  process.exit(1);
}

if (!/enable-libvpx/i.test(version.stdout || '')) {
  console.error('ffmpeg build must include libvpx for VP9 alpha WebM.');
  process.exit(1);
}

const mp4Source = resolveMp4Source();
if (!mp4Source) {
  console.error(`Missing Sun MP4 in ${sunDir}`);
  process.exit(1);
}

buildFromMp4(ffmpeg, mp4Source);
