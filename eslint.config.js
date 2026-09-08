import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const typedFiles = ['**/*.{ts,tsx}'];
const guardedFiles = ['**/*.{js,mjs,cjs,ts,tsx}'];
const typedRecommended = tseslint.configs.recommendedTypeChecked.map(
  (config) => ({
    ...config,
    files: typedFiles,
  }),
);

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...typedRecommended,
  {
    files: typedFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: guardedFiles,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'Render untrusted content as React text; dangerouslySetInnerHTML is prohibited.',
        },
        {
          selector: "Identifier[name='eval']",
          message: 'eval is prohibited.',
        },
        {
          selector: "MemberExpression[computed=true][property.value='eval']",
          message: 'eval is prohibited.',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
