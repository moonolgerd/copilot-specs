export interface Spec {
  name: string;
  fileGlob: string;
  requirementsPath: string;
  designPath: string;
  tasksPath: string;
  linksPath: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  specName: string;
  lineIndex: number;
  subTasks: SubTask[];
  requirementIds?: string[];
}

export interface SubTask {
  title: string;
  completed: boolean;
  lineIndex: number;
}

export interface TaskProgress {
  total: number;
  completed: number;
}

export type HookEventName =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "PreCompact"
  | "SubagentStart"
  | "SubagentStop"
  | "Stop";

export const HOOK_EVENT_NAMES: HookEventName[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PreCompact",
  "SubagentStart",
  "SubagentStop",
  "Stop",
];

export interface HookCommand {
  type: "command";
  command: string;
  enabled?: boolean;
  windows?: string;
  linux?: string;
  osx?: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface HooksFileConfig {
  hooks: Partial<Record<HookEventName, HookCommand[]>>;
}

export interface Hook {
  name: string; // display label: "{event}: {short command}"
  filePath: string; // path to the .json file
  event: HookEventName;
  enabled: boolean;
  commandIndex: number;
  commandEntry: HookCommand;
}

export interface SteeringEntry {
  name: string;
  content: string;
}

export interface SpecLinks {
  [taskId: string]: string[];
}

export interface InstructionsFrontmatter {
  name?: string;
  applyTo?: string;
  description?: string;
}
