# Repository protection

The repository administrator should require PR reviews and `quality`, `build`, `audit`, and `e2e` checks on `main`. Disallow direct pushes, force pushes, and branch deletion. Agents do not change these settings.

The `github-pages` environment should require a maintainer reviewer before deployment. Configure GitHub Pages to use GitHub Actions. A merge does not release the app; deployment is tag-driven after the release checklist is complete. Settings and environment enforcement require administrator verification.
