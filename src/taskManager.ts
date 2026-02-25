import { Task, SubTask, TaskProgress } from "./models/index.js";
import {
  readTextFile,
  writeTextFile,
  fileExists,
  tasksUri,
  resolveWorkspacePath,
  INSTRUCTIONS_SPECS_DIR,
  listDirectories,
} from "./utils/fileSystem.js";

// Regex patterns for task parsing — match any markdown checkbox line
const TASK_LINE = /^(\s*)-\s+\[(x|X| )\]\s+(.+)$/;
const SUBTASK_LINE = /^(\s{2,})-\s+\[(x|X| )\]\s+(.+)$/;
// Heading-style tasks: ### T1: Title, ### - [ ] T1: Title, or ### - [x] T1: Title
const HEADING_TASK_LINE = /^###\s+(?:-\s+\[(x|X| )\]\s+)?(.+)$/;
const FILES_COMMENT = /<!--\s*files:\s*(.+?)\s*-->/;
const TASK_ID_COMMENT = /<!--\s*task:\s*(\S+)\s*-->/;
const REQUIRES_COMMENT = /<!--\s*requires?:\s*(.+?)\s*-->/;
const BOLD_ID = /^\*\*(\S+?)\*\*[:\s]\s*/;

function normalizeRequirementId(value: string): string {
  return value
    .trim()
    .replace(/^[-*\s:]+|[-*\s:]+$/g, "")
    .toUpperCase();
}

export function extractRequirementIdsFromText(text: string): string[] {
  const matches = text.match(/\b([A-Z]+-\d+(?:\.\d+)*|R\d+)\b/gi) ?? [];
  return [...new Set(matches.map((m) => normalizeRequirementId(m)))];
}

export interface TasksParseResult {
  tasks: Task[];
  fileGlob: string | undefined;
}

