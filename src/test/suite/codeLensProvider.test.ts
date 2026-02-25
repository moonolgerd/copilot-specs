import * as assert from "node:assert/strict";
import { matchGlobPattern } from "../../codeLensProvider.js";

suite("codeLensProvider", () => {
  suite("matchGlobPattern (glob matching edge cases)", () => {
    test("exact file name match", () => {
      assert.equal(matchGlobPattern("src/foo.ts", "src/foo.ts"), true);
    });

    test("* matches any segment but not path separator", () => {
      assert.equal(matchGlobPattern("src/foo.ts", "src/*.ts"), true);
      assert.equal(matchGlobPattern("src/sub/foo.ts", "src/*.ts"), false);
    });

    test("** matches across directories", () => {
      assert.equal(matchGlobPattern("src/sub/foo.ts", "src/**/*.ts"), true);
      assert.equal(matchGlobPattern("src/a/b/c/foo.ts", "src/**/*.ts"), true);
    });

    test("** at root matches any path", () => {
      assert.equal(matchGlobPattern("anything/deep/file.py", "**/*.py"), true);
    });

    test("extension filter is respected", () => {
      assert.equal(matchGlobPattern("src/foo.js", "src/**/*.ts"), false);
      // src/**/*.ts requires a subdirectory level — direct children don't match
      assert.equal(matchGlobPattern("src/foo.ts", "src/**/*.ts"), false);
      // a file one level deeper does match
      assert.equal(matchGlobPattern("src/sub/foo.ts", "src/**/*.ts"), true);
    });

    test("no match when pattern is entirely different", () => {
      assert.equal(matchGlobPattern("lib/bar.ts", "src/**/*.ts"), false);
    });

    test("? matches a single non-slash character", () => {
      assert.equal(matchGlobPattern("src/a.ts", "src/?.ts"), true);
      assert.equal(matchGlobPattern("src/ab.ts", "src/?.ts"), false);
    });

    test("dots in pattern are treated as literals", () => {
      assert.equal(matchGlobPattern("src/foo.ts", "src/foo.ts"), true);
      // A dot in the glob should NOT match an 'x' character
      assert.equal(matchGlobPattern("src/fooxts", "src/foo.ts"), false);
    });

    test("**/* matches files one or more levels deep", () => {
      assert.equal(matchGlobPattern("src/a/b/c.ts", "**/*"), true);
      // **/* requires at least one slash so a bare filename does NOT match
      assert.equal(matchGlobPattern("README.md", "**/*"), false);
      // but a file inside a directory does match
      assert.equal(matchGlobPattern("src/README.md", "**/*"), true);
    });

    test("empty string does not match a non-empty pattern", () => {
      assert.equal(matchGlobPattern("", "src/**/*.ts"), false);
    });
  });
});
