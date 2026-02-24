---
name: "{{SPEC_NAME}} Design"
applyTo: "{{FILE_GLOB}}"
description: "Architecture and design for the {{SPEC_NAME}} feature"
---

# {{SPEC_NAME}} — Design

## Architecture Overview

> High-level description of the solution approach.

## Storage and Files

- Instruction files path(s): <!-- e.g., .github/instructions/specs/... -->
- Cache/metadata files: <!-- optional -->
- External config inputs: <!-- optional -->

## Components

### Component 1: <!-- Name -->

**Responsibility:** <!-- What this component does -->

**Interface:**

```typescript
// Key types, interfaces, or function signatures
```

### Component 2: <!-- Name -->

**Responsibility:** <!-- What this component does -->

### Integration Points

- Commands/UI entry points: <!-- VS Code commands, API routes, etc. -->
- Background triggers/watchers: <!-- file watcher, event bus, cron -->
- External dependencies: <!-- language model, DB, service -->

## Data Flow

```
[Client] --> [Component A] --> [Component B] --> [Data Store]
            <-- response ----  <-- result -----
```

## Sequence Diagram

```
Actor -> System: request
System -> Service: process
Service -> Store: read/write
Store --> Service: result
Service --> System: response
System --> Actor: output
```

## Error Handling

| Scenario            | Handling Strategy         |
| ------------------- | ------------------------- |
| <!-- error case --> | <!-- how it's handled --> |
| <!-- error case --> | <!-- how it's handled --> |

## Dependencies

- <!-- External library or service and why it's needed -->

## Traceability

- REQ-01 → <!-- component(s) and flow(s) -->
- REQ-02 → <!-- component(s) and flow(s) -->

## Open Questions

- [ ] <!-- Decision to be made -->