export function parseTasks(
  content: string,
  specName: string,
): TasksParseResult {
  const lines = content.split("\n");
  const tasks: Task[] = [];
  let currentTask: Task | undefined;
  // Tracks the most-recently-parsed heading task so that root-level - [ ] lines
  // beneath it are collected as its subtasks rather than new top-level tasks.
  let currentHeadingTask: Task | undefined;
  let taskCounter = 0;
  let fileGlob: string | undefined;
  let inFrontmatter = false;
  let frontmatterDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, ""); // normalise Windows CRLF

    // Skip YAML frontmatter block
    if (!frontmatterDone) {
      if (i === 0 && line.trim() === "---") {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter) {
        if (line.trim() === "---") {
          inFrontmatter = false;
          frontmatterDone = true;
        }
        continue;
      }
      frontmatterDone = true; // no frontmatter present
    }

    // Extract files comment
    const filesMatch = line.match(FILES_COMMENT);
    if (filesMatch) {
      fileGlob = filesMatch[1].trim();
      continue;
    }

    const subtaskMatch = line.match(SUBTASK_LINE);
    if (subtaskMatch && currentTask) {
      const sub: SubTask = {
        title: subtaskMatch[3].trim(),
        completed: subtaskMatch[2].toLowerCase() === "x",
        lineIndex: i,
      };
      currentTask.subTasks.push(sub);
      continue;
    }

    // Heading-style parent task: ### T1: Title  /or/  ### - [ ] T1: Title
    const headingTaskMatch = line.match(HEADING_TASK_LINE);
    if (headingTaskMatch) {
      taskCounter++;
      // Group 1 = optional checkbox state ('x'/'X'/' '), Group 2 = title text
      const explicitCheckbox = headingTaskMatch[1];
      let titlePart = headingTaskMatch[2].trim();

      let id: string | undefined;
      const commentId = titlePart.match(TASK_ID_COMMENT);
      if (commentId) {
        id = commentId[1];
        titlePart = titlePart.replace(TASK_ID_COMMENT, "").trim();
      }
      const boldId = titlePart.match(BOLD_ID);
      if (!id && boldId) {
        id = boldId[1];
        titlePart = titlePart.replace(BOLD_ID, "").trim();
      }
      // Plain `T1: Title` or `T-1: Title` or `REQ-01: Title` style
      if (!id) {
        const colonId = titlePart.match(/^(\S+?):\s+/);
        if (colonId) {
          id = colonId[1];
          titlePart = titlePart.replace(/^\S+?:\s+/, "").trim();
        }
      }
      if (!id) {
        id = `T${taskCounter}`;
      }

      let requirementIds: string[] | undefined;
      const requiresMatch = titlePart.match(REQUIRES_COMMENT);
      if (requiresMatch) {
        const reqStr = requiresMatch[1].trim();
        requirementIds = reqStr
          .split(",")
          .map((r) => normalizeRequirementId(r))
          .filter((r) => r.length > 0);
        titlePart = titlePart.replace(REQUIRES_COMMENT, "").trim();
      }
      if (!requirementIds || requirementIds.length === 0) {
        const inferred = extractRequirementIdsFromText(titlePart);
        if (inferred.length > 0) {
          requirementIds = inferred;
        }
      }

      currentTask = {
        id,
        title: titlePart,
        // Use explicit checkbox value when present; otherwise derive later from subtasks.
        completed: explicitCheckbox
          ? explicitCheckbox.toLowerCase() === "x"
          : false,
        specName,
        lineIndex: i,
        subTasks: [],
        requirementIds,
      };
      tasks.push(currentTask);
      currentHeadingTask = currentTask;
      continue;
    }

    const taskMatch = line.match(TASK_LINE);
    if (taskMatch) {
      // If we are inside a heading task, treat this as its subtask regardless of indent.
      if (currentHeadingTask) {
        const sub: SubTask = {
          title: taskMatch[3].trim(),
          completed: taskMatch[2].toLowerCase() === "x",
          lineIndex: i,
        };
        currentHeadingTask.subTasks.push(sub);
        continue;
      }

      taskCounter++;
      let titlePart = taskMatch[3].trim();

      // Extract task ID from <!-- task:ID --> comment or **ID**: bold prefix
      let id: string | undefined;
      const commentId = titlePart.match(TASK_ID_COMMENT);
      if (commentId) {
        id = commentId[1];
        titlePart = titlePart.replace(TASK_ID_COMMENT, "").trim();
      }
      const boldId = titlePart.match(BOLD_ID);
      if (!id && boldId) {
        id = boldId[1];
        titlePart = titlePart.replace(BOLD_ID, "").trim();
      }
      if (!id) {
        id = `T${taskCounter}`;
      }

      // Extract requirement IDs from <!-- requires:R1,R2 --> comment
      let requirementIds: string[] | undefined;
      const requiresMatch = titlePart.match(REQUIRES_COMMENT);
      if (requiresMatch) {
        const reqStr = requiresMatch[1].trim();
        requirementIds = reqStr
          .split(",")
          .map((r) => normalizeRequirementId(r))
          .filter((r) => r.length > 0);
        titlePart = titlePart.replace(REQUIRES_COMMENT, "").trim();
      }

      if (!requirementIds || requirementIds.length === 0) {
        const inferred = extractRequirementIdsFromText(titlePart);
        if (inferred.length > 0) {
          requirementIds = inferred;
        }
      }

      currentTask = {
        id,
        title: titlePart,
        completed: taskMatch[2].toLowerCase() === "x",
        specName,
        lineIndex: i,
        subTasks: [],
        requirementIds,
      };
      tasks.push(currentTask);
    } else if (
      line.trim() &&
      !line.trim().startsWith("#") &&
      !line.trim().startsWith(">") &&
      !line.trim().startsWith("<!--")
    ) {
      if (!line.trim().startsWith("-") && !line.trim().startsWith("*")) {
        currentTask = undefined;
        currentHeadingTask = undefined;
      }
    }
  }

  // For heading-style tasks (### ...) without an explicit checkbox, derive
  // completed state from whether all subtasks are done.
  const HEADING_EXPLICIT_CHECKBOX = /^###\s+-\s+\[(x|X| )\]/;
  for (const task of tasks) {
    const taskLine = lines[task.lineIndex]?.trimStart() ?? "";
    if (
      taskLine.startsWith("###") &&
      !HEADING_EXPLICIT_CHECKBOX.test(taskLine) &&
      task.subTasks.length > 0
    ) {
      task.completed = task.subTasks.every((st) => st.completed);
    }
  }

  return { tasks, fileGlob };
}

