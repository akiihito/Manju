/** Worker roles in the orchestration framework */
export type WorkerRole = "investigator" | "implementer" | "tester";

/** All roles including coordinator */
export type Role = "coordinator" | WorkerRole;

/** Task status lifecycle */
export type TaskStatus = "pending" | "assigned" | "running" | "success" | "failure";

/** Worker identity */
export interface WorkerIdentity {
  role: WorkerRole;
  name: string; // e.g., "investigator-1"
}

/** Task definition written to .manju/tasks/<task-id>.json */
export interface Task {
  id: string;
  title: string;
  description: string;
  role: WorkerRole;
  assignee: string;
  status: TaskStatus;
  dependencies: string[];
  context: string;
  created_at: string;
}

/** Plan output from claude -p for task decomposition */
export interface TaskPlan {
  tasks: PlannedTask[];
  summary: string;
}

/** A single planned task before assignment */
export interface PlannedTask {
  title: string;
  description: string;
  role: WorkerRole;
  dependencies: string[];
}

/** Artifact produced by a task */
export interface Artifact {
  path: string;
  action: "created" | "modified" | "deleted";
}

/** Result written to .manju/results/<task-id>.json */
export interface TaskResult {
  task_id: string;
  status: "success" | "failure";
  output: string;
  artifacts: Artifact[];
  context_contribution: string;
  cost_usd: number;
  duration_ms: number;
}

/** Shared context entry */
export interface ContextEntry {
  from: string;
  task_id: string;
  summary: string;
}

/** Shared context file .manju/context/shared.json */
export interface SharedContext {
  entries: ContextEntry[];
}

/** Session metadata .manju/session.json */
export interface Session {
  id: string;
  started_at: string;
  working_directory: string;
  team: TeamConfig;
  status: "active" | "stopped";
}

/** Team configuration */
export interface TeamConfig {
  investigators: number;
  implementers: number;
  testers: number;
}

/** Default team configuration */
export const DEFAULT_TEAM: TeamConfig = {
  investigators: 2,
  implementers: 2,
  testers: 1,
};

/** Pane info for tmux layout */
export interface PaneInfo {
  id: number;
  role: Role;
  name: string;
  width: number;
  height: number;
}

/** Layout calculation result */
export interface Layout {
  panes: PaneInfo[];
  rows: PaneInfo[][];
}
