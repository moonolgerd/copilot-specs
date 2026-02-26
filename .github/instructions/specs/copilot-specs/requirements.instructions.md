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

WHEN a tasks document uses `### Heading` style tasks
THE SYSTEM SHALL parse each `###` line as a parent task
AND collect subsequent `- [ ]` / `- [x]` lines as its subtasks regardless of indentation
AND derive the parent task completion state from whether all subtasks are checked.

WHEN a task completion toggle command is invoked
THE SYSTEM SHALL update the checkbox state in the tasks markdown file
AND preserve the rest of the document structure.

### REQ-03: Explorer Views and Status Bar

WHEN the extension is activated
THE SYSTEM SHALL show a Spec Explorer tree with each spec and its requirements/design/tasks files
AND show an Instructions & Skills tree with Instructions, Rules, Skills, and Prompts sections
AND show Hooks and MCP Servers trees
AND refresh trees when relevant files change.
AND list `.github/prompts/*.prompt.md` files under a Prompts section in the Instructions & Skills tree.

WHEN at least one spec exists
THE SYSTEM SHALL show status bar progress for the most pending spec
AND keep status values in sync as task completion changes.

### REQ-04: CodeLens Mapping and Traceability

WHEN a code file matches a spec `applyTo` glob or manual task links
THE SYSTEM SHALL render CodeLens entries that open related tasks or spec mapping actions.

WHEN viewing tasks or requirements documents
THE SYSTEM SHALL render CodeLens entries for requirement-to-task and task-to-implementation navigation
AND support opening linked files and inferred file references
AND SHALL NOT render a "Referenced" lens when no implementation files are linked.

### REQ-05: Copilot-Assisted Generation and Autopilot

WHEN the user runs “Generate with Copilot”
THE SYSTEM SHALL generate requirements, design, and tasks content via chat model
AND write generated content back to spec files
AND preserve the completion state of any tasks that were already marked complete before regeneration.

WHEN the user runs Autopilot
THE SYSTEM SHALL load pending tasks for a selected spec
AND request implementation output from the selected Copilot model
AND parse `FILE: <path>` code blocks into workspace edits
AND mark a task complete after execution flow succeeds.
WHEN the `@spec implement` chat participant command is used
THE SYSTEM SHALL display the task context as a reference
AND recommend using the Start Task CodeLens for agent mode instead.

### REQ-06: Hook and MCP Management

WHEN the user adds a hook
THE SYSTEM SHALL create or update `.github/hooks/*.json` with the selected lifecycle event and command entry.

WHEN MCP config files are present in workspace or user locations
THE SYSTEM SHALL list discovered servers grouped by source
AND allow toggling server enabled state by updating the owning config file.

WHEN the user clicks the Workspace MCP source item
THE SYSTEM SHALL open `.github/mcp.json`
AND if it does not exist, create a valid config file with `{"servers": {}}`.

### REQ-07: Start Task Inline Action

WHEN a task is incomplete and visible in the Spec Explorer tree
THE SYSTEM SHALL display an inline `$(play)` action button next to the task item.

WHEN viewing a heading-style tasks document (`### T1: Title`)
THE SYSTEM SHALL show `$(circle-large-outline) Start task` CodeLens on incomplete heading lines
AND show `$(pass-filled) Task Completed` CodeLens when all subtasks under that heading are checked.

WHEN the user activates the Start Task action for an incomplete task
THE SYSTEM SHALL build a rich context prompt containing the spec name, task ID, task title, linked requirement IDs, matching requirements text, a design doc excerpt, and linked implementation file paths
AND open the prompt in Copilot agent mode (`mode: "agent"`) where the agent has full tool access to read files, make edits, and run tests
AND instruct the agent to read existing code first, implement following project conventions, and verify compilation.

### REQ-08: Verify All Tasks Workflow

WHEN the user clicks Run/Verify All Tasks from a spec row
THE SYSTEM SHALL open Copilot Chat in agent mode with a spec-wide verification prompt
AND include task summary and spec file context in the prompt
AND instruct the agent to validate task completion against code and update task states accordingly.