export function calculateProgress(tasks: Task[]): TaskProgress {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  return { total, completed };
}

export async function loadTasks(specName: string): Promise<TasksParseResult> {
  const uri = tasksUri(specName);
  if (!uri) {
    return { tasks: [], fileGlob: undefined };
  }

  if (!(await fileExists(uri))) {
    return { tasks: [], fileGlob: undefined };
  }

  const content = await readTextFile(uri);
  return parseTasks(content, specName);
}

export async function setTaskCompleted(
  specName: string,
  taskId: string,
  completed: boolean,
): Promise<void> {
  const uri = tasksUri(specName);
  if (!uri) {
    return;
  }

  const content = await readTextFile(uri);
  const lines = content.split("\n");

  const { tasks } = parseTasks(content, specName);
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return;
  }

  const newMark = completed ? "x" : " ";
  lines[task.lineIndex] = lines[task.lineIndex].replace(
    /\[(x| )\]/,
    `[${newMark}]`,
  );

  await writeTextFile(uri, lines.join("\n"));
}

/**
 * Mark a task and ALL of its subtasks as complete (or incomplete).
 * For heading-style tasks (`### T1: Title`) the heading line is updated only
 * when it carries an explicit `- [x]` checkbox; otherwise only the subtask
 * lines are toggled. For regular checkbox tasks the parent line is always
 * toggled together with every subtask.
 */
export async function markTaskAndSubtasksCompleted(
  specName: string,
  taskId: string,
  completed: boolean,
): Promise<void> {
  const uri = tasksUri(specName);
  if (!uri) {
    return;
  }

  const content = await readTextFile(uri);
  const lines = content.split("\n");
  const { tasks } = parseTasks(content, specName);
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return;
  }

  const newMark = completed ? "x" : " ";
  const HEADING_EXPLICIT = /^###\s+-\s+\[(x| )\]/;

  // Update the parent line — always for checkbox tasks; only when the heading
  // carries an explicit checkbox for heading-style tasks.
  const parentLine = lines[task.lineIndex] ?? "";
  const isHeading = parentLine.trimStart().startsWith("###");
  if (!isHeading || HEADING_EXPLICIT.test(parentLine.trimStart())) {
    lines[task.lineIndex] = parentLine.replace(/\[(x| )\]/, `[${newMark}]`);
  }

  // Update every subtask line.
  for (const sub of task.subTasks) {
    if (sub.lineIndex >= 0 && sub.lineIndex < lines.length) {
      lines[sub.lineIndex] = lines[sub.lineIndex].replace(
        /\[(x| )\]/,
        `[${newMark}]`,
      );
    }
  }

  await writeTextFile(uri, lines.join("\n"));
}

/**
 * Apply a pre-built set of completed task IDs to the given tasks file content.
 * Lines whose task ID is in `completedIds` will have their checkbox changed to `[x]`.
 */
export function applyCompletedIds(
  newContent: string,
  completedIds: Set<string>,
  specName: string,
): string {
  if (completedIds.size === 0) {
    return newContent;
  }

  const { tasks: newTasks } = parseTasks(newContent, specName);
  const lines = newContent.split("\n");

  for (const task of newTasks) {
    if (completedIds.has(task.id) && !task.completed) {
      lines[task.lineIndex] = lines[task.lineIndex].replace(/\[(x| )\]/, "[x]");
    }
  }

  return lines.join("\n");
}

