import * as vscode from "vscode";
import {
  readTextFile,
  writeTextFile,
  fileExists,
  ensureDir,
  copilotInstructionsUri,
  resolveWorkspacePath,
} from "./utils/fileSystem.js";

const STEERING_START = "<!-- copilot-specs:steering:start -->";
const STEERING_END = "<!-- copilot-specs:steering:end -->";

export interface SteeringData {
  name: string;
  filePath: string;
  content: string;
}

export async function readAllSteering(): Promise<SteeringData[]> {
  const uri = copilotInstructionsUri();
  if (!uri || !(await fileExists(uri))) {
    return [];
  }

  const content = await readTextFile(uri);
  const startIdx = content.indexOf(STEERING_START);
  const endIdx = content.indexOf(STEERING_END);

  if (startIdx === -1 || endIdx === -1) {
    return [];
  }

  const managed = content
    .slice(startIdx + STEERING_START.length, endIdx)
    .trim();
  const entries: SteeringData[] = [];

  // Parse named sections: ## name\n...(until next ## or end)
  const sectionRegex = /^## (.+?)$([\s\S]*?)(?=^## |\s*$)/gm;
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(managed)) !== null) {
    entries.push({
      name: match[1].trim(),
      filePath: uri.fsPath,
      content: match[2].trim(),
    });
  }

  return entries;
}

export async function appendSteeringEntry(
  name: string,
  content: string,
): Promise<void> {
  const uri = copilotInstructionsUri();
  if (!uri) {
    throw new Error("No workspace folder open");
  }

  // Ensure .github dir exists
  const githubDir = resolveWorkspacePath(".github");
  if (githubDir) {
    await ensureDir(githubDir);
  }

  let fileContent = "";
  if (await fileExists(uri)) {
    fileContent = await readTextFile(uri);
  }

  const newEntry = `\n## ${name}\n\n${content}\n`;

  if (fileContent.includes(STEERING_START)) {
    // Insert before end marker
    fileContent = fileContent.replace(
      STEERING_END,
      `${newEntry}${STEERING_END}`,
    );
  } else {
    // Append managed section to end of file
    fileContent += `\n\n${STEERING_START}\n${newEntry}\n${STEERING_END}\n`;
  }

  await writeTextFile(uri, fileContent);
}

export async function readSteeringForContext(): Promise<string> {
  const uri = copilotInstructionsUri();
  if (!uri || !(await fileExists(uri))) {
    return "";
  }
  return readTextFile(uri);
}

export async function promptNewSteering(): Promise<void> {
  const kind = await vscode.window.showQuickPick(
    [
      {
        label: "$(symbol-ruler) Rules file",
        description: "New .instructions.md file in .github/instructions/",
        value: "rules" as const,
      },
      {
        label: "$(sparkle) Skill",
        description: "New SKILL.md entry in .github/skills/",
        value: "skill" as const,
      },
    ],
    { placeHolder: "What do you want to add?" },
  );
  if (!kind) {
    return;
  }

  const name = await vscode.window.showInputBox({
    prompt:
      kind.value === "rules"
        ? "Rules file name (without extension)"
        : "Skill name",
    placeHolder:
      kind.value === "rules"
        ? 'e.g., "testing", "deployment"'
        : 'e.g., "test-runner", "linter"',
  });
  if (!name?.trim()) {
    return;
  }

  const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
  const workspaceUri = resolveWorkspacePath(".");
  if (!workspaceUri) {
    vscode.window.showWarningMessage("No workspace folder open.");
    return;
  }

  if (kind.value === "rules") {
    const dir = resolveWorkspacePath(".github/instructions");
    if (dir) {
      await ensureDir(dir);
    }
    const uri = resolveWorkspacePath(
      `.github/instructions/${slug}.instructions.md`,
    );
    if (!uri) {
      return;
    }
    if (await fileExists(uri)) {
      vscode.window.showWarningMessage(
        `Rules file "${slug}.instructions.md" already exists.`,
      );
    } else {
      await writeTextFile(
        uri,
        `---\napplyTo: "**"\n---\n\n# ${name.trim()}\n\n> Add your instructions here.\n`,
      );
    }
    await vscode.commands.executeCommand("vscode.open", uri);
  } else {
    const dir = resolveWorkspacePath(`.github/skills/${slug}`);
    if (dir) {
      await ensureDir(dir);
    }
    const uri = resolveWorkspacePath(`.github/skills/${slug}/SKILL.md`);
    if (!uri) {
      return;
    }
    if (await fileExists(uri)) {
      vscode.window.showWarningMessage(`Skill "${slug}" already exists.`);
    } else {
      await writeTextFile(
        uri,
        `# ${name.trim()}\n\n> Describe what this skill does and when Copilot should use it.\n`,
      );
    }
    await vscode.commands.executeCommand("vscode.open", uri);
  }
}

export async function openSteeringFile(): Promise<void> {
  const uri = copilotInstructionsUri();
  if (!uri) {
    vscode.window.showWarningMessage("No workspace folder open.");
    return;
  }
  if (!(await fileExists(uri))) {
    await writeTextFile(
      uri,
      `# Copilot Instructions\n\n${STEERING_START}\n\n${STEERING_END}\n`,
    );
  }
  await vscode.commands.executeCommand("vscode.open", uri);
}
