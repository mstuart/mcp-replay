# Release process

`mcp-replay` is a library package. Releases are created only when the package version is ready to publish.

## Preconditions

- The changelog has an entry for the version being released.
- CI is green on `master`.
- npm Trusted Publishing is configured for this package with the GitHub Actions release workflow.

## Local verification

Run these before starting a release:

```bash
npm ci
npm run typecheck
npm run build
npm test
npm pack --dry-run
npm run smoke:package
```

## Publishing

Use the manual **Release** GitHub Actions workflow from `master` and choose the semver bump. The workflow:

1. Installs dependencies with `npm ci`.
2. Runs typecheck, build, tests, package dry-run, and package smoke verification.
3. Creates the version commit and git tag with `npm version`.
4. Publishes to npm with provenance using GitHub OIDC Trusted Publishing.
5. Pushes the release commit and tag only after publish succeeds.
6. Creates the GitHub release notes.

Do not create a release tag before the package is ready to publish.
