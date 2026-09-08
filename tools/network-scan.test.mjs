import { test } from 'node:test';
import assert from 'node:assert/strict';
import { externalNetworkCalls } from './network-scan.mjs';
test('rejects planted external fetch and image/SW requests while allowing source attribution', () => {
  for (const code of [
    'fetch("https://example.invalid/x")',
    'self.fetch("https://example.invalid/x")',
    'image.src="https://example.invalid/i.png"',
    '({src:"https://example.invalid/i.png"})',
  ])
    assert.notEqual(externalNetworkCalls(code).length, 0, code);
  assert.equal(
    externalNetworkCalls(
      'const attribution="https://example.invalid/license";fetch("/local")',
    ).length,
    0,
  );
});
