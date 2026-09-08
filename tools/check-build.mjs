import { externalNetworkCalls } from './network-scan.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
const html = await readFile('dist/index.html', 'utf8');
const scripts = [
  ...html.matchAll(/(?:src|href)="[^"]*\/assets\/([^"/]+\.js)"/g),
].map((match) => match[1]);
let total = 0;
for (const name of new Set(scripts))
  total += gzipSync(await readFile(`dist/assets/${name}`)).length;
assert(
  total <= 300 * 1024,
  `Initial JavaScript exceeds 300 KiB gzip: ${total}`,
);
assert(html.includes("connect-src 'self'"), 'Missing network CSP');
assert(
  !html.includes("style-src 'self' 'unsafe-inline'"),
  'Inline styles must not be enabled',
);
for (const name of await readdir('dist/assets')) {
  if (!name.endsWith('.js')) continue;
  const js = await readFile(`dist/assets/${name}`, 'utf8');
  const networkCalls = externalNetworkCalls(js);
  assert.equal(networkCalls.length, 0, `Cross-origin network call in ${name}`);
}
console.log(
  `Initial JavaScript gzip: ${total} bytes; CSP and static network-call scan passed.`,
);
