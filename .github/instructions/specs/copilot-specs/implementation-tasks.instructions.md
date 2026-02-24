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

- [x] **T5**: Add Copilot generation and autopilot execution <!-- requires:REQ-05 -->
  - [x] Create chat participant commands for create/regenerate flows
  - [x] Generate section content and persist to spec files
  - [x] Execute pending tasks via model responses and apply workspace edits

- [x] **T6**: Support steering, hooks, and MCP management <!-- requires:REQ-06 -->
  - [x] Read and append managed steering sections
  - [x] Create/list hooks from `.github/hooks/*.json`
  - [x] Discover MCP servers and toggle enabled state in config files

## Remaining Enhancements

- [ ] **T7**: Strengthen autopilot edit safety
  - [ ] Add file content diff preview before apply
  - [ ] Validate parsed `FILE:` blocks before writing
  - [ ] Add rollback strategy for failed multi-file applies

- [ ] **T8**: Improve diagnostics and docs coverage
  - [ ] Add explicit validation feedback for malformed spec/task markdown
  - [ ] Add user-facing docs for hook and MCP config formats
  - [ ] Add tests for requirement inference and glob matching edge cases
