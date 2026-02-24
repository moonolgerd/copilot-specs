import * as assert from "node:assert/strict";
import { parseTasks, calculateProgress } from "../../taskManager.js";

suite("taskManager", () => {
  suite("parseTasks", () => {
    test("parses a simple uncompleted task", () => {
      const { tasks } = parseTasks("- [ ] Do something", "mySpec");
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].title, "Do something");
      assert.equal(tasks[0].completed, false);
      assert.equal(tasks[0].id, "T1");
      assert.equal(tasks[0].specName, "mySpec");
    });

    test("parses a completed task", () => {
      const { tasks } = parseTasks("- [x] Done", "mySpec");
      assert.equal(tasks[0].completed, true);
    });

    test("parses capital X as completed", () => {
      const { tasks } = parseTasks("- [X] Done", "mySpec");
      assert.equal(tasks[0].completed, true);
    });

    test("extracts task ID from HTML comment", () => {
      const { tasks } = parseTasks(
        "- [ ] <!-- task:T3 --> Implement feature",
        "mySpec",
      );
      assert.equal(tasks[0].id, "T3");
      assert.equal(tasks[0].title, "Implement feature");
    });

    test("extracts task ID from bold prefix", () => {
      const { tasks } = parseTasks("- [ ] **T5**: My task", "mySpec");
      assert.equal(tasks[0].id, "T5");
    });

    test("auto-assigns sequential IDs when no explicit ID", () => {
      const content = "- [ ] First\n- [ ] Second\n- [ ] Third";
      const { tasks } = parseTasks(content, "mySpec");
      assert.equal(tasks[0].id, "T1");
      assert.equal(tasks[1].id, "T2");
      assert.equal(tasks[2].id, "T3");
    });

    test("extracts requirement IDs from requires comment", () => {
      const { tasks } = parseTasks(
        "- [ ] <!-- task:T1 --> Build UI <!-- requires:REQ-01,REQ-02 -->",
        "mySpec",
      );
      assert.deepEqual(tasks[0].requirementIds, ["REQ-01", "REQ-02"]);
      assert.equal(tasks[0].title, "Build UI");
    });

    test("parses subtasks indented under a task", () => {
      const content = "- [ ] Parent task\n  - [x] Sub done\n  - [ ] Sub todo";
      const { tasks } = parseTasks(content, "mySpec");
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].subTasks.length, 2);
      assert.equal(tasks[0].subTasks[0].completed, true);
      assert.equal(tasks[0].subTasks[1].completed, false);
    });

    test("skips YAML frontmatter block", () => {
      const content = "---\nname: test\n---\n- [ ] Task one";
      const { tasks } = parseTasks(content, "mySpec");
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].title, "Task one");
    });

    test("extracts files comment as fileGlob", () => {
      const content = "<!-- files: src/**/*.ts -->\n- [ ] Task";
      const { tasks, fileGlob } = parseTasks(content, "mySpec");
      assert.equal(fileGlob, "src/**/*.ts");
      assert.equal(tasks.length, 1);
    });

    test("returns undefined fileGlob when no files comment", () => {
      const { fileGlob } = parseTasks("- [ ] Task", "mySpec");
      assert.equal(fileGlob, undefined);
    });

    test("handles empty content", () => {
      const { tasks, fileGlob } = parseTasks("", "mySpec");
      assert.equal(tasks.length, 0);
      assert.equal(fileGlob, undefined);
    });

    test("handles multiple tasks with mixed completion", () => {
      const content = "- [ ] T1\n- [x] T2\n- [ ] T3";
      const { tasks } = parseTasks(content, "mySpec");
      assert.equal(tasks.length, 3);
      assert.equal(tasks[1].completed, true);
    });

    test("normalises CRLF line endings", () => {
      const { tasks } = parseTasks(
        "- [ ] Task one\r\n- [x] Task two\r\n",
        "mySpec",
      );
      assert.equal(tasks.length, 2);
      assert.equal(tasks[0].title, "Task one");
    });

    test("strips title whitespace", () => {
      const { tasks } = parseTasks("- [ ]   Padded title   ", "mySpec");
      assert.equal(tasks[0].title, "Padded title");
    });
  });

  suite("calculateProgress", () => {
    test("returns zero for empty task list", () => {
      const p = calculateProgress([]);
      assert.equal(p.total, 0);
      assert.equal(p.completed, 0);
    });

    test("counts completed tasks correctly", () => {
      const { tasks } = parseTasks(
        "- [x] Done\n- [ ] Pending\n- [x] Also done",
        "mySpec",
      );
      const p = calculateProgress(tasks);
      assert.equal(p.total, 3);
      assert.equal(p.completed, 2);
    });

    test("all tasks completed", () => {
      const { tasks } = parseTasks("- [x] A\n- [x] B", "mySpec");
      const p = calculateProgress(tasks);
      assert.equal(p.total, 2);
      assert.equal(p.completed, 2);
    });

    test("no tasks completed", () => {
      const { tasks } = parseTasks("- [ ] A\n- [ ] B", "mySpec");
      const p = calculateProgress(tasks);
      assert.equal(p.total, 2);
      assert.equal(p.completed, 0);
    });
  });
});
