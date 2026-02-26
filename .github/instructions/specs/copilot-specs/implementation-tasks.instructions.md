---
name: copilot-specs
applyTo: "src/**"
---

# Copilot Specs Extension Implementation Tasks

<!-- files: src/** -->

## Core Tasks

- [x] **T1**: Scaffold and manage spec files <!-- requires:REQ-01 -->
  - [x] Create spec directories and instruction files from templates
  - [x] Parse `applyTo` from requirements frontmatter
  - [x] Support delete and rename of specs

- [x] **T2**: Implement markdown task parser and progress model <!-- requires:REQ-02 -->
  - [x] Parse top-level tasks and subtasks from checkbox markdown
  - [x] Extract task IDs and requirement references
  - [x] Implement task completion toggling and aggregate progress

- [x] **T3**: Build explorer views and status bar integration <!-- requires:REQ-03 -->
  - [x] Add tree views for specs, steering/skills, hooks, and MCP servers
  - [x] Register file watchers and refresh providers on changes
  - [x] Show status bar progress and open panel command integration

- [x] **T4**: Implement CodeLens traceability features <!-- requires:REQ-04 -->
  - [x] Show file-level spec/task CodeLens for matched files
  - [x] Add requirements↔tasks CodeLens in instructions documents
  - [x] Implement task-to-file linking and auto-linking workflows
  - [x] Remove spurious "Referenced: FILE" lens when no implementation files are linked

- [x] **T5**: Add Copilot generation and autopilot execution <!-- requires:REQ-05 -->
  - [x] Create chat participant commands for create/regenerate flows
  - [x] Generate section content and persist to spec files
  - [x] Execute pending tasks via model responses and apply workspace edits
  - [x] Preserve completed task states when regenerating tasks via `applyCompletedIds` / `preserveCompletedTaskStates`

- [x] **T6**: Support steering, hooks, and MCP management <!-- requires:REQ-06 -->
  - [x] Read and append managed steering sections
  - [x] Create/list hooks from `.github/hooks/*.json`
  - [x] Discover MCP servers and toggle enabled state in config files

## Remaining Enhancements

- [x] **T7**: Strengthen autopilot edit safety
  - [x] Add file content diff preview before apply
  - [x] Validate parsed `FILE:` blocks before writing
  - [x] Add rollback strategy for failed multi-file applies

- [x] **T8**: Improve diagnostics and docs coverage
  - [x] Add explicit validation feedback for malformed spec/task markdown
  - [x] Add user-facing docs for hook and MCP config formats
  - [x] Add tests for requirement inference and glob matching edge cases

- [x] **T9**: Add "Start Task" inline action for incomplete tasks <!-- requires:REQ-07 -->
  - [x] Register a `copilot-specs.startTask` command that opens a focused Copilot chat with pre-filled spec name, task ID, and title
  - [x] Add `$(play)` inline button in the tree view next to each incomplete task item
  - [x] Parse heading-style (`### T1: Title`) task documents: derive completion from child checkboxes
  - [x] Show `$(circle-large-outline) Start task` / `$(pass-filled) Task Completed` CodeLens on heading-style task lines
  - [x] Include full task context (requirements text, design doc excerpt, linked file paths) in the chat prompt
  - [x] After the chat session completes, prompt the user to mark the task complete
