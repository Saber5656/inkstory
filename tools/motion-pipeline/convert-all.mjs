#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLIP_IDS = [
  'idle_breathe',
  'wave',
  'walk',
  'run',
  'jump',
  'dance_1',
  'dance_2',
  'spin',
  'sit_down',
  'cheer',
];
const BONE_IDS = [
  'hip',
  'torso',
  'neck',
  'right_shoulder',
  'right_elbow',
  'right_hand',
  'left_shoulder',
  'left_elbow',
  'left_hand',
  'right_hip',
  'right_knee',
  'right_foot',
  'left_hip',
  'left_knee',
  'left_foot',
];

function parseArgs(argv) {
  const values = {
    source: resolve(ROOT, 'assets-src/motions'),
    out: resolve(ROOT, 'public/motions'),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--source' || flag === '--out') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${flag} requires a directory`);
      values[flag.slice(2)] = resolve(process.cwd(), value);
      index += 1;
    } else throw new Error(`Unknown option: ${flag}`);
  }
  return values;
}

function shortestArc(from, to) {
  return ((to - from + 540) % 360) - 180;
}

function validateClip(clip, id) {
  if (!clip || clip.schemaVersion !== 1 || clip.id !== id)
    throw new Error(`Invalid clip identity: ${id}`);
  if (
    !Number.isInteger(clip.frameCount) ||
    clip.frameCount < 1 ||
    !Array.isArray(clip.rootTranslation) ||
    clip.rootTranslation.length !== clip.frameCount
  )
    throw new Error(`Invalid frame count: ${id}`);
  for (const bone of BONE_IDS) {
    if (
      !Number.isFinite(clip.restAngles?.[bone]) ||
      !Array.isArray(clip.frames?.[bone]) ||
      clip.frames[bone].length !== clip.frameCount
    )
      throw new Error(`Missing ${bone} data: ${id}`);
    for (const value of clip.frames[bone])
      if (
        !Number.isFinite(value) ||
        Math.abs(shortestArc(clip.restAngles[bone], value)) > 135
      )
        throw new Error(`Angle clamp exceeded: ${id}/${bone}`);
  }
  if (clip.loop)
    for (const bone of BONE_IDS) {
      const values = clip.frames[bone];
      if (Math.abs(shortestArc(values[0], values.at(-1))) > 4)
        throw new Error(`Loop seam exceeded: ${id}/${bone}`);
    }
}

function catalogText(entries) {
  return `[\n${entries.map((entry) => `  { "id": ${JSON.stringify(entry.id)}, "file": ${JSON.stringify(entry.file)}, "category": ${JSON.stringify(entry.category)}, "sha256": ${JSON.stringify(entry.sha256)} }`).join(',\n')}\n]\n`;
}

async function main() {
  const { source, out } = parseArgs(process.argv.slice(2));
  const clips = [];
  for (const id of CLIP_IDS) {
    const clip = JSON.parse(
      await readFile(resolve(source, `${id}.json`), 'utf8'),
    );
    validateClip(clip, id);
    clips.push(clip);
  }
  await mkdir(out, { recursive: true });
  const entries = [];
  for (const clip of clips) {
    const body = `${JSON.stringify(clip)}\n`;
    const file = `${clip.id}.json`;
    await writeFile(resolve(out, file), body, 'utf8');
    entries.push({
      id: clip.id,
      file: `/motions/${file}`,
      category: clip.category,
      sha256: createHash('sha256').update(body).digest('hex'),
    });
  }
  await writeFile(resolve(out, 'index.json'), catalogText(entries), 'utf8');
  process.stdout.write(
    `Generated ${clips.length} procedural clips in ${out}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
