import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { getWorkspaceRoot } from "./utils/fileSystem.js";

export interface MCPServerEntry {
  name: string;
  source: "workspace" | "user";
  enabled: boolean;
  filePath: string;
}

export interface MCPConfigTarget {
  label: string;
  source: "workspace" | "user";
  filePath: string;
  exists: boolean;
}

export async function listMcpServers(): Promise<MCPServerEntry[]> {
  const { workspaceFiles, userFiles } = getMcpConfigPaths();

  const [workspaceEntries, userEntries] = await Promise.all([
    loadFromFiles(workspaceFiles, "workspace"),
    loadFromFiles(userFiles, "user"),
  ]);

  return [...workspaceEntries, ...userEntries].sort((a, b) => {
    if (a.source !== b.source) {
      return a.source.localeCompare(b.source);
    }
    return a.name.localeCompare(b.name);
  });
}

export async function listMcpConfigTargets(): Promise<MCPConfigTarget[]> {
  const { workspaceFiles, userFiles } = getMcpConfigPaths();

  const workspaceTargets = await Promise.all(
    workspaceFiles.map(async (filePath) => ({
      label: workspaceLabel(filePath),
      source: "workspace" as const,
      filePath,
      exists: await filePathExists(filePath),
    })),
  );

  const userTargets = await Promise.all(
    userFiles.map(async (filePath) => ({
      label: userLabel(filePath),
      source: "user" as const,
      filePath,
      exists: await filePathExists(filePath),
    })),
  );

  return [...workspaceTargets, ...userTargets];
}

export async function setMcpServerEnabled(
  filePath: string,
  serverName: string,
  enabled: boolean,
): Promise<boolean> {
  const parsed = await readMcpFile(filePath);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid MCP config: ${filePath}`);
  }

  const root = parsed as Record<string, unknown>;
  const serverMap = ensureServerMap(root);
  const server = asRecord(serverMap[serverName]);
  if (!server) {
    return false;
  }

  server.enabled = enabled;
  await fs.writeFile(filePath, `${JSON.stringify(root, null, 2)}\n`, "utf8");
  return true;
}

async function loadFromFiles(
  paths: string[],
  source: "workspace" | "user",
): Promise<MCPServerEntry[]> {
  const all: MCPServerEntry[] = [];

  for (const filePath of paths) {
    const parsed = await readMcpFile(filePath);
    if (!parsed) {
      continue;
    }

    const servers = extractServers(parsed);
    for (const [name, config] of servers) {
      all.push({
        name,
        source,
        enabled: config.enabled !== false,
        filePath,
      });
    }
  }

  return dedupeByNameAndSource(all);
}

async function readMcpFile(filePath: string): Promise<unknown | undefined> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return parseJsonc(raw);
  } catch {
    return undefined;
  }
}

async function filePathExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function getMcpConfigPaths(): {
  workspaceFiles: string[];
  userFiles: string[];
} {
  const workspaceRoot = getWorkspaceRoot();
  const workspaceFiles = workspaceRoot
    ? [
        path.join(workspaceRoot, ".vscode", "mcp.json"),
        path.join(workspaceRoot, ".mcp.json"),
        path.join(workspaceRoot, "mcp.json"),
      ]
    : [];

  const appData = process.env.APPDATA;
  const home = os.homedir();
  const userFiles = [
    ...(appData
      ? [
          path.join(appData, "Code", "User", "mcp.json"),
          path.join(appData, "Code - Insiders", "User", "mcp.json"),
        ]
      : []),
    path.join(home, ".config", "Code", "User", "mcp.json"),
    path.join(home, ".config", "Code - Insiders", "User", "mcp.json"),
  ];

  return { workspaceFiles, userFiles };
}

function workspaceLabel(filePath: string): string {
  if (filePath.endsWith(path.join(".vscode", "mcp.json"))) {
    return "Workspace (.vscode/mcp.json)";
  }
  if (filePath.endsWith(".mcp.json")) {
    return "Workspace (.mcp.json)";
  }
  return "Workspace (mcp.json)";
}

function userLabel(filePath: string): string {
  if (filePath.includes("Code - Insiders")) {
    return "User (Code - Insiders)";
  }
  return "User (Code)";
}

function extractServers(
  data: unknown,
): Array<[string, Record<string, unknown>]> {
  if (!data || typeof data !== "object") {
    return [];
  }

  const obj = data as Record<string, unknown>;
  const serverMap =
    asRecord(obj.mcpServers) ??
    asRecord(obj.servers) ??
    asRecord((obj.mcp as Record<string, unknown> | undefined)?.servers);

  if (!serverMap) {
    return [];
  }

  return Object.entries(serverMap)
    .filter(([, value]) => value && typeof value === "object")
    .map(([name, value]) => [name, value as Record<string, unknown>]);
}

function ensureServerMap(
  root: Record<string, unknown>,
): Record<string, unknown> {
  const existingRoot = asRecord(root.mcpServers);
  if (existingRoot) {
    return existingRoot;
  }

  const existingServers = asRecord(root.servers);
  if (existingServers) {
    return existingServers;
  }

  const mcp = asRecord(root.mcp);
  const existingMcpServers = mcp ? asRecord(mcp.servers) : undefined;
  if (existingMcpServers) {
    return existingMcpServers;
  }

  root.mcpServers = {};
  return root.mcpServers as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function parseJsonc(text: string): unknown {
  const withoutBlockComments = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(
    /(^|\s)\/\/.*$/gm,
    "$1",
  );
  const withoutTrailingCommas = withoutLineComments.replace(
    /,\s*([}\]])/g,
    "$1",
  );
  return JSON.parse(withoutTrailingCommas);
}

function dedupeByNameAndSource(entries: MCPServerEntry[]): MCPServerEntry[] {
  const map = new Map<string, MCPServerEntry>();
  for (const entry of entries) {
    const key = `${entry.source}:${entry.name}`;
    if (!map.has(key)) {
      map.set(key, entry);
    }
  }
  return [...map.values()];
}
