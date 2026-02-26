import * as vscode from "vscode";
import {
  Hook,
  HookCommand,
  HookEventName,
  HooksFileConfig,
  HOOK_EVENT_NAMES,
} from "./models/index.js";
import {
  readTextFile,
  writeTextFile,
  ensureDir,
  listFiles,
  resolveWorkspacePath,
  HOOKS_DIR,
} from "./utils/fileSystem.js";

export function initHooks(_extensionPath: string): void {
  // Reserved
}

const EVENT_DESCRIPTIONS: Record<HookEventName, string> = {
  SessionStart: "When a new agent session begins",
  UserPromptSubmit: "When the user submits a prompt",
  PreToolUse: "Before agent invokes any tool",
  PostToolUse: "After a tool completes successfully",
  PreCompact: "Before conversation context is compacted",
  SubagentStart: "When a subagent is spawned",
  SubagentStop: "When a subagent completes",
  Stop: "When the agent session ends",
};

export async function listHooks(): Promise<Hook[]> {
  const hooks: Hook[] = [];

  const hooksDir = resolveWorkspacePath(HOOKS_DIR);
  if (!hooksDir) {
    return hooks;
  }

  let files: string[];
  try {
    files = await listFiles(hooksDir, ".json");
  } catch {
    return hooks;
  }

  for (const file of files) {
    const uri = resolveWorkspacePath(HOOKS_DIR, file);
    if (!uri) {
      continue;
    }
    try {
      const content = await readTextFile(uri);
      const config = JSON.parse(content) as HooksFileConfig;
      if (!config.hooks) {
        continue;
      }
      for (const [event, commands] of Object.entries(config.hooks)) {
        if (!Array.isArray(commands)) {
          continue;
        }
        for (const [commandIndex, cmd] of (
          commands as HookCommand[]
        ).entries()) {
          const shortCmd =
            cmd.command?.length > 40
              ? cmd.command.substring(0, 37) + "..."
              : cmd.command;
          hooks.push({
            name: `${event}: ${shortCmd}`,
            filePath: uri.fsPath,
            event: event as HookEventName,
            enabled: cmd.enabled !== false,
            commandIndex,
            commandEntry: cmd,
          });
        }
      }
    } catch {
      /* skip malformed JSON */
    }
  }

  return hooks;
}

export async function createHook(_extensionPath: string): Promise<void> {
  // 1. Which JSON file to add to?
  const hooksDir = resolveWorkspacePath(HOOKS_DIR);
  let existingFiles: string[] = [];
  if (hooksDir) {
    existingFiles = await listFiles(hooksDir, ".json");
  }

  const NEW_FILE_LABEL = "$(add) Create new hooks file…";
  const fileChoice = await vscode.window.showQuickPick(
    [...existingFiles.map((f) => ({ label: f })), { label: NEW_FILE_LABEL }],
    { placeHolder: "Which hooks file to add to?" },
  );
  if (!fileChoice) {
    return;
  }

  let fileName: string;
  if (fileChoice.label === NEW_FILE_LABEL) {
    const name = await vscode.window.showInputBox({
      prompt: "Hooks file name (without .json)",
      placeHolder: "hooks",
      value: "hooks",
    });
    if (!name) {
      return;
    }
    fileName = `${name.trim()}.json`;
  } else {
    fileName = fileChoice.label;
  }

  // 2. Which lifecycle event?
  const eventPick = await vscode.window.showQuickPick(
    HOOK_EVENT_NAMES.map((e) => ({
      label: e,
      description: EVENT_DESCRIPTIONS[e],
    })),
    { placeHolder: "Select lifecycle event" },
  );
  if (!eventPick) {
    return;
  }

  // 3. Shell command to run
  const command = await vscode.window.showInputBox({
    prompt: "Shell command to run",
    placeHolder: "e.g. npm run lint",
    validateInput: (v) => (v.trim() ? undefined : "Command cannot be empty"),
  });
  if (!command) {
    return;
  }

  // 4. Optional Windows-specific override
  const windowsCmd = await vscode.window.showInputBox({
    prompt:
      "Windows-specific command override (optional — press Enter to skip)",
    placeHolder: "e.g. powershell -File scripts\\lint.ps1",
  });

  // 5. Build the hook entry
  const entry: HookCommand = { type: "command", command: command.trim() };
  if (windowsCmd?.trim()) {
    entry.windows = windowsCmd.trim();
  }

  // 6. Read existing JSON or start fresh
  if (hooksDir) {
    await ensureDir(hooksDir);
  }
  const uri = resolveWorkspacePath(HOOKS_DIR, fileName);
  if (!uri) {
    return;
  }

  let config: HooksFileConfig = { hooks: {} };
  try {
    const existing = await readTextFile(uri);
    config = JSON.parse(existing) as HooksFileConfig;
    if (!config.hooks) {
      config.hooks = {};
    }
  } catch {
    // New file — start with empty config
  }

  const event = eventPick.label as HookEventName;
  if (!config.hooks[event]) {
    config.hooks[event] = [];
  }
  config.hooks[event]!.push(entry);

  await writeTextFile(uri, JSON.stringify(config, null, 2) + "\n");
  await vscode.commands.executeCommand("vscode.open", uri);
}

/** Open the hook's JSON file in the editor for manual editing. */
export async function runHook(hook: Hook): Promise<void> {
  await vscode.commands.executeCommand(
    "vscode.open",
    vscode.Uri.file(hook.filePath),
  );
}

export async function setHookEnabled(
  filePath: string,
  event: HookEventName,
  commandIndex: number,
  enabled: boolean,
): Promise<boolean> {
  try {
    const uri = vscode.Uri.file(filePath);
    const content = await readTextFile(uri);
    const config = JSON.parse(content) as HooksFileConfig;
    const commands = config.hooks?.[event];
    if (
      !Array.isArray(commands) ||
      commandIndex < 0 ||
      commandIndex >= commands.length
    ) {
      return false;
    }

    const command = commands[commandIndex] as HookCommand;
    command.enabled = enabled;
    await writeTextFile(uri, JSON.stringify(config, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

/**
 * Watch .github/hooks/*.json for changes so the TreeView stays in sync.
 * The actual re-registration of watchers is handled via makeWatcher() in extension.ts.
 */
export function registerHookWatchers(
  _context: vscode.ExtensionContext,
  _hooksLoader: () => Promise<Hook[]>,
): void {
  // Watchers for refreshing the tree view are registered in extension.ts
  // via makeWatcher(`${HOOKS_DIR}/**`, ...). Nothing extra needed here.
}
