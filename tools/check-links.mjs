import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await files(p)));
    else if (p.endsWith('.md')) result.push(p);
  }
  return result;
}
const markdown = [
  ...(await files('docs')),
  resolve('README.md'),
  resolve('SECURITY.md'),
];
let count = 0;
for (const path of markdown) {
  const text = (await readFile(path, 'utf8')).replace(/```[\s\S]*?```/g, '');
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0].replace(/^<|>$/g, '');
    if (!target || /^[a-z]+:/.test(target) || target.includes(' ')) continue;
    try {
      await stat(resolve(dirname(path), decodeURIComponent(target)));
      count++;
    } catch {
      throw new Error(`Broken relative link in ${path}: ${target}`);
    }
  }
}
console.log(`Validated ${count} relative documentation links.`);
