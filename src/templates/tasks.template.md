---
name: { { SPEC_NAME } }
applyTo: "{{FILE_GLOB}}"
---

# {{SPEC_NAME}} — Tasks

<!-- files: {{FILE_GLOB}} -->

## Implementation Tasks

- [ ] <!-- task:T1 --> Set up basic structure and types <!-- requires:REQ-01 -->
  - [ ] Define interfaces and models
  - [ ] Create directory structure

- [ ] <!-- task:T2 --> Implement core logic <!-- requires:REQ-01,REQ-02 -->
  - [ ] Write main implementation
  - [ ] Add error handling

- [ ] <!-- task:T3 --> Add tests <!-- requires:REQ-02 -->
  - [ ] Unit tests for core logic
  - [ ] Integration tests

- [ ] <!-- task:T4 --> Update documentation <!-- requires:REQ-03 -->
  - [ ] Add inline JSDoc comments
  - [ ] Update README if needed

## Linking Hints

- Mention concrete file paths in task descriptions when known.
- Keep `task:Tn` IDs stable; links and automation use them.
- Use `requires:REQ-xx` to make requirement-task mapping explicit.

## Notes

> Add any implementation notes, caveats, or decisions made during development.
