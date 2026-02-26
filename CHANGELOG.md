# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

## [0.1.6] - 2026-02-26

### Changed

- **Start Task now opens in agent mode** — clicking "Start Task" builds a rich context prompt and opens it in Copilot agent mode (`mode: "agent"`) where the agent has full tool access to read files, make edits, and run tests. Previously it routed through `@spec implement` which made a blind LLM call with no tool access.
- **Agent-friendly implementation instructions** — the task prompt no longer asks the model to produce `FILE:` blocks. Instead it instructs the agent to read linked files first, implement following project conventions, verify compilation/tests, and stay focused on the specific task.
- **`@spec implement` no longer auto-applies code** — the chat participant `implement` action now displays the task context as a reference and suggests using the Start Task CodeLens for agent mode. Removed the direct `model.sendRequest()` call, `applyResponseAsEdit` auto-apply, and automatic task completion.

## [0.1.5] - 2026-02-26

### Changed

- Added Marketplace `keywords` (`copilot`, `specifications`, `requirements`, `task-management`, `ai`) for improved discoverability.
- Added `galleryBanner` dark theme to the Marketplace listing.
- Improved `README.md`: added Install section with direct Marketplace link, Installs and Rating badges, descriptive screenshot captions, and a Quick Start walkthrough.

## [0.1.4] - 2026-02-25

### Added

- **Spec markdown diagnostics** — spec instruction files (`.instructions.md` inside the specs directory) are now validated in real time. VS Code Problems are reported for invalid checkbox markers (e.g. `- [?]`), duplicate task IDs (`<!-- task:T1 -->` used more than once), malformed `requires` comments (space before the colon), and unclosed HTML comments. Diagnostics are cleared when the file is closed.
- **`validateTaskMarkdown`** exported from `taskManager.ts` — validates spec/task markdown content and returns an array of `TaskValidationIssue` objects (`{ line, message, severity }`) for use in tests and tooling.
- **`extractRequirementIdsFromText`** exported from `taskManager.ts` — exposes the internal requirement-ID inference logic for external callers and tests.
- **`matchGlobPattern`** exported from `codeLensProvider.ts` — exposes the internal `minimatch` glob-matching implementation for testing and reuse.
- **Hook JSON format docs** — `README.md` now documents the `.github/hooks/*.json` schema, all supported event names, and every field of the command entry object.
- **MCP server config format docs** — `README.md` now documents the JSONC schema for `.vscode/mcp.json` / `.mcp.json` / `mcp.json`, including `stdio` and `sse` server types.
- **New tests** — `taskManager.test.ts` adds suites for requirement inference edge cases (`extractRequirementIdsFromText`) and `validateTaskMarkdown`. New `codeLensProvider.test.ts` covers glob matching edge cases via `matchGlobPattern`.

## [0.1.3] - 2026-02-23

### Added

- **`@spec implement <spec> <taskId>` chat participant command** — typing `@spec implement my-spec T7` in Copilot Chat builds a rich context prompt (requirements text, design excerpt, linked file paths), streams the LM response, applies any `FILE:` block edits as a workspace edit, and marks the parent task and all subtasks complete automatically when the response finishes.
- **`$(pass-filled) Task Completed` CodeLens on all completed parent tasks** — previously only shown on heading-style (`### Tn`) tasks; now also shown on `- [x] **Tn**` checkbox-style parent tasks.
- **Instructions & Skills explorer** — the "Agent Steering & Skills" tree view is reorganised into three collapsible sections: **Instructions** (managed blocks in `copilot-instructions.md`), **Rules** (top-level `.github/instructions/*.instructions.md` files), and **Skills** (`.github/skills/`). Each section shows its child count and auto-expands when populated.
- **New Rules or Skill flow** (replaces "New Steering Entry") — the `+` toolbar button now offers a two-item picker: create a new `.instructions.md` rules file under `.github/instructions/`, or a new `SKILL.md` skill under `.github/skills/<name>/`. Files are scaffolded with the correct frontmatter and opened in the editor.
- **Auto-gitignore cache** — on activation the extension ensures `.copilot-specs-cache/` is present in the workspace `.gitignore`, creating the file if necessary and appending the entry idempotently.
- `listInstructionRulesFiles()` utility in `fileSystem.ts` — lists top-level `.instructions.md` files in `.github/instructions/` (non-recursive, excludes the `specs/` subdirectory).

### Changed

- Spec file templates (`requirements`, `design`, `tasks`) now produce a consistent frontmatter header: `name: <spec-name>` and `applyTo: "<glob>"`. The tasks template previously had no frontmatter; the requirements and design templates previously included a `description` field and appended `" Requirements"` / `" Design"` to the `name` value.
- `startTask` command no longer sets the in-progress spinner on button click — the spinner is now set by an `onTaskStart` callback at the top of the `@spec implement` handler, and cleared by `onTaskComplete` when the LM finishes. This prevents the spinner from getting stuck when the chat session does not route to the participant.

### Fixed

- In-progress spinner (`$(sync~spin)`) was permanently stuck after clicking "Start task" if the LM response never completed (e.g. wrong query format). Spinner lifecycle is now fully owned by the chat participant handler.

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
