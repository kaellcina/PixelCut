#!/usr/bin/env node
/**
 * Probe/import contract tests against the PixelCut-built ffprobe.exe.
 * H.264/AAC/WAV/JPEG fixtures are generated with the same bundled ffmpeg.
 * HEVC and MP3 samples are pre-baked (own ffmpeg does not encode x265/lame).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ffmpegPath, ffprobePath, probe, assertPixelCutBinaries } = require('../electron/ffmpeg.cjs');

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const ICON = path.join(__dirname, '..', 'assets', 'icon.png');
const FIXTURES = path.join(__dirname, 'fixtures');

function ffmpeg(args) {
  execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true });
}

/** Same mapping as electron/main.cjs probeFile / media:import (not a UI test). */
async function importLike(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (IMAGE_EXT.includes(ext)) {
    let info = { width: 0, height: 0, duration: 5, hasVideo: true, hasAudio: false };
    try { info = { ...await probe(file), duration: 5, hasAudio: false }; } catch { /* still import as image */ }
    return { path: file, name: path.basename(file), type: 'image', ...info, duration: 5 };
  }
  try {
    const info = await probe(file);
    return { path: file, name: path.basename(file), type: info.hasVideo ? 'video' : 'audio', ...info };
  } catch (e) {
    return { path: file, name: path.basename(file), error: e.message };
  }
}

function near(a, b, eps) {
  return Math.abs(a - b) <= eps;
}

(async () => {
  const bins = assertPixelCutBinaries();
  if (!ffprobePath.replace(/\\/g, '/').endsWith('third-party/ffmpeg/ffprobe.exe')
    && !process.env.PIXELCUT_FFPROBE && !process.env.PIXELCUT_FFMPEG_DIR) {
    throw new Error(`ffprobePath is not the bundled binary: ${ffprobePath}`);
  }
  if (!fs.existsSync(ffprobePath)) throw new Error(`ffprobe missing: ${ffprobePath}`);
  const hash = bins.ffprobeSha;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelcut-ffprobe-'));
  const sample = path.join(dir, 'pixelcut-sample.mp4');
  ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30:duration=3',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart',
    sample,
  ]);
  const silent = path.join(dir, 'video-no-audio.mp4');
  ffmpeg([
    '-f', 'lavfi', '-i', 'smptebars=size=640x360:rate=25:duration=2',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-an',
    silent,
  ]);
  const wav = path.join(dir, 'tone.wav');
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=880:duration=2', '-ar', '44100', '-ac', '1', wav]);
  const mp3 = path.join(dir, 'tone.mp3');
  fs.copyFileSync(path.join(FIXTURES, 'tone.mp3'), mp3);
  const cover = path.join(dir, 'audio-with-cover.m4a');
  ffmpeg([
    '-i', wav, '-i', ICON,
    '-map', '0:a', '-map', '1:v',
    '-c:a', 'aac', '-c:v', 'png',
    '-disposition:v', 'attached_pic',
    cover,
  ]);
  const jpg = path.join(dir, 'still.jpg');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=blue:s=320x240:d=1', '-frames:v', '1', '-update', '1', jpg]);
  const png = path.join(dir, 'icon.png');
  fs.copyFileSync(ICON, png);
  const rotated = path.join(dir, 'rotated-metadata.mp4');
  ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc=size=640x480:rate=30:duration=1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an',
    '-metadata:s:v:0', 'rotate=90',
    rotated,
  ]);
  const hevc = path.join(dir, 'hevc-sample.mp4');
  fs.copyFileSync(path.join(FIXTURES, 'hevc-sample.mp4'), hevc);
  const bogus = path.join(dir, 'not-media.bin');
  fs.writeFileSync(bogus, Buffer.from('this is not a media file'));

  const sampleInfo = await probe(sample);
  if (!near(sampleInfo.duration, 3, 0.15) || !sampleInfo.hasVideo || !sampleInfo.hasAudio
      || sampleInfo.width !== 1280 || sampleInfo.height !== 720) {
    throw new Error(`pixelcut-sample.mp4 probe mismatch ${JSON.stringify(sampleInfo)}`);
  }
  const sampleImp = await importLike(sample);
  if (sampleImp.type !== 'video' || sampleImp.error) throw new Error('import mapping failed for H.264/AAC');

  const silentInfo = await probe(silent);
  if (!silentInfo.hasVideo || silentInfo.hasAudio || silentInfo.width !== 640 || silentInfo.height !== 360) {
    throw new Error(`silent video probe mismatch ${JSON.stringify(silentInfo)}`);
  }

  const wavInfo = await probe(wav);
  if (wavInfo.hasVideo || !wavInfo.hasAudio || !near(wavInfo.duration, 2, 0.15)) {
    throw new Error(`wav probe mismatch ${JSON.stringify(wavInfo)}`);
  }
  const mp3Info = await probe(mp3);
  if (mp3Info.hasVideo || !mp3Info.hasAudio || mp3Info.duration < 1.5) {
    throw new Error(`mp3 probe mismatch ${JSON.stringify(mp3Info)}`);
  }

  const coverInfo = await probe(cover);
  if (coverInfo.hasVideo || !coverInfo.hasAudio) {
    throw new Error(`attached_pic treated as video: ${JSON.stringify(coverInfo)}`);
  }
  const coverImp = await importLike(cover);
  if (coverImp.type !== 'audio') throw new Error(`cover m4a imported as ${coverImp.type}`);

  const jpgImp = await importLike(jpg);
  if (jpgImp.type !== 'image' || jpgImp.duration !== 5 || jpgImp.hasAudio || jpgImp.width !== 320 || jpgImp.height !== 240) {
    throw new Error(`jpeg import mismatch ${JSON.stringify(jpgImp)}`);
  }
  const pngImp = await importLike(png);
  if (pngImp.type !== 'image' || pngImp.duration !== 5 || pngImp.width !== 512 || pngImp.height !== 512) {
    throw new Error(`png import mismatch ${JSON.stringify(pngImp)}`);
  }

  const rot = await probe(rotated);
  if (!rot.hasVideo || rot.hasAudio || rot.width !== 640 || rot.height !== 480) {
    throw new Error(`rotated probe mismatch ${JSON.stringify(rot)}`);
  }

  const hevcInfo = await probe(hevc);
  if (!hevcInfo.hasVideo || hevcInfo.hasAudio || hevcInfo.width !== 640 || hevcInfo.height !== 360) {
    throw new Error(`hevc probe mismatch ${JSON.stringify(hevcInfo)}`);
  }

  let invalidThrew = false;
  try { await probe(bogus); } catch { invalidThrew = true; }
  if (!invalidThrew) throw new Error('invalid file did not fail probe()');
  const badImp = await importLike(bogus);
  if (!badImp.error) throw new Error('invalid file import did not record error');

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`test-ffprobe: PixelCut n6.1.1 ffmpeg=${bins.ffmpegSha} ffprobe=${hash}`);
  console.log('test-ffprobe: generated pixelcut-sample.mp4 (H.264/AAC 1280x720) + silent/wav/mp3/m4a-cover/jpeg/png/rotate/hevc/invalid');
  console.log('test-ffprobe: probe() and import mapping OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
