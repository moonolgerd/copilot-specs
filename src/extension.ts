import * as vscode from "vscode";
import * as path from "node:path";

import {
  initTemplates,
  promptCreateSpec,
  listSpecs,
  deleteSpec,
  renameSpec,
  loadSpec,
} from "./specManager.js";
import {
  loadTasks,
  setTaskCompleted,
  calculateProgress,
} from "./taskManager.js";
import {
  SpecProvider,
  SteeringProvider,
  HooksProvider,
  MCPServersProvider,
  MCPServerItem,
  TaskItem,
} from "./specProvider.js";
import { SpecStatusBar } from "./statusBar.js";
import {
  SpecCodeLensProvider,
  linkCurrentFileToTask,
  linkExistingTaskToImplementation,
  openTaskImplementations,
  openRequirementTasks,
  openTaskRequirements,
  showRequirementTaskMap,
  openTaskReferencedFiles,
} from "./codeLensProvider.js";
import { SpecPanel } from "./webview/specPanel.js";
import {
  readAllSteering,
  promptNewSteering,
  openSteeringFile,
} from "./steeringManager.js";
import {
  listHooks,
  createHook,
  runHook,
  registerHookWatchers,
  initHooks,
} from "./hooksManager.js";
import { registerChatParticipant } from "./copilot/chatParticipant.js";
import { runAutopilot } from "./autopilot.js";
import {
  listMcpConfigTargets,
  listMcpServers,
  setMcpServerEnabled,
} from "./mcpManager.js";
import {
  INSTRUCTIONS_SPECS_DIR,
  HOOKS_DIR,
  copilotInstructionsUri,
  fileExists,
  listSkillFiles,
} from "./utils/fileSystem.js";
import { Task } from "./models/index.js";

