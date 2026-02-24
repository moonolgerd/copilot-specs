import * as vscode from "vscode";

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function getWorkspaceUri(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

export function resolveWorkspacePath(
  ...segments: string[]
): vscode.Uri | undefined {
  const root = getWorkspaceUri();
  if (!root) {
    return undefined;
  }
  return vscode.Uri.joinPath(root, ...segments);
}

export async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function readTextFile(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString("utf8");
}

export async function writeTextFile(
  uri: vscode.Uri,
  content: string,
): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
}

export async function ensureDir(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.createDirectory(uri);
  } catch {
    // Directory may already exist — ignore
  }
}

export async function listDirectories(uri: vscode.Uri): Promise<string[]> {
  try {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return entries
      .filter(([, type]) => type === vscode.FileType.Directory)
      .map(([name]) => name);
  } catch {
    return [];
  }
}

export async function listFiles(
  uri: vscode.Uri,
  extension?: string,
): Promise<string[]> {
  try {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return entries
      .filter(
        ([name, type]) =>
          type === vscode.FileType.File &&
          (!extension || name.endsWith(extension)),
      )
      .map(([name]) => name);
  } catch {
    return [];
  }
}

export async function deleteRecursive(uri: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
}

export async function renameUri(
  from: vscode.Uri,
  to: vscode.Uri,
): Promise<void> {
  await vscode.workspace.fs.rename(from, to, { overwrite: false });
}

// Spec-specific path helpers — use forward slashes so these work as glob patterns on all platforms
export const GITHUB_DIR = ".github";
export const INSTRUCTIONS_DIR = ".github/instructions";
export const INSTRUCTIONS_SPECS_DIR = ".github/instructions/specs";
export const SKILLS_DIR = ".github/skills";
export const HOOKS_DIR = ".github/hooks";
export const PROMPTS_SPECS_DIR = ".github/prompts/specs";
export const COPILOT_INSTRUCTIONS_FILE = ".github/copilot-instructions.md";

/**
 * List all skill files under .github/skills/.
 */
export async function listSkillFiles(): Promise<
  { name: string; uri: vscode.Uri }[]
> {
  const dir = resolveWorkspacePath(SKILLS_DIR);
  if (!dir || !(await fileExists(dir))) {
    return [];
  }

  const skillsByPath = new Map<string, { name: string; uri: vscode.Uri }>();

  // 1) Standard Copilot skill layout: .github/skills/<skill-name>/SKILL.md
  const nestedSkillFiles = await vscode.workspace.findFiles(
    `${SKILLS_DIR}/**/SKILL.md`,
  );
  for (const uri of nestedSkillFiles) {
    const parts = uri.path.split("/");
    const skillDir = parts.length >= 2 ? parts[parts.length - 2] : "skill";
    skillsByPath.set(uri.toString(), { name: skillDir, uri });
  }

  // 2) Fallback: top-level markdown skills in .github/skills/*.md
  const entries = await vscode.workspace.fs.readDirectory(dir);
  for (const [name, type] of entries) {
    if (type === vscode.FileType.File && name.endsWith(".md")) {
      const uri = vscode.Uri.joinPath(dir, name);
      skillsByPath.set(uri.toString(), {
        name: name.replace(/\.md$/, ""),
        uri,
      });
    }
  }

  return [...skillsByPath.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function specsInstructionsUri(specName: string): vscode.Uri | undefined {
  return resolveWorkspacePath(INSTRUCTIONS_SPECS_DIR, specName);
}

export function requirementsUri(specName: string): vscode.Uri | undefined {
  return resolveWorkspacePath(
    INSTRUCTIONS_SPECS_DIR,
    specName,
    "requirements.instructions.md",
  );
}

export function designUri(specName: string): vscode.Uri | undefined {
  return resolveWorkspacePath(
    INSTRUCTIONS_SPECS_DIR,
    specName,
    "design.instructions.md",
  );
}

export function tasksUri(specName: string): vscode.Uri | undefined {
  return resolveWorkspacePath(
    INSTRUCTIONS_SPECS_DIR,
    specName,
    "implementation-tasks.instructions.md",
  );
}

export function linksUri(specName: string): vscode.Uri | undefined {
  return resolveWorkspacePath(".copilot-specs-cache", `${specName}.links.json`);
}

export function copilotInstructionsUri(): vscode.Uri | undefined {
  return resolveWorkspacePath(COPILOT_INSTRUCTIONS_FILE);
}

export function hookFileUri(hookName: string): vscode.Uri | undefined {
  return resolveWorkspacePath(HOOKS_DIR, `${hookName}.json`);
}
