import { execFile } from "node:child_process";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

import { isCachePathIgnoredByGit } from "../../utils/cacheGitignore.js";

const execFileAsync = promisify(execFile);

suite("cacheGitignore", () => {
  test("detects cache path ignored by repository .gitignore", async () => {
    const repo = await createGitRepo();
    try {
      await fs.writeFile(
        path.join(repo, ".gitignore"),
        ".copilot-specs-cache/\n",
        "utf8",
      );

      assert.equal(await isCachePathIgnoredByGit(repo), true);
    } finally {
      await fs.rm(repo, { force: true, recursive: true });
    }
  });

  test("detects cache path ignored through core.excludesFile", async () => {
    const repo = await createGitRepo();
    const excludesFile = path.join(repo, "global-ignore");
    try {
      await fs.writeFile(excludesFile, ".copilot-specs-cache/\n", "utf8");
      await execFileAsync(
        "git",
        ["config", "core.excludesFile", excludesFile],
        { cwd: repo },
      );

      assert.equal(await isCachePathIgnoredByGit(repo), true);
    } finally {
      await fs.rm(repo, { force: true, recursive: true });
    }
  });

  test("returns false when Git does not ignore the cache path", async () => {
    const repo = await createGitRepo();
    try {
      assert.equal(await isCachePathIgnoredByGit(repo), false);
    } finally {
      await fs.rm(repo, { force: true, recursive: true });
    }
  });
});

async function createGitRepo(): Promise<string> {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "copilot-specs-test-"));
  await execFileAsync("git", ["init"], { cwd: repo });
  return repo;
}
