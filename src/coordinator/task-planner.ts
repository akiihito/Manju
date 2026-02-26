import { randomUUID } from "node:crypto";
import { ClaudeRunner } from "../worker/claude-runner.js";
import { PromptBuilder } from "../worker/prompt-builder.js";
import { TASK_PLAN_SCHEMA } from "../schemas.js";
import { Logger } from "../utils/logger.js";
import { TaskError } from "../utils/errors.js";
import type { Task, TaskPlan, PlannedTask, TeamConfig } from "../types.js";

export class TaskPlanner {
  private claudeRunner: ClaudeRunner;
  private promptBuilder: PromptBuilder;
  private logger: Logger;

  constructor() {
    this.claudeRunner = new ClaudeRunner("task-planner");
    this.promptBuilder = new PromptBuilder();
    this.logger = new Logger("task-planner");
  }

  /** Use claude -p to decompose a user request into tasks */
  async planTasks(
    userRequest: string,
    contextSummary?: string,
    cwd?: string,
    directives?: string[],
  ): Promise<TaskPlan> {
    const prompt = this.promptBuilder.buildPlanningPrompt(userRequest, contextSummary, directives);

    const result = await this.claudeRunner.run({
      prompt,
      systemPrompt:
        "You are a task planning coordinator. Break user requests into concrete, actionable tasks for a development team. Output valid JSON matching the provided schema.",
      jsonSchema: TASK_PLAN_SCHEMA,
      maxTurns: 1,
      cwd,
    });

    if (result.exitCode !== 0) {
      throw new TaskError(`Task planning failed with exit code ${result.exitCode}`);
    }

    const plan = this.claudeRunner.parseJsonOutput<TaskPlan>(result.output);

    // Ensure tasks is always a valid array
    if (!Array.isArray(plan.tasks)) {
      this.logger.warn(`Plan tasks is not an array (got ${typeof plan.tasks}), defaulting to empty`);
      plan.tasks = [];
    }
    if (!plan.summary) {
      plan.summary = "";
    }

    return plan;
  }

  /** Convert planned tasks into assigned Task objects */
  assignTasks(
    plan: TaskPlan,
    team: TeamConfig,
  ): Task[] {
    const workerCounters: Record<string, number> = {
      investigator: 0,
      implementer: 0,
      tester: 0,
    };

    const workerMax: Record<string, number> = {
      investigator: team.investigators,
      implementer: team.implementers,
      tester: team.testers,
    };

    // Map task titles to IDs for dependency resolution
    const titleToId = new Map<string, string>();
    const tasks: Task[] = [];

    for (const planned of plan.tasks) {
      const taskId = `task-${randomUUID().slice(0, 8)}`;
      titleToId.set(planned.title, taskId);
    }

    for (const planned of plan.tasks) {
      const taskId = titleToId.get(planned.title)!;
      const assignee = this.pickWorker(planned.role, workerCounters, workerMax);
      const dependencies = planned.dependencies
        .map((dep) => titleToId.get(dep))
        .filter((id): id is string => id !== undefined);

      const task: Task = {
        id: taskId,
        title: planned.title,
        description: planned.description,
        role: planned.role,
        assignee,
        status: dependencies.length > 0 ? "pending" : "assigned",
        dependencies,
        context: "",
        created_at: new Date().toISOString(),
      };

      tasks.push(task);
    }

    return tasks;
  }

  /** Round-robin worker assignment */
  private pickWorker(
    role: string,
    counters: Record<string, number>,
    max: Record<string, number>,
  ): string {
    const count = max[role] || 1;
    const idx = (counters[role] % count) + 1;
    counters[role]++;
    return `${role}-${idx}`;
  }
}
