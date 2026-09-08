import path from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: process.cwd() });

async function lintWithRepositoryConfig(
  source: string,
  relativeFilePath = 'src/app/App.tsx',
) {
  const [result] = await eslint.lintText(source, {
    filePath: path.join(process.cwd(), relativeFilePath),
  });

  if (!result) {
    throw new Error('ESLint returned no result for the guard fixture.');
  }

  return result.messages;
}

describe('ESLint security guard', { timeout: 15000 }, () => {
  it('rejects user-facing literals in application TSX', async () => {
    const messages = await lintWithRepositoryConfig(
      'export function Literal() {return <button>Hello there</button>;}',
    );
    expect(
      messages.some(
        (message) => message.ruleId === 'i18next/no-literal-string',
      ),
    ).toBe(true);
  });
  it('rejects dangerouslySetInnerHTML through the repository config', async () => {
    const source = `export function UnsafeMarkup() {
      return <div dangerouslySetInnerHTML={{ __html: '<strong>unsafe</strong>' }} />;
    }`;
    const messages = await lintWithRepositoryConfig(source);
    const finding = messages.find(
      ({ ruleId }) => ruleId === 'no-restricted-syntax',
    );

    expect(finding?.ruleId).toBe('no-restricted-syntax');
    expect(finding?.message).toContain('dangerouslySetInnerHTML');
  });

  it('rejects eval call forms in TypeScript and JavaScript', async () => {
    const fixtures = [
      {
        source: `const evaluate = globalThis['eval']; export const alias = () => evaluate('2 + 2');`,
        relativeFilePath: 'src/app/App.tsx',
      },
      {
        source: `export const directEval = () => eval('2 + 2');`,
        relativeFilePath: 'src/app/App.tsx',
      },
      {
        source: `export const memberEval = () => window.eval('2 + 2');`,
        relativeFilePath: 'src/app/App.tsx',
      },
      {
        source: `export const computedEval = () => globalThis['eval']('2 + 2');`,
        relativeFilePath: 'src/app/App.tsx',
      },
      {
        source: `const evaluate = eval; export const aliasedEval = () => evaluate('2 + 2');`,
        relativeFilePath: 'src/app/App.tsx',
      },
      {
        source: `export const javascriptEval = () => eval('2 + 2');`,
        relativeFilePath: 'eslint.config.js',
      },
      {
        source: `const evaluate = eval; export const aliasedEval = () => evaluate('2 + 2');`,
        relativeFilePath: 'eslint.config.js',
      },
    ];

    const results = await Promise.all(
      fixtures.map(({ source, relativeFilePath }) =>
        lintWithRepositoryConfig(source, relativeFilePath),
      ),
    );

    for (const messages of results) {
      expect(messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: 'no-restricted-syntax',
            message: 'eval is prohibited.',
          }),
        ]),
      );
    }
  });
});
