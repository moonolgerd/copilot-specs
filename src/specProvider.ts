import * as vscode from "vscode";
import { Spec, Task } from "./models/index.js";
import { listSpecs } from "./specManager.js";
import { loadTasks, calculateProgress } from "./taskManager.js";

// ── Tree Item Types ───────────────────────────────────────────────────────────

export class SpecItem extends vscode.TreeItem {
  constructor(
    public readonly spec: Spec,
    public readonly progress: { total: number; completed: number },
  ) {
    super(spec.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "spec";
    this.iconPath = new vscode.ThemeIcon(
      progress.total === 0
        ? "file-text"
        : progress.completed === progress.total
          ? "pass-filled"
          : "circle-large-outline",
    );
    const pct =
      progress.total > 0
        ? Math.round((progress.completed / progress.total) * 100)
        : 0;
    this.description = progress.total > 0 ? `${pct}%` : "";
    this.tooltip = new vscode.MarkdownString(
      `**${spec.name}**\n\nGlob: \`${spec.fileGlob}\`\n\n${progress.completed}/${progress.total} tasks complete`,
    );
  }
}

export class SpecFileItem extends vscode.TreeItem {
  constructor(
    public readonly specName: string,
    public readonly fileType: "requirements" | "design" | "tasks",
    public readonly filePath: string,
  ) {
    const labels = {
      requirements: "Requirements",
      design: "Design",
      tasks: "Tasks",
    };
    const icons = {
      requirements: "list-ordered",
      design: "symbol-structure",
      tasks: "checklist",
    };
    super(labels[fileType], vscode.TreeItemCollapsibleState.None);
    this.contextValue = `specFile-${fileType}`;
    this.iconPath = new vscode.ThemeIcon(icons[fileType]);
    this.resourceUri = vscode.Uri.file(filePath);
    this.command = {
      command: "vscode.open",
      title: "Open File",
      arguments: [vscode.Uri.file(filePath)],
    };
  }
}

export class TaskItem extends vscode.TreeItem {
  constructor(public readonly task: Task) {
    super(task.title, vscode.TreeItemCollapsibleState.None);
    this.contextValue = task.completed ? "task-complete" : "task-incomplete";
    this.iconPath = new vscode.ThemeIcon(
      task.completed ? "pass-filled" : "circle-large-outline",
    );
    this.description = task.id;
    this.tooltip = `[${task.specName}] ${task.id}: ${task.title}`;
    this.command = {
      command: task.completed
        ? "copilot-specs.uncheckTask"
        : "copilot-specs.checkTask",
      title: "Toggle Task",
      arguments: [task],
    };
  }
}

// ── Spec Explorer (main tree) ─────────────────────────────────────────────────

export class SpecProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root: list all specs
      const specs = await listSpecs();
      const items: SpecItem[] = [];
      for (const spec of specs) {
        const { tasks } = await loadTasks(spec.name);
        const progress = calculateProgress(tasks);
        items.push(new SpecItem(spec, progress));
      }
      return items;
    }

    if (element instanceof SpecItem) {
      const spec = element.spec;
      return [
        new SpecFileItem(spec.name, "requirements", spec.requirementsPath),
        new SpecFileItem(spec.name, "design", spec.designPath),
        new SpecFileItem(spec.name, "tasks", spec.tasksPath),
      ];
    }

    return [];
  }
}

// ── Instructions, Rules & Skills Explorer ───────────────────────────────────

export class SteeringItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly filePath: string,
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "steeringEntry";
    this.iconPath = new vscode.ThemeIcon("symbol-namespace");
    this.resourceUri = vscode.Uri.file(filePath);
    this.command = {
      command: "vscode.open",
      title: "Open File",
      arguments: [vscode.Uri.file(filePath)],
    };
  }
}

export class SkillItem extends vscode.TreeItem {
  constructor(
    public readonly skillName: string,
    public readonly filePath: string,
  ) {
    super(skillName, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "skill";
    this.iconPath = new vscode.ThemeIcon("sparkle");
    this.resourceUri = vscode.Uri.file(filePath);
    this.command = {
      command: "vscode.open",
      title: "Open Skill",
      arguments: [vscode.Uri.file(filePath)],
    };
  }
}

export class RulesFileItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly filePath: string,
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "rulesFile";
    this.iconPath = new vscode.ThemeIcon("symbol-ruler");
    this.resourceUri = vscode.Uri.file(filePath);
    this.command = {
      command: "vscode.open",
      title: "Open Rules File",
      arguments: [vscode.Uri.file(filePath)],
    };
  }
}

export class SectionItem extends vscode.TreeItem {
  constructor(
    public readonly kind: "instructions" | "rules" | "skills",
    label: string,
    icon: string,
    childCount: number,
  ) {
    super(
      label,
      childCount > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None,
    );
    this.contextValue = `section-${kind}`;
    this.iconPath = new vscode.ThemeIcon(icon);
    this.description = childCount > 0 ? `${childCount}` : "";
  }
}

