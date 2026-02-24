# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Added

## [0.1.2] - 2026-02-23

### Added

- **Heading-style task parsing** — `taskManager.ts` now recognises `### T1: Title` documents (used by third-party specs). Subsequent `- [ ]` / `- [x]` lines are collected as subtasks of the heading task; parent completion is derived from them. An explicit `### - [x] T1: Title` checkbox takes precedence.
- **Start Task / Task Completed CodeLens on heading tasks** — heading-style task lines now show `$(circle-large-outline) Start task` when incomplete and `$(pass-filled) Task Completed` when all subtasks are checked, providing a visual checkbox metaphor consistent with checkbox-style tasks.
- **`copilot-specs.startTask` command** — opens a focused Copilot Chat session pre-populated with spec name, task ID, task title, and linked requirement IDs; accessible from both the tree view inline button and the tasks document CodeLens.
- **Rich Start Task prompt** (`src/copilot/taskStarter.ts`) — the chat prompt now includes the full requirement section text for each linked requirement ID, a design doc excerpt (architecture and core flows), and the paths of any linked implementation files.
- **Post-chat mark-complete flow** — after the Start Task chat panel opens, a notification asks "Did Copilot complete task X? Mark it as done?". Confirming marks the parent task **and all its subtasks** as `[x]` in the markdown file and refreshes the explorer/status bar.
- Unit test suite using `@vscode/test-cli` and mocha TDD — 32 tests covering `parseTasks`, `calculateProgress`, `parseFrontmatter`, `serializeFrontmatter`, and `stripFrontmatter` ([src/test/suite/](src/test/suite/)).
- `.vscode-test.mjs` test runner configuration.
- `npm test` now compiles TypeScript before running the test suite.
- AI agent coding instructions (`.github/copilot-instructions.md`) — architecture overview, storage layout, task/requirement conventions, file-system rules, autopilot `FILE:` block format, build commands, and TypeScript conventions.

### Changed

- Enhanced `.github/copilot-instructions.md` with additional steering-section sentinel markers and autopilot guidelines.

### Fixed

- **Generate with Copilot** (`@spec create` and `@spec regenerate tasks`) no longer resets already-completed tasks — existing `[x]` checkbox states are preserved when tasks are regenerated, matched by task ID.
- Task document CodeLens no longer shows a `Referenced: <file>` lens for tasks that have no linked implementation files. The file lens is now only rendered when at least one implementation file is actually linked.

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
