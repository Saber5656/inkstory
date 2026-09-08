import { readdir, readFile } from 'node:fs/promises';
for (const file of await readdir('.github/workflows')) {
  const text = await readFile(`.github/workflows/${file}`, 'utf8');
  for (const line of text.split('\n').filter((line) => /uses:/.test(line))) {
    if (
      !/uses:\s*\.\//.test(line) &&
      !/uses:\s*[^\s]+@[0-9a-f]{40}(?:\s|$)/.test(line)
    )
      throw new Error(`Unpinned action in ${file}: ${line}`);
  }
}
console.log('All external actions are pinned by immutable SHA.');
