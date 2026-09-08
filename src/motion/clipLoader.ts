import { MotionClipSchema, MotionIndexSchema, type MotionClip, type MotionIndexEntry } from './types';

export class MotionLoadError extends Error { constructor(message: string, readonly cause?: unknown) { super(message); this.name = 'MotionLoadError'; } }
const cache = new Map<string, MotionClip>();

async function sha256(body: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', body);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadMotionClip(id: string, fetchImpl: typeof fetch = fetch, baseUrl = '/'): Promise<MotionClip> {
  const cached = cache.get(id); if (cached) return cached;
  const prefix = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const indexResponse = await fetchImpl(`${prefix}/motions/index.json`); if (!indexResponse.ok) throw new MotionLoadError(`Motion index request failed (${indexResponse.status})`);
  let index: MotionIndexEntry[];
  try { index = MotionIndexSchema.parse(await indexResponse.json()); } catch (error) { throw new MotionLoadError('Motion index is not valid JSON', error); }
  const entry = index.find((item) => item.id === id); if (!entry) throw new MotionLoadError(`Motion '${id}' is not in the catalog`);
  const response = await fetchImpl(`${prefix}${entry.file}`); if (!response.ok) throw new MotionLoadError(`Motion '${id}' request failed (${response.status})`);
  const body = await response.arrayBuffer();
  if (entry.sha256 && await sha256(body) !== entry.sha256) throw new MotionLoadError(`Motion '${id}' checksum mismatch`);
  try { const clip = MotionClipSchema.parse(JSON.parse(new TextDecoder().decode(body))); cache.set(id, clip); return clip; } catch (error) { throw new MotionLoadError(`Motion '${id}' failed schema validation`, error); }
}

export function clearMotionCache(): void { cache.clear(); }
