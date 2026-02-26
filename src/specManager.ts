import * as vscode from "vscode";
import { Spec } from "./models/index.js";
import {
  readTextFile,
  writeTextFile,
  ensureDir,
  listDirectories,
  deleteRecursive,
  renameUri,
  fileExists,
  requirementsUri,
  designUri,
  tasksUri,
  linksUri,
  specsInstructionsUri,
  resolveWorkspacePath,
  INSTRUCTIONS_SPECS_DIR,
} from "./utils/fileSystem.js";
import { parseFrontmatter } from "./utils/frontmatter.js";
import { InstructionsFrontmatter } from "./models/index.js";

import { readFileSync } from "fs";
import { join } from "path";

let _templateDir: string | undefined;

function readTemplate(filename: string): string {
  if (!_templateDir) {
    return "";
  }
  try {
    return readFileSync(join(_templateDir, filename), "utf8");
  } catch {
    return "";
  }
}

export function initTemplates(extensionPath: string): void {
  _templateDir = join(extensionPath, "src", "templates");
}

function applyTemplateVars(
  template: string,
  vars: Record<string, string>,
): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  );
}

export async function listSpecs(): Promise<Spec[]> {
  const instructionsRoot = resolveWorkspacePath(INSTRUCTIONS_SPECS_DIR);
  if (!instructionsRoot) {
    return [];
  }

  const specNames = await listDirectories(instructionsRoot);
  const specs: Spec[] = [];

  for (const name of specNames) {
    const spec = await loadSpec(name);
    if (spec) {
      specs.push(spec);
    }
  }

  return specs;
}

export async function loadSpec(name: string): Promise<Spec | undefined> {
  const reqUri = requirementsUri(name);
  const designUriVal = designUri(name);
  const tasksUriVal = tasksUri(name);
  const linksUriVal = linksUri(name);

  if (!reqUri || !designUriVal || !tasksUriVal || !linksUriVal) {
    return undefined;
  }

  // Read applyTo glob from requirements frontmatter
  let fileGlob = "**/*";
  try {
    if (await fileExists(reqUri)) {
      const content = await readTextFile(reqUri);
      const { frontmatter } =
        parseFrontmatter<InstructionsFrontmatter>(content);
      if (frontmatter.applyTo) {
        fileGlob = frontmatter.applyTo;
      }
    }
  } catch {
    // Use default glob
  }

  return {
    name,
    fileGlob,
    requirementsPath: reqUri.fsPath,
    designPath: designUriVal.fsPath,
    tasksPath: tasksUriVal.fsPath,
    linksPath: linksUriVal.fsPath,
  };
}

export async function createSpec(
  name: string,
  fileGlob: string,
): Promise<Spec> {
  const instructionsDir = specsInstructionsUri(name);

  if (!instructionsDir) {
    throw new Error("No workspace folder open");
  }

  await ensureDir(instructionsDir);

  const reqUri = requirementsUri(name);
  const destDesignUri = designUri(name);
  const tasksUriVal = tasksUri(name);

  if (!reqUri || !destDesignUri || !tasksUriVal) {
    throw new Error("Could not resolve spec URIs");
  }

  const vars = { SPEC_NAME: name, FILE_GLOB: fileGlob };

  const reqTemplate = applyTemplateVars(
    readTemplate("requirements.template.md"),
    vars,
  );
  const designTemplate = applyTemplateVars(
    readTemplate("design.template.md"),
    vars,
  );
  const tasksTemplate = applyTemplateVars(
    readTemplate("tasks.template.md"),
    vars,
  );

  await writeTextFile(reqUri, reqTemplate);
  await writeTextFile(destDesignUri, designTemplate);
  await writeTextFile(tasksUriVal, tasksTemplate);

  const linksUriVal = linksUri(name);
  if (linksUriVal && !(await fileExists(linksUriVal))) {
    await writeTextFile(linksUriVal, "{}");
  }

  return (await loadSpec(name))!;
}

export async function deleteSpec(name: string): Promise<void> {
  const instructionsDir = specsInstructionsUri(name);

  if (instructionsDir && (await fileExists(instructionsDir))) {
    await deleteRecursive(instructionsDir);
  }
}

export async function renameSpec(
  oldName: string,
  newName: string,
): Promise<void> {
  const oldInstructionsDir = specsInstructionsUri(oldName);
  const newInstructionsDir = specsInstructionsUri(newName);

  if (oldInstructionsDir && newInstructionsDir) {
    await renameUri(oldInstructionsDir, newInstructionsDir);
  }
}

export async function promptCreateSpec(): Promise<Spec | undefined> {
  const name = await vscode.window.showInputBox({
    prompt: 'Spec name (e.g. "auth", "user-profile")',
    placeHolder: "feature-name",
    validateInput: (v) => (v.trim() ? undefined : "Name cannot be empty"),
  });
  if (!name) {
    return undefined;
  }

  const fileGlob = await vscode.window.showInputBox({
    prompt:
      "File glob pattern for this spec (Copilot will auto-attach instructions to matching files)",
    placeHolder: "src/auth/**",
    value: `src/${name.toLowerCase()}/**`,
  });
  if (fileGlob === undefined) {
    return undefined;
  }

  const spec = await createSpec(name.trim(), fileGlob.trim() || "**/*");

  return spec;
}
