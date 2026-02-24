# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

## [0.1.2] - 2026-02-23

### Added

- AI agent coding instructions (`.github/copilot-instructions.md`) — architecture overview, storage layout, task/requirement conventions, file-system rules, autopilot `FILE:` block format, build commands, and TypeScript conventions.

### Changed

- Enhanced `.github/copilot-instructions.md` with additional steering-section sentinel markers and autopilot guidelines.

## [0.1.1] - 2026-02-23

### Added

- Extension icon (`media/icon.png`) — 256×256 PNG based on the `$(tasklist)` codicon, displayed in VS Marketplace and the Extensions panel.

## [0.1.0] - 2026-02-23

### Added

- Initial VS Code extension scaffold for spec-driven development workflows.
- Spec lifecycle commands: create, rename, delete, and panel open flows.
- Spec Explorer with requirements, design, and tasks file nodes.
- Task parsing, completion tracking, and status bar progress display.
- CodeLens flows for requirement/task traceability and task implementation links.
- Copilot chat participant for spec creation and section regeneration.
- Autopilot execution path for pending tasks with model-generated file edit support.
- Steering and skills explorer integration.
- Hooks management for `.github/hooks/*.json` command hooks.
- MCP server discovery and enable/disable toggling support.
- CI workflow for install, compile, and bundle validation.
- Release workflow for VSIX packaging and VS Marketplace publishing.
- Repository documentation (`README.md`) and MIT license (`LICENSE`).

[Unreleased]: https://github.com/moonolgerd/copilot-specs/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/moonolgerd/copilot-specs/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/moonolgerd/copilot-specs/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/moonolgerd/copilot-specs/releases/tag/v0.1.0