export function activate(context: vscode.ExtensionContext): void {
  const extensionPath = context.extensionPath;

  // Initialize template loading
  initTemplates(extensionPath);
  initHooks(extensionPath);

  // ── Providers ───────────────────────────────────────────────────────────────

  const specProvider = new SpecProvider();
  const steeringProvider = new SteeringProvider(
    async () => {
      const items: { name: string; filePath: string }[] = [];
      const ciUri = copilotInstructionsUri();
      if (ciUri && (await fileExists(ciUri))) {
        items.push({ name: "copilot-instructions.md", filePath: ciUri.fsPath });
      }
      const entries = await readAllSteering();
      for (const e of entries) {
        items.push({ name: e.name, filePath: e.filePath });
      }
      return items;
    },
    async () => {
      const skills = await listSkillFiles();
      return skills.map((s) => ({ name: s.name, filePath: s.uri.fsPath }));
    },
  );
  const hooksProvider = new HooksProvider(async () => {
    const hooks = await listHooks();
    return hooks.map((h) => ({
      name: h.name,
      filePath: h.filePath,
      enabled: true, // native hooks are always active
    }));
  });
  const mcpServersProvider = new MCPServersProvider(async () =>
    listMcpServers(),
  );
  const codeLensProvider = new SpecCodeLensProvider();
  const statusBar = new SpecStatusBar();

  // ── Tree Views ──────────────────────────────────────────────────────────────

  const specExplorer = vscode.window.createTreeView(
    "copilot-specs.specExplorer",
    {
      treeDataProvider: specProvider,
      showCollapseAll: true,
    },
  );

  vscode.window.registerTreeDataProvider(
    "copilot-specs.steeringExplorer",
    steeringProvider,
  );
  context.subscriptions.push(
    vscode.window.createTreeView("copilot-specs.hooksExplorer", {
      treeDataProvider: hooksProvider,
      showCollapseAll: false,
    }),
  );
  context.subscriptions.push(
    vscode.window.createTreeView("copilot-specs.mcpServersExplorer", {
      treeDataProvider: mcpServersProvider,
      showCollapseAll: true,
    }),
  );
  context.subscriptions.push(
    vscode.window.createTreeView("copilot-specs.mcpServersExplorerSidebar", {
      treeDataProvider: mcpServersProvider,
      showCollapseAll: true,
    }),
  );

  // ── CodeLens ────────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: "file" },
      codeLensProvider,
    ),
  );

  // ── File System Watchers ────────────────────────────────────────────────────

  function makeWatcher(globPattern: string, refresh: () => void): void {
    const wf = vscode.workspace.workspaceFolders?.[0];
    if (!wf) {
      return;
    }
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(wf, globPattern),
    );
    watcher.onDidCreate(() => {
      refresh();
    });
    watcher.onDidDelete(() => {
      refresh();
    });
    watcher.onDidChange(() => {
      refresh();
    });
    context.subscriptions.push(watcher);
  }

  const refreshAll = () => {
    specProvider.refresh();
    codeLensProvider.refresh();
    updateStatusBar().catch(console.error);
  };

  let autoLinkTimer: NodeJS.Timeout | undefined;
  let autoLinkRunning = false;
  let autoLinkQueued = false;

  const runAutoLink = async (): Promise<void> => {
    if (autoLinkRunning) {
      autoLinkQueued = true;
      return;
    }
    autoLinkRunning = true;
    try {
      await linkExistingTaskToImplementation(
        { refresh: () => refreshAll() },
        { silent: true },
      );
    } catch (err) {
      console.error("Auto-linking tasks failed", err);
    } finally {
      autoLinkRunning = false;
      if (autoLinkQueued) {
        autoLinkQueued = false;
        scheduleAutoLink();
      }
    }
  };

  const scheduleAutoLink = (): void => {
    if (autoLinkTimer) {
      clearTimeout(autoLinkTimer);
    }
    autoLinkTimer = setTimeout(() => {
      void runAutoLink();
    }, 1200);
  };

  makeWatcher(`${INSTRUCTIONS_SPECS_DIR}/**`, () => {
    refreshAll();
    scheduleAutoLink();
  });
  makeWatcher(`${HOOKS_DIR}/**`, () => hooksProvider.refresh());
  makeWatcher(".vscode/mcp.json", () => mcpServersProvider.refresh());
  makeWatcher(".mcp.json", () => mcpServersProvider.refresh());
  makeWatcher("mcp.json", () => mcpServersProvider.refresh());
  makeWatcher(".github/copilot-instructions.md", () =>
    steeringProvider.refresh(),
  );
  makeWatcher(".github/skills/**", () => steeringProvider.refresh());

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (shouldScheduleAutoLink(document.uri)) {
        scheduleAutoLink();
      }
    }),
  );

  // ── Status Bar ──────────────────────────────────────────────────────────────

  async function updateStatusBar(): Promise<void> {
    const specs = await listSpecs();
    if (specs.length === 0) {
      statusBar.hide();
      return;
    }
    // Show the first spec with the most pending tasks
    let best = specs[0];
    let bestPending = 0;
    for (const spec of specs) {
      const { tasks } = await loadTasks(spec.name);
      const prog = calculateProgress(tasks);
      const pending = prog.total - prog.completed;
      if (pending > bestPending) {
        best = spec;
        bestPending = pending;
      }
    }
    const { tasks } = await loadTasks(best.name);
    const prog = calculateProgress(tasks);
    statusBar.update(best.name, prog.completed, prog.total);
  }

  updateStatusBar().catch(console.error);

  // ── Hook Watchers ────────────────────────────────────────────────────────────

  registerHookWatchers(context, listHooks);

  // ── Chat Participant ─────────────────────────────────────────────────────────

  registerChatParticipant(context);

  // ── Commands ─────────────────────────────────────────────────────────────────

  const cmds: [string, (...args: unknown[]) => unknown][] = [
    [
      "copilot-specs.newSpec",
      async () => {
        await promptCreateSpec();
        refreshAll();
      },
    ],

    [
      "copilot-specs.deleteSpec",
      async (item?: unknown) => {
        const name = resolveSpecName(item);
        if (!name) {
          return;
        }
        const confirm = await vscode.window.showWarningMessage(
          `Delete spec "${name}" and all its files?`,
          { modal: true },
          "Delete",
        );
        if (confirm !== "Delete") {
          return;
        }
        await deleteSpec(name);
        refreshAll();
      },
    ],

    [
      "copilot-specs.renameSpec",
      async (item?: unknown) => {
        const oldName = resolveSpecName(item);
        if (!oldName) {
          return;
        }
        const newName = await vscode.window.showInputBox({
          prompt: `Rename spec "${oldName}" to:`,
          value: oldName,
          validateInput: (v) => (v.trim() ? undefined : "Name cannot be empty"),
        });
        if (!newName || newName === oldName) {
          return;
        }
        await renameSpec(oldName, newName.trim());
        refreshAll();
      },
    ],

    [
      "copilot-specs.openSpecPanel",
      async (specNameOrItem?: unknown) => {
        const name =
          typeof specNameOrItem === "string"
            ? specNameOrItem
            : resolveSpecName(specNameOrItem);
        if (!name) {
          // Pick from list
          const specs = await listSpecs();
          if (specs.length === 0) {
            vscode.window.showInformationMessage(
              "No specs found. Create one first.",
            );
            return;
          }
          const pick = await vscode.window.showQuickPick(
            specs.map((s) => s.name),
          );
          if (!pick) {
            return;
          }
          await SpecPanel.show(context.extensionUri, pick);
          return;
        }
        await SpecPanel.show(context.extensionUri, name);
      },
    ],

    [
      "copilot-specs.generateWithCopilot",
      async (specNameOrItem?: unknown) => {
        const name =
          typeof specNameOrItem === "string"
            ? specNameOrItem
            : resolveSpecName(specNameOrItem);
        const specArg = name ? `create ${name}` : "";
        await vscode.commands.executeCommand("workbench.action.chat.open", {
          query: `@spec ${specArg}`,
        });
      },
    ],

    [
      "copilot-specs.checkTask",
      async (taskItem?: unknown) => {
        const task = resolveTask(taskItem);
        if (!task) {
          return;
        }
        await setTaskCompleted(task.specName, task.id, true);
        refreshAll();
      },
    ],

    [
      "copilot-specs.uncheckTask",
      async (taskItem?: unknown) => {
        const task = resolveTask(taskItem);
        if (!task) {
          return;
        }
        await setTaskCompleted(task.specName, task.id, false);
        refreshAll();
      },
    ],

    [
      "copilot-specs.linkFileToTask",
      async () => {
        await linkCurrentFileToTask({ refresh: () => refreshAll() });
      },
    ],

    [
      "copilot-specs.linkExistingTaskToImplementation",
      async () => {
        await linkExistingTaskToImplementation({ refresh: () => refreshAll() });
      },
    ],

    [
      "copilot-specs.openTaskImplementations",
      async (specName?: unknown, taskId?: unknown) => {
        if (typeof specName !== "string" || typeof taskId !== "string") {
          return;
        }
        await openTaskImplementations(specName, taskId);
      },
    ],

    [
      "copilot-specs.openTaskInTasksDocument",
      async (specName?: unknown, taskId?: unknown) => {
        if (typeof specName !== "string" || typeof taskId !== "string") {
          return;
        }

        const spec = await loadSpec(specName);
        if (!spec) {
          return;
        }

        const doc = await vscode.workspace.openTextDocument(
          vscode.Uri.file(spec.tasksPath),
        );
        const editor = await vscode.window.showTextDocument(doc, {
          preview: false,
        });

        const { tasks } = await loadTasks(specName);
        const task = tasks.find((t) => t.id === taskId);
        if (!task) {
          return;
        }

        const line = Math.max(0, Math.min(task.lineIndex, doc.lineCount - 1));
        const position = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter,
        );
      },
    ],

    [
      "copilot-specs.openRequirementTasks",
      async (specName?: unknown, requirementId?: unknown) => {
        if (typeof specName !== "string" || typeof requirementId !== "string") {
          return;
        }
        await openRequirementTasks(specName, requirementId);
      },
    ],

    [
      "copilot-specs.openTaskRequirements",
      async (specName?: unknown, taskId?: unknown) => {
        if (typeof specName !== "string" || typeof taskId !== "string") {
          return;
        }
        await openTaskRequirements(specName, taskId);
      },
    ],

    [
      "copilot-specs.openTaskReferencedFiles",
      async (specName?: unknown, taskId?: unknown) => {
        if (typeof specName !== "string" || typeof taskId !== "string") {
          return;
        }
        await openTaskReferencedFiles(specName, taskId);
      },
    ],

    [
      "copilot-specs.showRequirementTaskMap",
      async (specNameOrItem?: unknown) => {
        let name = resolveSpecName(specNameOrItem);
        if (!name) {
          name = resolveSpecNameFromActiveEditor();
        }
        if (!name) {
          const specs = await listSpecs();
          if (specs.length === 0) {
            vscode.window.showInformationMessage(
              "No specs found. Create a spec first.",
            );
            return;
          }
          const pick = await vscode.window.showQuickPick(
            specs.map((spec) => ({ label: spec.name })),
            { placeHolder: "Select a spec to debug" },
          );
          if (!pick) {
            return;
          }
          name = pick.label;
        }
        await showRequirementTaskMap(name);
      },
    ],

    [
      "copilot-specs.newSteering",
      async () => {
        await promptNewSteering();
        steeringProvider.refresh();
      },
    ],

    [
      "copilot-specs.editSteering",
      async () => {
        await openSteeringFile();
      },
    ],

    [
      "copilot-specs.newHook",
      async () => {
        await createHook(extensionPath);
        hooksProvider.refresh();
      },
    ],

    [
      "copilot-specs.runHook",
      async (hookItem?: unknown) => {
        if (
          hookItem &&
          typeof (hookItem as { hookName?: string }).hookName === "string"
        ) {
          const hookName = (hookItem as { hookName: string }).hookName;
          const hooks = await listHooks();
          const hook = hooks.find((h) => h.name === hookName);
          if (hook) {
            await runHook(hook);
          }
        } else {
          const hooks = await listHooks();
          if (hooks.length === 0) {
            vscode.window.showInformationMessage(
              'No hooks found. Create one with "Copilot Specs: New Agent Hook".',
            );
            return;
          }
          const pick = await vscode.window.showQuickPick(
            hooks.map((h) => ({
              label: h.name,
              description: h.event,
              hook: h,
            })),
          );
          if (pick) {
            await runHook(pick.hook);
          }
        }
      },
    ],

    [
      "copilot-specs.autopilot",
      async (specNameOrItem?: unknown) => {
        const name =
          typeof specNameOrItem === "string"
            ? specNameOrItem
            : resolveSpecName(specNameOrItem);
        if (name) {
          const spec = await loadSpec(name);
          if (!spec) {
            return;
          }
          const { tasks } = await loadTasks(name);
          const pending = tasks.filter((t) => !t.completed);
          if (pending.length === 0) {
            vscode.window.showInformationMessage(
              `All tasks in "${name}" are complete! 🎉`,
            );
            return;
          }
        }
        await runAutopilot();
        refreshAll();
      },
    ],

    [
      "copilot-specs.openMcpConfig",
      async () => {
        const targets = await listMcpConfigTargets();
        if (targets.length === 0) {
          vscode.window.showInformationMessage("No MCP config targets found.");
          return;
        }

        const pick = await vscode.window.showQuickPick(
          targets.map((target) => ({
            label: target.label,
            description: target.exists ? "exists" : "not found",
            detail: target.filePath,
            target,
          })),
          { placeHolder: "Select MCP config to open" },
        );

        if (!pick) {
          return;
        }

        const uri = vscode.Uri.file(pick.target.filePath);
        if (!pick.target.exists) {
          const create = await vscode.window.showInformationMessage(
            `Create ${pick.target.label}?`,
            "Create",
            "Cancel",
          );
          if (create !== "Create") {
            return;
          }

          await vscode.workspace.fs.createDirectory(
            vscode.Uri.file(path.dirname(uri.fsPath)),
          );
          const initial = Buffer.from('{\n  "mcpServers": {}\n}\n', "utf8");
          await vscode.workspace.fs.writeFile(uri, initial);
          mcpServersProvider.refresh();
        }

        await vscode.commands.executeCommand("vscode.open", uri);
      },
    ],

    [
      "copilot-specs.focusMcpPane",
      async () => {
        try {
          await vscode.commands.executeCommand(
            "workbench.view.extension.copilot-specs-mcp-container",
          );
        } catch {
          await vscode.commands.executeCommand("workbench.action.focusPanel");
        }
      },
    ],

    [
      "copilot-specs.toggleMcpServer",
      async (mcpItem?: unknown) => {
        const server = resolveMcpServer(mcpItem);
        if (!server) {
          return;
        }

        const nextEnabled = !server.enabled;
        try {
          const changed = await setMcpServerEnabled(
            server.filePath,
            server.name,
            nextEnabled,
          );
          if (!changed) {
            vscode.window.showWarningMessage(
              `MCP server "${server.name}" was not found in ${server.filePath}.`,
            );
            return;
          }

          mcpServersProvider.refresh();
        } catch (err) {
          vscode.window.showErrorMessage(
            `Failed to update MCP server "${server.name}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    ],

    [
      "copilot-specs.refreshExplorer",
      () => {
        refreshAll();
        steeringProvider.refresh();
        hooksProvider.refresh();
        mcpServersProvider.refresh();
      },
    ],
  ];

  for (const [command, handler] of cmds) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, handler),
    );
  }

  // ── Disposables ──────────────────────────────────────────────────────────────

  context.subscriptions.push(specExplorer, statusBar);
}

export function deactivate(): void {
  // Nothing to clean up beyond subscriptions
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveSpecName(item: unknown): string | undefined {
  if (!item) {
    return undefined;
  }
  // From TreeView SpecItem
  if (typeof (item as { spec?: { name?: string } }).spec?.name === "string") {
    return (item as { spec: { name: string } }).spec.name;
  }
  // From TreeView SpecFileItem
  if (typeof (item as { specName?: string }).specName === "string") {
    return (item as { specName: string }).specName;
  }
  // Direct string
  if (typeof item === "string") {
    return item;
  }
  return undefined;
}

function resolveSpecNameFromActiveEditor(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }
  const normalized = editor.document.uri.fsPath.replace(/\\/g, "/");
  const match = normalized.match(/\/\.github\/instructions\/specs\/([^/]+)\//i);
  return match?.[1];
}

function resolveTask(item: unknown): Task | undefined {
  if (!item) {
    return undefined;
  }
  if (
    typeof (item as Task).id === "string" &&
    typeof (item as Task).specName === "string"
  ) {
    return item as Task;
  }
  // From TaskItem tree node
  if (typeof (item as TaskItem).task?.id === "string") {
    return (item as TaskItem).task;
  }
  return undefined;
}

function resolveMcpServer(
  item: unknown,
): { name: string; enabled: boolean; filePath: string } | undefined {
  if (!item) {
    return undefined;
  }

  if (
    typeof (item as { name?: unknown }).name === "string" &&
    typeof (item as { enabled?: unknown }).enabled === "boolean" &&
    typeof (item as { filePath?: unknown }).filePath === "string"
  ) {
    return {
      name: (item as { name: string }).name,
      enabled: (item as { enabled: boolean }).enabled,
      filePath: (item as { filePath: string }).filePath,
    };
  }

  if (
    typeof (item as MCPServerItem).name === "string" &&
    typeof (item as MCPServerItem).enabled === "boolean" &&
    typeof (item as MCPServerItem).filePath === "string"
  ) {
    return {
      name: (item as MCPServerItem).name,
      enabled: (item as MCPServerItem).enabled,
      filePath: (item as MCPServerItem).filePath,
    };
  }

  return undefined;
}

function shouldScheduleAutoLink(uri: vscode.Uri): boolean {
  if (uri.scheme !== "file") {
    return false;
  }

  const normalized = uri.fsPath.replace(/\\/g, "/").toLowerCase();
  if (normalized.endsWith("/implementation-tasks.instructions.md")) {
    return true;
  }

  if (
    normalized.includes("/.git/") ||
    normalized.includes("/node_modules/") ||
    normalized.includes("/dist/") ||
    normalized.includes("/build/") ||
    normalized.includes("/.next/") ||
    normalized.includes("/.vscode/")
  ) {
    return false;
  }

  if (normalized.includes("/.github/")) {
    return false;
  }

  const ext = path.extname(normalized);
  const implementationExts = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".go",
    ".cs",
    ".java",
    ".kt",
    ".rs",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".json",
    ".yaml",
    ".yml",
  ]);

  return implementationExts.has(ext);
}