/**
 * Given the content of a newly generated tasks file, apply the completion
 * state from the *existing* tasks file on disk so that already-completed
 * tasks are not reset.  Matching is done by task ID (T1, T2, …).
 */
export async function preserveCompletedTaskStates(
  specName: string,
  newContent: string,
): Promise<string> {
  const { tasks: existingTasks } = await loadTasks(specName);
  const completedIds = new Set(
    existingTasks.filter((t) => t.completed).map((t) => t.id),
  );

  return applyCompletedIds(newContent, completedIds, specName);
}

export async function getAllSpecNames(): Promise<string[]> {
  const root = resolveWorkspacePath(INSTRUCTIONS_SPECS_DIR);
  if (!root) {
    return [];
  }

  try {
    return await listDirectories(root);
  } catch {
    return [];
  }
}

export async function loadAllTasks(): Promise<Map<string, TasksParseResult>> {
  const specNames = await getAllSpecNames();
  const result = new Map<string, TasksParseResult>();

  for (const name of specNames) {
    result.set(name, await loadTasks(name));
  }

  return result;
}

export interface TaskValidationIssue {
  /** 0-based line index */
  line: number;
  message: string;
  severity: "error" | "warning";
}

/**
 * Validates the markdown content of a spec tasks (or requirements) file and
 * returns a list of diagnostics. The caller is responsible for converting
 * these to VS Code Diagnostics.
 */
export function validateTaskMarkdown(content: string): TaskValidationIssue[] {
  const issues: TaskValidationIssue[] = [];
  const lines = content.split("\n");
  const seenIds = new Map<string, number>();
  let inFrontmatter = false;
  let frontmatterDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");

    // Skip YAML frontmatter
    if (!frontmatterDone) {
      if (i === 0 && line.trim() === "---") {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter) {
        if (line.trim() === "---") {
          inFrontmatter = false;
          frontmatterDone = true;
        }
        continue;
      }
      frontmatterDone = true;
    }

    // Detect invalid checkbox markers, e.g. - [?] or - [y]
    const checkboxCandidate = line.match(/^(\s*)-\s+\[(.{1})\]/);
    if (checkboxCandidate) {
      const marker = checkboxCandidate[2];
      if (!/^(x|X| )$/.test(marker)) {
        issues.push({
          line: i,
          message: `Invalid checkbox marker "[${marker}]" — use "[ ]" or "[x]".`,
          severity: "error",
        });
      }
    }

    // Detect duplicate task IDs from <!-- task:ID --> comments
    const idMatch = line.match(TASK_ID_COMMENT);
    if (idMatch) {
      const id = idMatch[1];
      if (seenIds.has(id)) {
        issues.push({
          line: i,
          message: `Duplicate task ID "${id}" — first defined on line ${(seenIds.get(id) ?? 0) + 1}.`,
          severity: "error",
        });
      } else {
        seenIds.set(id, i);
      }
    }

    // Detect a requires-style HTML comment that has a space before the colon,
    // which prevents the parser from recognising it (e.g. <!-- requires : REQ-01 -->)
    const badRequires = line.match(/<!--\s*requires?\s+:\s*(.+?)\s*-->/);
    if (badRequires) {
      issues.push({
        line: i,
        message: `Malformed requires comment — remove the space before ":": use <!-- requires:${badRequires[1].trim()} -->.`,
        severity: "warning",
      });
    }

    // Detect unclosed HTML comments (<!-- without -->)
    const openCount = (line.match(/<!--/g) ?? []).length;
    const closeCount = (line.match(/-->/g) ?? []).length;
    if (openCount > closeCount) {
      issues.push({
        line: i,
        message: 'Unclosed HTML comment — missing "-->".',
        severity: "error",
      });
    }
  }

  return issues;
}
