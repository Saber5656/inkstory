import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { convertBvh, stableMotionJson, type MotionConfig } from './bvh';

export async function convertMotionFile(
  inputPath: string,
  configPath: string,
  outputDir: string,
): Promise<string> {
  const [bvh, rawConfig] = await Promise.all([
    readFile(inputPath, 'utf8'),
    readFile(configPath, 'utf8'),
  ]);
  const config = parseMotionConfig(rawConfig);
  const clip = convertBvh(bvh, config);
  const output = stableMotionJson(clip);
  const target = join(outputDir, `${clip.id}.json`);
  await writeFile(target, output, 'utf8');
  return target;
}

/** Parse the intentionally small clip config surface without adding a runtime YAML dependency. */
export function parseMotionConfig(raw: string): MotionConfig {
  try {
    return JSON.parse(raw) as MotionConfig;
  } catch {
    /* YAML below */
  }
  const output: Record<string, unknown> = {};
  let section: Record<string, unknown> | undefined;
  for (const sourceLine of raw.split(/\r?\n/)) {
    const line = sourceLine.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;
    const indentation = line.length - line.trimStart().length;
    const content = line.trim();
    const separator = content.indexOf(':');
    if (separator < 1) continue;
    const key = content.slice(0, separator).trim();
    const value = content.slice(separator + 1).trim();
    if (indentation === 0) {
      if (!value) {
        const nested: Record<string, unknown> = {};
        output[key] = nested;
        section = nested;
      } else output[key] = parseYamlScalar(value);
    } else if (section) section[key] = parseYamlScalar(value);
  }
  return output as unknown as MotionConfig;
}

function parseYamlScalar(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (
    (value.startsWith('[') && value.endsWith(']')) ||
    (value.startsWith('{') && value.endsWith('}'))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value.replace(/^['"]|['"]$/g, '');
}

export async function buildMotionCatalog(motionDir: string): Promise<void> {
  const names = (await readdir(motionDir))
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .sort();
  const entries = await Promise.all(
    names.map(async (name) => {
      const body = await readFile(join(motionDir, name));
      const clip = JSON.parse(body.toString()) as MotionConfig & { id: string };
      return {
        id: clip.id,
        file: `/motions/${name}`,
        category: clip.category,
        sha256: createHash('sha256').update(body).digest('hex'),
      };
    }),
  );
  await writeFile(
    join(motionDir, 'index.json'),
    `${JSON.stringify(entries, null, 2)}\n`,
    'utf8',
  );
}

export async function main(
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const [input, flag, config, outFlag, outputDir] = argv;
  if (
    !input ||
    flag !== '--config' ||
    !config ||
    outFlag !== '--out' ||
    !outputDir
  )
    throw new Error(
      'Usage: motion:convert <in.bvh> --config <clip.json> --out <directory>',
    );
  await convertMotionFile(input, config, outputDir);
}

if (process.argv[1]?.endsWith('/motion-pipeline/cli.ts'))
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
