import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';

import 'fake-indexeddb/auto';

// Node 26 exposes an unavailable Storage global without a backing file. Use a
// deterministic Web Storage implementation in the jsdom-only test environment.
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  },
});

// Node 20's jsdom environment can expose crypto without SubtleCrypto. Keep the
// production loader browser-only, while making the CI test runtime explicit.
if (!globalThis.crypto?.subtle)
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto,
  });
