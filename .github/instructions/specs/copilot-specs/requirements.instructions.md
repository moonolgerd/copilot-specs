---
name: copilot-specs
applyTo: "src/**"
---

# Copilot Specs Extension Requirements

## Functional Requirements

### REQ-01: Spec Scaffolding and Lifecycle

WHEN the user creates a new spec
THE SYSTEM SHALL create `.github/instructions/specs/<spec-name>/`
AND create `requirements.instructions.md`, `design.instructions.md`, and `implementation-tasks.instructions.md`
AND initialize each file from templates with `name` and `applyTo` frontmatter
AND create `.copilot-specs-cache/<spec-name>.links.json` when missing

WHEN the user renames or deletes a spec
THE SYSTEM SHALL rename or delete the corresponding spec instruction directory
AND keep tree views and status indicators in sync.

### REQ-02: Task Parsing and Progress Tracking

WHEN a tasks document is loaded
THE SYSTEM SHALL parse markdown checkbox tasks and subtasks
AND extract task IDs from `<!-- task:Tn -->` or `**Tn**` prefixes
AND extract requirement references from `<!-- requires:REQ-01 -->` and task text
AND compute completion progress from parsed task state.

WHEN a task completion toggle command is invoked
THE SYSTEM SHALL update the checkbox state in the tasks markdown file
AND preserve the rest of the document structure.

### REQ-03: Explorer Views and Status Bar

WHEN the extension is activated
THE SYSTEM SHALL show a Spec Explorer tree with each spec and its requirements/design/tasks files
AND show Steering + Skills, Hooks, and MCP Servers trees
AND refresh trees when relevant files change.

WHEN at least one spec exists
THE SYSTEM SHALL show status bar progress for the most pending spec
AND open the spec panel when the status item is clicked.

### REQ-04: CodeLens Mapping and Traceability

WHEN a code file matches a spec `applyTo` glob or manual task links
THE SYSTEM SHALL render CodeLens entries that open the spec panel or related tasks.

WHEN viewing tasks or requirements documents
THE SYSTEM SHALL render CodeLens entries for requirement-to-task and task-to-implementation navigation
AND support opening linked files and inferred file references.

### REQ-05: Copilot-Assisted Generation and Autopilot

WHEN the user runs “Generate with Copilot”
THE SYSTEM SHALL generate requirements, design, and tasks content via chat model
AND write generated content back to spec files.

WHEN the user runs Autopilot
THE SYSTEM SHALL load pending tasks for a selected spec
AND request implementation output from the selected Copilot model
AND parse `FILE: <path>` code blocks into workspace edits
AND mark a task complete after execution flow succeeds.

### REQ-06: Hook and MCP Management

WHEN the user adds a hook
THE SYSTEM SHALL create or update `.github/hooks/*.json` with the selected lifecycle event and command entry.

WHEN MCP config files are present in workspace or user locations
THE SYSTEM SHALL list discovered servers grouped by source
AND allow toggling server enabled state by updating the owning config file.
