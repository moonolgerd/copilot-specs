---
name: copilot-specs
applyTo: "src/**"
---

# Copilot Specs Extension Design

## Architecture

The extension is implemented as a VS Code extension centered around `activate()` in `src/extension.ts`.

### Activation and Registration

1. Initialize templates and hook support (`initTemplates`, `initHooks`)
2. Register tree data providers for:
   - Specs
   - Steering + Skills
   - Hooks
   - MCP Servers (two view IDs)
3. Register CodeLens provider across file scheme documents
4. Register file watchers for spec instructions, hooks, MCP configs, and steering files
5. Register command handlers and chat participant
6. Initialize status bar and refresh state.

### Data and Storage Model

- Spec docs live under `.github/instructions/specs/<spec-name>/`
  - `requirements.instructions.md`
  - `design.instructions.md`
  - `implementation-tasks.instructions.md`
- Task-to-file links live in `.copilot-specs-cache/<spec>.links.json`
- Steering is managed in `.github/copilot-instructions.md` between marker comments
- Hooks live in `.github/hooks/*.json`
- MCP config sources include workspace and user-level `mcp.json` variants.

### Core Flows

#### Spec lifecycle

- `specManager.ts` handles list/load/create/rename/delete for specs
- Frontmatter `applyTo` drives file matching and default scope
- Templates from `src/templates/` bootstrap new specs.

#### Task parsing and progress

- `taskManager.ts` parses checkbox markdown into typed task models
- Supports task IDs from comments or bold prefixes
- Supports requirement linkage via `requires` comments or inferred IDs in text
- Computes completion metrics for UI and status bar.

#### CodeLens and traceability

- `codeLensProvider.ts` maps source files to specs by glob and manual links
- Adds requirement/task navigation lenses in requirements/tasks documents
- Supports file-link extraction and inferred requirement mapping.

#### Copilot generation and autopilot

- `copilot/specGenerator.ts` generates requirements/design/tasks using selected chat model
- `autopilot.ts` executes pending tasks by sending focused prompts to model
- Parses `FILE:` blocks and applies workspace edits
- Optionally confirms each task before applying edits.

#### Webview panel

- `webview/specPanel.ts` renders requirements/design/tasks tabs
- Tracks progress and supports task toggles plus “Generate with Copilot”.

#### Hooks and MCP

- `hooksManager.ts` manages `.github/hooks/*.json` command entries
- `mcpManager.ts` discovers server configs, parses JSONC, and toggles `enabled`.

## Key Modules

- `src/extension.ts` — composition root, watchers, commands, lifecycle
- `src/specManager.ts` — spec file operations and templating
- `src/taskManager.ts` — markdown task parsing and completion updates
- `src/codeLensProvider.ts` — spec/task requirement CodeLens and link automation
- `src/specProvider.ts` — tree view providers and items
- `src/statusBar.ts` — progress status bar item
- `src/webview/specPanel.ts` — spec panel webview UI
- `src/copilot/specGenerator.ts` — chat-based content generation
- `src/autopilot.ts` — task-by-task implementation runner
- `src/steeringManager.ts` — managed steering sections in copilot instructions
- `src/hooksManager.ts` — hooks listing and creation UX
- `src/mcpManager.ts` — MCP server discovery and enable/disable mutation

## Error Handling Strategy

- Prefer non-throwing behavior for optional resources (missing files return empty collections)
- Guard all filesystem interactions with `fileExists`/try-catch
- Surface actionable warnings/info in VS Code notifications
- Skip malformed hook/MCP entries rather than failing extension activation.

## Constraints and Trade-offs

- Task parsing is intentionally markdown/regex-based for low dependency overhead
- Auto-linking is debounced to reduce noise on frequent file changes
- MCP JSON parser tolerates comments and trailing commas for compatibility
- Autopilot applies full-file edits from model output and expects strict `FILE:` block format.

## Open Questions

- Should autopilot support structured patch format in addition to full-file replacement?
- Should hook management validate command safety or timeout defaults before save?
- Should spec panel render interactive task controls from parsed tasks rather than markdown HTML alone?