export class SteeringProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly getInstructions: () => Promise<
      { name: string; filePath: string }[]
    >,
    private readonly getRules: () => Promise<
      { name: string; filePath: string }[]
    >,
    private readonly getSkills: () => Promise<
      { name: string; filePath: string }[]
    >,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element instanceof SectionItem) {
      switch (element.kind) {
        case "instructions":
          return (await this.getInstructions()).map(
            (e) => new SteeringItem(e.name, e.filePath),
          );
        case "rules":
          return (await this.getRules()).map(
            (r) => new RulesFileItem(r.name, r.filePath),
          );
        case "skills":
          return (await this.getSkills()).map(
            (s) => new SkillItem(s.name, s.filePath),
          );
      }
    }
    if (element) {
      return [];
    }

    const [instructions, rules, skills] = await Promise.all([
      this.getInstructions(),
      this.getRules(),
      this.getSkills(),
    ]);

    return [
      new SectionItem(
        "instructions",
        "Instructions",
        "book",
        instructions.length,
      ),
      new SectionItem("rules", "Rules", "symbol-ruler", rules.length),
      new SectionItem("skills", "Skills", "sparkle", skills.length),
    ];
  }
}

// ── Hooks Explorer ────────────────────────────────────────────────────────────

export class HookItem extends vscode.TreeItem {
  constructor(
    public readonly hookName: string,
    public readonly filePath: string,
    public readonly enabled: boolean,
  ) {
    super(hookName, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "hook";
    this.iconPath = new vscode.ThemeIcon(enabled ? "zap" : "zap-disabled");
    this.description = enabled ? "enabled" : "disabled";
    this.resourceUri = vscode.Uri.file(filePath);
    this.command = {
      command: "vscode.open",
      title: "Edit Hook",
      arguments: [vscode.Uri.file(filePath)],
    };
  }
}

export class HooksProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly getHooks: () => Promise<
      { name: string; filePath: string; enabled: boolean }[]
    >,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      return []; // HookItems are leaf nodes
    }
    try {
      const hooks = await this.getHooks();
      if (hooks.length === 0) {
        const empty = new vscode.TreeItem("No hooks configured");
        empty.description = 'Use "+" or add a .github/hooks/*.json file';
        empty.iconPath = new vscode.ThemeIcon("info");
        return [empty];
      }
      return hooks.map((h) => new HookItem(h.name, h.filePath, h.enabled));
    } catch {
      return [];
    }
  }
}

// ── MCP Servers Explorer ─────────────────────────────────────────────────────

export class MCPSourceItem extends vscode.TreeItem {
  constructor(
    public readonly source: "workspace" | "user",
    public readonly servers: MCPServerItem[],
  ) {
    super(
      source === "workspace" ? "Workspace" : "User",
      servers.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None,
    );
    this.contextValue = "mcpSource";
    this.iconPath = new vscode.ThemeIcon(
      source === "workspace" ? "folder-library" : "account",
    );
    this.description = servers.length > 0 ? `${servers.length}` : "none";
  }
}

export class MCPServerItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly source: "workspace" | "user",
    public readonly enabled: boolean,
    public readonly filePath: string,
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = enabled ? "mcpServer-enabled" : "mcpServer-disabled";
    this.iconPath = new vscode.ThemeIcon(enabled ? "plug" : "debug-disconnect");
    this.description = enabled ? "enabled" : "disabled";
    this.tooltip = `${source} • ${filePath}`;
    this.resourceUri = vscode.Uri.file(filePath);
    this.command = {
      command: "vscode.open",
      title: "Open MCP Config",
      arguments: [vscode.Uri.file(filePath)],
    };
  }
}

export class MCPServersProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly getServers: () => Promise<
      {
        name: string;
        source: "workspace" | "user";
        enabled: boolean;
        filePath: string;
      }[]
    >,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element instanceof MCPSourceItem) {
      return element.servers;
    }
    if (element) {
      return [];
    }

    const servers = await this.getServers();
    if (servers.length === 0) {
      const empty = new vscode.TreeItem("No MCP servers found");
      empty.description =
        "Check .vscode/mcp.json, .mcp.json, mcp.json, or user mcp.json";
      empty.iconPath = new vscode.ThemeIcon("info");
      return [empty];
    }

    const workspaceServers = servers
      .filter((s) => s.source === "workspace")
      .map((s) => new MCPServerItem(s.name, s.source, s.enabled, s.filePath));

    const userServers = servers
      .filter((s) => s.source === "user")
      .map((s) => new MCPServerItem(s.name, s.source, s.enabled, s.filePath));

    return [
      new MCPSourceItem("workspace", workspaceServers),
      new MCPSourceItem("user", userServers),
    ];
  }
}
