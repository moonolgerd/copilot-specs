---
name: "Hook Configuration Reference"
applyTo: ".github/hooks/*.json"
---

# Hooks JSON Reference

This project uses native Copilot agent hook JSON files under `.github/hooks/`.

## Supported events

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `PreCompact`
- `SubagentStart`
- `SubagentStop`
- `Stop`

## Hook file example

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "type": "command",
        "command": "npm run lint",
        "windows": "npm.cmd run lint",
        "timeout": 120000
      }
    ]
  }
}
```

## Notes

- `type` must be `command`.
- Platform overrides can be provided with `windows`, `linux`, and `osx`.
- `cwd`, `env`, and `timeout` are supported fields.
