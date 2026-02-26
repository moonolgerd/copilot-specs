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
   - Steering + Skills + Prompts (Instructions, Rules, Skills, and Prompts sections)
   - Hooks
   - MCP Servers (two view IDs)
3. Register CodeLens provider across file scheme documents
4. Register file watchers for spec instructions, hooks, MCP configs, steering files, and prompts
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
- Computes completion metrics for UI and status bar
- Also parses heading-style tasks (`### T1: Title`): collects subsequent `- [ ]`/`- [x]` lines as subtasks and derives parent completion state from them
- Heading tasks may also carry an explicit checkbox (`### - [x] T1: Title`) which takes precedence over subtask derivation.

#### CodeLens and traceability

- `codeLensProvider.ts` maps source files to specs by glob and manual links
- Adds requirement/task navigation lenses in requirements/tasks documents
- Supports file-link extraction and inferred requirement mapping
- Does not render a "Referenced" lens when no implementation files are linked
- For heading-style tasks: renders `$(circle-large-outline) Start task` when incomplete, `$(pass-filled) Task Completed` when all subtasks are checked.

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

#### Start Task inline action

- Incomplete task tree items expose a `$(play)` inline icon via `viewItem == task-incomplete` context menu condition in `package.json`.
- The `copilot-specs.startTask` command accepts a task tree item; it resolves the spec name and task ID, then builds a rich context prompt via `buildStartTaskPrompt()` in `src/copilot/taskStarter.ts`.
- Prompt construction:
  1. Load requirements and design doc text via `readTextFile`.
  2. Resolve linked implementation files from `.copilot-specs-cache/<spec>.links.json`.
  3. Compose a prompt containing spec name, task ID/title, requirement IDs, relevant requirement passages, design excerpt, linked file paths, and agent-friendly implementation instructions.
- Opens Copilot Chat in **agent mode** via `vscode.commands.executeCommand('workbench.action.chat.open', { query, mode: 'agent' })`. The agent has full tool access to read files, make edits, and run tests — unlike the `@spec implement` participant which has no tool access.
- The prompt instructs the agent to: read linked files first, implement following project conventions, verify compilation/tests, and stay focused on the specific task.
- Task completion is left to the user (via the Mark Complete CodeLens or tree action) rather than being auto-applied.

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
- `src/copilot/taskStarter.ts` — focused single-task chat prompt builder for the Start Task action
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
- Start Task uses agent mode rather than direct `model.sendRequest()` so the agent can read existing code before editing.

## Open Questions

- Should autopilot support structured patch format in addition to full-file replacement?
- Should hook management validate command safety or timeout defaults before save?

## Decisions

- **Spec panel task rendering:** The tasks tab SHALL be rendered from the parsed `Task[]` model rather than from `marked.parse()` on the raw markdown. `marked` emits `<input type="checkbox" disabled>` for GFM checkboxes, which silently breaks the `toggleTask()` / `data-task` wiring already present. Rendering from the model allows each task row to receive an enabled checkbox with the correct `data-task` attribute and `onclick` handler.

- **Preserve completed states on regenerate:** When `generateFullSpec` or `@spec regenerate tasks` overwrites the tasks file, completed task IDs are captured before the write and reapplied afterwards via `applyCompletedIds`. This prevents generation from resetting user progress.

- **Heading-style task CodeLens consistency:** For `###`-headed task docs (used by third-party specs), the CodeLens layer uses `$(circle-large-outline)` for incomplete tasks and `$(pass-filled)` for complete ones to provide a visual checkbox metaphor without requiring inline `[ ]` syntax on the heading line itself.
