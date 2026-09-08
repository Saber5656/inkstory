# Contributing

Use Node.js 20+ and pnpm 10.34.5. Run `pnpm install --frozen-lockfile`, then `pnpm dev`.

Before a pull request run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

Dependency lifecycle scripts are disabled (`ignore-scripts=true`). Review any required build script before executing it explicitly.

Optional local environment roots are documented in `.env.example`; local `.env` files are ignored and must be explicitly loaded by the invoking process. They are not app configuration.
