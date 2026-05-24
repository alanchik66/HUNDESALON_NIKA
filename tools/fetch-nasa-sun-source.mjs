/**
 * NASA visible-style Sun disk (warm gold, not UV-blue AIA 335) + short loop MP4.
 *
 * Usage: npm run sun:fetch-nasa
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sunDir = path.join(root, '3d-weather-codrops-main/dist-widget/assets/Sun');

/** SDO/HMI-style full disk (continuum — golden, not AIA 335 blue). */
const NASA_IMAGE_URL =
  'https://images-assets.nasa.gov/image/GSFC_20110919_Archive_e001795/GSFC_20110919_Archive_e001795~orig.jpg';
const JPG_RAW = path.join(sunDir, 'nasa_sun_disk.jpg');
const JPG_WARM = path.join(sunDir, 'nasa_sun_warm.jpg');
const MP4_OUT = path.join(sunDir, 'nasa_sun_loop.mp4');

const LOOP_SECONDS = Number(process.env.SUN_LOOP_SECONDS || 10);
const FPS = 30;

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

async function downloadNasaImage() {
  fs.mkdirSync(sunDir, { recursive: true });
  if (fs.existsSync(JPG_RAW) && fs.statSync(JPG_RAW).size > 50000) {
    console.log(`Using existing ${path.basename(JPG_RAW)}`);
    return;
  }
  console.log(`Downloading NASA HMI-style full disk…\n  ${NASA_IMAGE_URL}`);
  const response = await fetch(NASA_IMAGE_URL, {
    redirect: 'follow',
    headers: { 'User-Agent': 'HUNDESALON-NIKA/1.0 (sun-asset-pipeline)' },
  });
  if (!response.ok) {
    throw new Error(`NASA image download failed: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 50000) {
    throw new Error('NASA image download too small — likely blocked or invalid.');
  }
  fs.writeFileSync(JPG_RAW, buffer);
  console.log(`Saved ${JPG_RAW} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
}

function buildWarmDisk(ffmpeg) {
  const warmFilter = [
    'eq=gamma=0.92:contrast=1.08:brightness=0.04:saturation=1.22',
    'hue=h=18:s=1.18',
    'colorchannelmixer=rr=1.18:rg=0.1:rb=0.02:gr=0.06:gg=0.92:gb=0.04:br=0.01:bg=0.28:bb=0.42',
  ].join(',');

  console.log(`Grading warm visible Sun → ${path.basename(JPG_WARM)}…`);
  runFfmpeg(ffmpeg, ['-y', '-i', JPG_RAW, '-vf', warmFilter, '-q:v', '2', JPG_WARM]);
}

function buildLoopMp4(ffmpeg) {
  const sourceJpg = fs.existsSync(JPG_WARM) ? JPG_WARM : JPG_RAW;
  const frames = LOOP_SECONDS * FPS;
  const filter = [
    `scale=1920:1920:force_original_aspect_ratio=decrease:flags=lanczos`,
    `pad=1920:1920:(ow-iw)/2:(oh-ih)/2:color=0x000000`,
    `zoompan=z='1+0.04*sin(2*PI*on/${frames})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1920:fps=${FPS}`,
    `rotate=2*PI*t/${LOOP_SECONDS}:c=none:ow=1920:oh=1920`,
    `eq=brightness=0.06:saturation=1.12:contrast=1.04`,
    `unsharp=3:3:0.35:3:3:0.0`,
  ].join(',');

  console.log(`Building ${path.basename(MP4_OUT)} (${LOOP_SECONDS}s @ ${FPS}fps, Earth-view roll)…`);

  runFfmpeg(ffmpeg, [
    '-y',
    '-loop',
    '1',
    '-i',
    sourceJpg,
    '-vf',
    filter,
    '-t',
    String(LOOP_SECONDS),
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '18',
    '-preset',
    'medium',
    MP4_OUT,
  ]);

  console.log(`Done: ${MP4_OUT} (${(fs.statSync(MP4_OUT).size / (1024 * 1024)).toFixed(2)} MB)`);
}

const ffmpeg = resolveFfmpeg();
if (spawnSync(ffmpeg, ['-version'], { encoding: 'utf8' }).status !== 0) {
  console.error('ffmpeg not found.');
  process.exit(1);
}

await downloadNasaImage();
buildWarmDisk(ffmpeg);
buildLoopMp4(ffmpeg);
