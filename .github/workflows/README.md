# CI/CD Workflows

This repository includes two GitHub Actions workflows for the VS Code extension.

## Workflows

- `ci.yml`
  - Runs on pull requests and pushes to `main`
  - Executes:
    - `npm ci`
    - `npm run compile`
    - `npm run bundle`

- `release.yml`
  - Runs on:
    - tag pushes matching `v*`
    - manual dispatch (`workflow_dispatch`)
  - Builds a VSIX artifact and can publish to Visual Studio Marketplace and Open VSX.

## Required Secrets

Configure these in **GitHub → Settings → Secrets and variables → Actions**:

- `VSCE_PAT` (optional)
  - Personal Access Token for publishing to Visual Studio Marketplace
- `OPEN_VSX_TOKEN` (optional)
  - Access token for publishing to Open VSX

If a token is missing, only its matching publish step is skipped.

## Release Usage

### Automatic (recommended)

1. Bump `version` in `package.json`
2. Create and push a tag, for example: `v0.1.1`
3. `release.yml` runs automatically with `publish_target=both` and attempts publish to each registry with a configured token

### Manual

1. Run `Release` workflow from GitHub Actions
2. Select `publish_target`: `dry-run`, `marketplace`, `open-vsx`, or `both`.
