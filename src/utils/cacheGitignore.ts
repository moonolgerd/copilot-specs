import { execFile } from "node:child_process";
import * as vscode from "vscode";

import { ensureGitignoreEntry } from "./fileSystem.js";

export const CACHE_GITIGNORE_ENTRY = ".copilot-specs-cache/";
export const CACHE_GITIGNORE_PATH = ".copilot-specs-cache";

export type CacheGitignoreBehavior = "auto" | "prompt" | "disabled";

type RememberedCacheGitignoreChoice = "add" | "skip";

const CACHE_GITIGNORE_BEHAVIOR_SETTING = "cacheGitignoreBehavior";
const CACHE_GITIGNORE_CHOICE_KEY_PREFIX = "cacheGitignoreChoice";

export function getCacheGitignoreBehavior(): CacheGitignoreBehavior {
  const value = vscode.workspace
    .getConfiguration("copilot-specs")
    .get<string>(CACHE_GITIGNORE_BEHAVIOR_SETTING, "auto");

  return isCacheGitignoreBehavior(value) ? value : "auto";
}

export async function ensureCacheGitignoreEntries(
  context: vscode.ExtensionContext,
): Promise<void> {
  const behavior = getCacheGitignoreBehavior();
  if (behavior === "disabled") {
    return;
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    await ensureCacheGitignoreEntryForFolder(context, folder, behavior);
  }
}

async function ensureCacheGitignoreEntryForFolder(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  behavior: CacheGitignoreBehavior,
): Promise<void> {
  if (await isCachePathIgnoredByGit(folder.uri.fsPath)) {
    return;
  }

  if (behavior === "prompt") {
    const rememberedChoice = context.workspaceState.get<
      RememberedCacheGitignoreChoice
    >(getChoiceKey(folder));

    if (rememberedChoice === "skip") {
      return;
    }

    if (rememberedChoice !== "add") {
      const choice = await promptForCacheGitignoreEntry(folder);
      if (choice === "Add") {
        await context.workspaceState.update(getChoiceKey(folder), "add");
      } else if (choice === "Don't Add") {
        await context.workspaceState.update(getChoiceKey(folder), "skip");
        return;
      } else {
        return;
      }
    }
  }

  await ensureGitignoreEntry(CACHE_GITIGNORE_ENTRY, folder.uri);
}

async function promptForCacheGitignoreEntry(
  folder: vscode.WorkspaceFolder,
): Promise<string | undefined> {
  return vscode.window.showInformationMessage(
    `Add ${CACHE_GITIGNORE_ENTRY} to ${folder.name}'s .gitignore?`,
    "Add",
    "Don't Add",
  );
}

export async function isCachePathIgnoredByGit(cwd: string): Promise<boolean> {
  const pathsToCheck = [CACHE_GITIGNORE_PATH, CACHE_GITIGNORE_ENTRY];

  for (const pathToCheck of pathsToCheck) {
    if (await isPathIgnoredByGit(cwd, pathToCheck)) {
      return true;
    }
  }

  return false;
}

function isPathIgnoredByGit(cwd: string, pathToCheck: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["check-ignore", "-q", "--", pathToCheck],
      { cwd },
      (error) => {
        resolve(!error);
      },
    );
  });
}

function getChoiceKey(folder: vscode.WorkspaceFolder): string {
  return `${CACHE_GITIGNORE_CHOICE_KEY_PREFIX}:${folder.uri.toString()}`;
}

function isCacheGitignoreBehavior(
  value: string,
): value is CacheGitignoreBehavior {
  return value === "auto" || value === "prompt" || value === "disabled";
}
