# Copilot Instructions — copilot-specs

This is a **VS Code extension** (TypeScript, Node 18, ES2022) that manages specification-driven development workflows inside VS Code. Use these instructions when contributing to or reasoning about this codebase.

---

## Architecture Overview

```
src/extension.ts          ← Composition root. Wires all providers, commands,
                            file-system watchers, and the chat participant.
src/specManager.ts        ← Spec CRUD: create/list/load/delete/rename specs.
                            Reads templates via node:fs readFileSync.
src/taskManager.ts        ← Markdown task parser + completion toggler.
src/codeLensProvider.ts   ← CodeLens for source files, task docs, requirement docs.
                            Caches task↔file links in .copilot-specs-cache/.
src/specProvider.ts       ← TreeDataProviders (SpecProvider, SteeringProvider,
                            HooksProvider, MCPServersProvider).
src/statusBar.ts          ← SpecStatusBar showing active-spec task progress.
src/webview/specPanel.ts  ← Full webview panel for spec editing/display.
src/copilot/
  chatParticipant.ts      ← @spec create / regenerate chat participant.
  specGenerator.ts        ← vscode.lm gpt-4o content generation.
src/autopilot.ts          ← Parses FILE: blocks from model output; applies
                            changes via WorkspaceEdit.
src/steeringManager.ts    ← Managed sections in .github/copilot-instructions.md.
src/hooksManager.ts       ← .github/hooks/*.json management.
src/mcpManager.ts         ← MCP server discovery + toggling (JSONC parsing).
src/models/index.ts       ← All shared TypeScript interfaces.
src/utils/fileSystem.ts   ← All vscode.workspace.fs wrappers + path constants.
src/utils/frontmatter.ts  ← YAML frontmatter parse/serialize/strip (js-yaml).
```

**Data flow**: `specManager` creates/loads spec files → `taskManager` parses tasks → `codeLensProvider` links tasks to implementation files (cache in `.copilot-specs-cache/`) → `statusBar` renders progress.

---

## Spec Storage Layout

```
.github/instructions/specs/<name>/
  requirements.instructions.md       ← REQ-xx IDs in frontmatter/body
  design.instructions.md             ← Architecture + integration decisions
  implementation-tasks.instructions.md  ← Task list with <!-- task:Tn --> markers
.copilot-specs-cache/<name>.links.json  ← SpecLinks: { [taskId]: string[] }
.github/hooks/*.json                    ← HooksFileConfig (HookEventName → Hook[])
.github/copilot-instructions.md         ← Steering; managed sections use markers
```

Frontmatter fields (YAML): `name`, `applyTo`, `description`.

---

## Task & Requirements Conventions

- Task IDs are embedded as HTML comments: `<!-- task:T1 -->` or bold: `**T1**`
- Requirement links: `<!-- requires:REQ-01 -->`
- Full task line format:
  ```markdown
  - [ ] <!-- task:T1 --> Title <!-- requires:REQ-01 -->
  ```
- `taskManager.ts` uses these exact regex patterns — do not change the comment syntax.
- Auto-linking triggers 1200 ms after any change to `implementation-tasks.instructions.md` or any implementation file (`.ts`, `.js`, `.py`, `.go`, etc.). It skips `.git/`, `node_modules/`, `dist/`, `.github/`.

---

## File System Rules

- **All workspace FS operations must go through `src/utils/fileSystem.ts`** which wraps `vscode.workspace.fs`. Never use `node:fs` inside `src/` except in `specManager.ts` and `mcpManager.ts` (template loading / JSONC config reading).
- Path constants live in `fileSystem.ts`:
  - `INSTRUCTIONS_SPECS_DIR = ".github/instructions/specs"`
  - `HOOKS_DIR = ".github/hooks"`
  - `COPILOT_INSTRUCTIONS_FILE = ".github/copilot-instructions.md"`
- `TextEncoder` / `TextDecoder` (from `@types/node`) are used for byte buffers — do not add `Buffer` polyfills.

---

## Steering (copilot-instructions.md) Sections

Managed blocks use sentinel comments:

```markdown
<!-- copilot-specs:steering:start -->

...content managed by steeringManager...

<!-- copilot-specs:steering:end -->
```

Do not remove or reorder these markers. `steeringManager.ts` replaces content between them programmatically.

---

## Autopilot FILE Blocks

When `specGenerator.ts` or the autopilot runs, model output must produce changes using `FILE:` blocks:

````
FILE: src/example.ts
```typescript
// full file content
````

````
`autopilot.ts` parses these blocks and applies them as a `vscode.WorkspaceEdit`. Do not embed partial diffs — always emit the complete file content.

---

## Build & Development

| Command | Purpose |
|---|---|
| `npm run compile` | Type-check + emit via `tsc` |
| `npm run bundle` | Production bundle via esbuild → `dist/extension.js` |
| `npm run dev` | Watch mode (esbuild `--watch`) |
| `npm run lint` | ESLint on `src/` |
| `npm test` | `@vscode/test-cli` integration tests |
| **F5** | Launch Extension Development Host in VS Code |

Build output: `dist/extension.js` (CJS, target node18, `vscode` externalized).

---

## TypeScript Conventions

- `module: "Node16"`, `target: "ES2022"`, `strict: true`, `types: ["node"]`
- **Always add `.js` extension to relative imports** (Node16 ESM resolution):
  ```typescript
  import { parseFrontmatter } from "./utils/frontmatter.js";
````

- All shared types live in `src/models/index.ts` — add new interfaces there.
- Use `vscode.lm.selectChatModels({ family: "gpt-4o" })` for LLM calls; do not hard-code model IDs.

---

## Packaging & Release

- Icon: `media/icon.png` (256×256, referenced in `package.json` as `"icon"`)
- Package: `npx @vscode/vsce package`
- Publish: triggered by `v*` tag push (see `.github/workflows/release.yml`); requires `VSCE_PAT` secret
- `CHANGELOG.md` follows Keep a Changelog format — update `[Unreleased]` on every meaningful change
