# Contributing

Thanks for helping improve `mcp-replay`.

## Development

Requirements:

- Node.js 22 or newer
- npm 11 or newer

Set up the project:

```bash
npm ci
npm run build
npm test
```

Before opening a pull request, run:

```bash
npm run typecheck
npm run build
npm test
npm run smoke:package
```

## Pull requests

- Keep changes focused on one bug fix, feature, or documentation update.
- Add or update tests for behavior changes.
- Do not commit `dist/`, package tarballs, or local fixture output.
- For fixture replay changes, include a deterministic fixture-based test when possible.

## Releases

Releases are published by maintainers through the manual GitHub Actions release workflow. Do not create release tags in contribution branches.
