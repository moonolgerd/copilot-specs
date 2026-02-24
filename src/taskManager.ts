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

function extractRequirementIdsFromText(text: string): string[] {
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

    const taskMatch = line.match(TASK_LINE);
    if (taskMatch) {
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
      }
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
