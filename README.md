# Copilot Specs

[![CI](https://github.com/moonolgerd/copilot-specs/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/moonolgerd/copilot-specs/actions/workflows/ci.yml)
[![Release](https://github.com/moonolgerd/copilot-specs/actions/workflows/release.yml/badge.svg)](https://github.com/moonolgerd/copilot-specs/actions/workflows/release.yml)

Spec-driven development for VS Code + GitHub Copilot.

`copilot-specs` helps teams plan and implement features through structured **requirements**, **design**, and **implementation tasks** documents, then connect those documents back to real code with explorers, CodeLens, and automation.

## Features

- **Spec lifecycle**
  - Create, rename, and delete specs under `.github/instructions/specs/<spec-name>/`
  - Scaffold files from templates:
    - `requirements.instructions.md`
    - `design.instructions.md`
    - `implementation-tasks.instructions.md`

- **Task tracking + progress**
  - Parse markdown checkbox tasks and subtasks
  - Track completion progress per spec
  - Show spec progress in the status bar and panel

- **Traceability with CodeLens**
  - Link requirements ↔ tasks
  - Link tasks ↔ implementation files
  - Auto-link task references to code

- **Copilot integration**
  - Generate requirements, design, and tasks with chat participant commands
  - Run autopilot task execution flow from spec tasks

- **Project guidance + tooling**
  - Steering and skills explorer
  - Agent hooks explorer (`.github/hooks/*.json`)
  - MCP servers explorer and toggle support

## Requirements

- Node.js **22+**
- VS Code **1.93+**
- GitHub Copilot Chat (for generation/autopilot features)

## Development

Install dependencies:

```bash
npm ci
```

Build TypeScript:

```bash
npm run compile
```

Bundle extension:

```bash
npm run bundle
```

Watch mode:

```bash
npm run dev
```

Lint:

```bash
npm run lint
```

## Run the extension locally

1. Open this folder in VS Code.
2. Run `npm ci`.
3. Press `F5` to launch the Extension Development Host.
4. In the new window, run commands from the Command Palette, such as:
   - `Copilot Specs: New Spec`
   - `Copilot Specs: Open Spec Panel`
   - `Copilot Specs: Generate with Copilot`

## CI/CD

Workflows are in `.github/workflows/`:

- `ci.yml`
  - Runs on PRs and pushes to `main`
  - Executes `npm ci`, `npm run compile`, and `npm run bundle`

- `release.yml`
  - Runs on tag push `v*` or manual dispatch
  - Packages a `.vsix` artifact
  - Publishes to VS Marketplace when `VSCE_PAT` is configured

Required secret for publishing:

- `VSCE_PAT`

For workflow details, see `.github/workflows/README.md`.

## Publishing

Tag-based release example:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Manual release is also available through the GitHub Actions UI.

## Repository layout

- `src/` — extension source
- `src/templates/` — default spec templates
- `.github/instructions/specs/` — generated/managed spec docs in a workspace
- `.github/hooks/` — hook JSON definitions
- `.copilot-specs-cache/` — task link cache files

## License

MIT — see [LICENSE](LICENSE).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.
