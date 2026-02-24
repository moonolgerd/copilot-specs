import * as vscode from "vscode";
import { marked } from "marked";
import { Spec } from "../models/index.js";
import { loadSpec } from "../specManager.js";
import { readTextFile, fileExists } from "../utils/fileSystem.js";
import { stripFrontmatter } from "../utils/frontmatter.js";
import { loadTasks, calculateProgress } from "../taskManager.js";

const VIEW_TYPE = "copilot-specs.panel";

interface PanelState {
  specName: string;
  activeTab: "requirements" | "design" | "tasks";
}

export class SpecPanel {
  private static instance: SpecPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private state: PanelState;
  private watchers: vscode.FileSystemWatcher[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    _extensionUri: vscode.Uri,
    specName: string,
  ) {
    this.panel = panel;
    this.state = { specName, activeTab: "requirements" };

    this.panel.onDidDispose(() => {
      this.dispose();
    });

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.command) {
        case "switchTab":
          this.state.activeTab = msg.tab;
          await this.refresh();
          break;
        case "openFile":
          await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(msg.path),
          );
          break;
        case "checkTask":
          await vscode.commands.executeCommand("copilot-specs.checkTask", {
            id: msg.taskId,
            specName: this.state.specName,
            completed: false,
          });
          await this.refresh();
          break;
        case "uncheckTask":
          await vscode.commands.executeCommand("copilot-specs.uncheckTask", {
            id: msg.taskId,
            specName: this.state.specName,
            completed: true,
          });
          await this.refresh();
          break;
        case "generateWithCopilot":
          await vscode.commands.executeCommand(
            "copilot-specs.generateWithCopilot",
            this.state.specName,
          );
          break;
      }
    });
  }

  static async show(extensionUri: vscode.Uri, specName: string): Promise<void> {
    if (SpecPanel.instance) {
      SpecPanel.instance.state.specName = specName;
      SpecPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      await SpecPanel.instance.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      `Spec: ${specName}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true,
      },
    );

    SpecPanel.instance = new SpecPanel(panel, extensionUri, specName);
    await SpecPanel.instance.refresh();
  }

  async refresh(): Promise<void> {
    const spec = await loadSpec(this.state.specName);
    if (!spec) {
      this.panel.webview.html = this.errorHtml(
        `Spec "${this.state.specName}" not found.`,
      );
      return;
    }

    const [reqContent, designContent, tasksContent] = await Promise.all([
      this.readSpecFile(spec.requirementsPath),
      this.readSpecFile(spec.designPath),
      this.readSpecFile(spec.tasksPath),
    ]);

    const { tasks } = await loadTasks(this.state.specName);
    const progress = calculateProgress(tasks);

    this.panel.title = `Spec: ${spec.name}`;
    this.panel.webview.html = this.getHtml(
      spec,
      reqContent,
      designContent,
      tasksContent,
      progress,
    );
  }

  private async readSpecFile(filePath: string): Promise<string> {
    try {
      const uri = vscode.Uri.file(filePath);
      if (await fileExists(uri)) {
        const raw = await readTextFile(uri);
        const md = stripFrontmatter(raw);
        return await marked.parse(md);
      }
    } catch {
      // ignore
    }
    return "<em>File not found.</em>";
  }

  private getHtml(
    spec: Spec,
    reqContent: string,
    designContent: string,
    tasksContent: string,
    progress: { total: number; completed: number },
  ): string {
    const pct =
      progress.total > 0
        ? Math.round((progress.completed / progress.total) * 100)
        : 0;

    const tabs: Array<{
      id: string;
      label: string;
      content: string;
      icon: string;
    }> = [
      {
        id: "requirements",
        label: "Requirements",
        content: reqContent,
        icon: "📋",
      },
      { id: "design", label: "Design", content: designContent, icon: "🏗️" },
      {
        id: "tasks",
        label: `Tasks (${progress.completed}/${progress.total})`,
        content: tasksContent,
        icon: "✅",
      },
    ];

    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
    style-src 'unsafe-inline';
    script-src 'nonce-${nonce}';
    img-src data: https:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spec: ${escapeHtml(spec.name)}</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-panel-border);
      --tab-active-bg: var(--vscode-tab-activeBackground);
      --tab-inactive-bg: var(--vscode-tab-inactiveBackground);
      --tab-active-fg: var(--vscode-tab-activeForeground);
      --tab-inactive-fg: var(--vscode-tab-inactiveForeground);
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --font: var(--vscode-font-family);
      --code-font: var(--vscode-editor-font-family, monospace);
      --progress-fill: var(--vscode-progressBar-background);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--fg); font-family: var(--font); font-size: 13px; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
    header h1 { font-size: 14px; font-weight: 600; }
    header .meta { font-size: 11px; opacity: 0.7; }
    .progress-bar-wrap { height: 3px; background: var(--border); }
    .progress-bar-fill { height: 3px; background: var(--progress-fill); transition: width 0.3s; }
    .tabs { display: flex; border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .tab { padding: 8px 16px; cursor: pointer; font-size: 12px; color: var(--tab-inactive-fg); background: var(--tab-inactive-bg); border: none; outline: none; white-space: nowrap; }
    .tab:hover { background: var(--tab-active-bg); }
    .tab.active { color: var(--tab-active-fg); background: var(--tab-active-bg); border-bottom: 2px solid var(--progress-fill); }
    .content { flex: 1; overflow-y: auto; padding: 20px 24px; }
    .content h1 { font-size: 1.4em; margin-bottom: 12px; }
    .content h2 { font-size: 1.1em; margin: 20px 0 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
    .content h3 { font-size: 1em; margin: 16px 0 6px; }
    .content p { margin-bottom: 10px; line-height: 1.6; }
    .content ul, .content ol { margin: 8px 0 8px 24px; }
    .content li { margin-bottom: 4px; line-height: 1.5; }
    .content code { font-family: var(--code-font); font-size: 0.9em; background: rgba(255,255,255,0.06); padding: 1px 4px; border-radius: 3px; }
    .content pre { background: rgba(0,0,0,0.2); border-radius: 6px; padding: 12px; overflow-x: auto; margin: 10px 0; }
    .content pre code { background: none; padding: 0; }
    .content blockquote { border-left: 3px solid var(--border); padding-left: 12px; opacity: 0.8; margin: 10px 0; }
    .content table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    .content th, .content td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }
    .content th { background: rgba(255,255,255,0.05); }
    .task-item { display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; }
    .task-item input[type=checkbox] { margin-top: 3px; cursor: pointer; }
    .task-item.done span { opacity: 0.5; text-decoration: line-through; }
    .toolbar { display: flex; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--border); flex-shrink: 0; }
    button.action { background: var(--button-bg); color: var(--button-fg); border: none; padding: 5px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; }
    button.action:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(spec.name)}</h1>
      <div class="meta">Glob: <code>${escapeHtml(spec.fileGlob)}</code></div>
    </div>
    <div class="meta">${pct}% complete</div>
  </header>
  <div class="progress-bar-wrap">
    <div class="progress-bar-fill" style="width:${pct}%"></div>
  </div>
  <nav class="tabs">
    ${tabs.map((t) => `<button class="tab ${t.id === this.state.activeTab ? "active" : ""}" data-tab="${t.id}">${t.icon} ${escapeHtml(t.label)}</button>`).join("")}
  </nav>
  <div class="content" id="content"></div>
  <div class="toolbar">
    <button class="action" id="btn-open-file">Open in Editor</button>
    <button class="action" id="btn-generate">Generate with Copilot</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = {
      activeTab: ${JSON.stringify(this.state.activeTab)},
      tabs: ${JSON.stringify(tabs.map((t) => ({ id: t.id, content: t.content })))},
      filePaths: {
        requirements: ${JSON.stringify(spec.requirementsPath)},
        design: ${JSON.stringify(spec.designPath)},
        tasks: ${JSON.stringify(spec.tasksPath)},
      }
    };

    function renderContent() {
      const tab = state.tabs.find(t => t.id === state.activeTab);
      if (!tab) return;
      document.getElementById('content').innerHTML = tab.content;
    }

    function toggleTask(checkbox) {
      const taskId = checkbox.dataset.task;
      if (!taskId) return;
      vscode.postMessage({ command: checkbox.checked ? 'checkTask' : 'uncheckTask', taskId });
    }

    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeTab = btn.dataset.tab;
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        vscode.postMessage({ command: 'switchTab', tab: state.activeTab });
        renderContent();
      });
    });

    document.getElementById('btn-open-file').addEventListener('click', () => {
      vscode.postMessage({ command: 'openFile', path: state.filePaths[state.activeTab] });
    });

    document.getElementById('btn-generate').addEventListener('click', () => {
      vscode.postMessage({ command: 'generateWithCopilot' });
    });

    renderContent();
  </script>
</body>
</html>`;
  }

  private errorHtml(message: string): string {
    return `<!DOCTYPE html><html><body style="color:var(--vscode-editor-foreground);padding:20px;font-family:var(--vscode-font-family)"><p>${escapeHtml(message)}</p></body></html>`;
  }

  private dispose(): void {
    for (const w of this.watchers) {
      w.dispose();
    }
    SpecPanel.instance = undefined;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
