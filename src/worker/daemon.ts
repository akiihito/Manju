import { FileStore } from "../workspace/file-store.js";
import { Watcher } from "../workspace/watcher.js";
import { ClaudeRunner } from "./claude-runner.js";
import { PromptBuilder } from "./prompt-builder.js";
import { TASK_RESULT_SCHEMA } from "../schemas.js";
import { Logger } from "../utils/logger.js";
import type { WorkerRole, Task, TaskResult } from "../types.js";

export class WorkerDaemon {
  private name: string;
  private role: WorkerRole;
  private store: FileStore;
  private watcher: Watcher;
  private claudeRunner: ClaudeRunner;
  private promptBuilder: PromptBuilder;
  private logger: Logger;
  private running: boolean = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(name: string, role: WorkerRole, cwd: string) {
    this.name = name;
    this.role = role;
    this.store = new FileStore(cwd);
    this.watcher = new Watcher(name);
    this.claudeRunner = new ClaudeRunner(name);
    this.promptBuilder = new PromptBuilder();
    this.logger = new Logger(name);
  }

  /** Start the daemon loop */
  async start(): Promise<void> {
    this.running = true;
    this.logger.info(`Worker ${this.name} (${this.role}) started`);
    console.log(`\n🤖 ${this.name} (${this.role}) - Ready\n`);

    // Poll for assigned tasks
    this.pollInterval = setInterval(async () => {
      if (!this.running) return;

      try {
        await this.checkForTasks();
      } catch (err) {
        this.logger.error(`Poll error: ${err}`);
      }
    }, 500);

    // Handle shutdown
    process.on("SIGINT", () => this.stop());
    process.on("SIGTERM", () => this.stop());
  }

  /** Stop the daemon */
  stop(): void {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.watcher.stop();
    this.logger.info(`Worker ${this.name} stopped`);
  }

  /** Check for tasks assigned to this worker */
  private async checkForTasks(): Promise<void> {
    const tasks = await this.store.listTasks();
    const myTask = tasks.find(
      (t) => t.assignee === this.name && t.status === "assigned",
    );

    if (!myTask) return;

    await this.executeTask(myTask);
  }

  /** Execute a single task */
  private async executeTask(task: Task): Promise<void> {
    this.logger.info(`Executing task: ${task.title}`);
    console.log(`\n📋 Executing: ${task.title}\n`);

    // Mark as running
    await this.store.updateTaskStatus(task.id, "running");

    const startTime = Date.now();

    try {
      // Build prompt
      const sharedContext = await this.store.readContext();
      const directives = await this.store.readDirectives();
      const prompt = this.promptBuilder.buildTaskPrompt(task, sharedContext, directives);
      const systemPrompt = this.promptBuilder.getSystemPrompt(this.role);

      // Run claude
      const result = await this.claudeRunner.run({
        prompt,
        systemPrompt,
        jsonSchema: TASK_RESULT_SCHEMA,
        maxTurns: 10,
      });

      const durationMs = Date.now() - startTime;

      if (result.exitCode === 0) {
        // Parse structured output
        const parsed = this.claudeRunner.parseJsonOutput<{
          output: string;
          artifacts: { path: string; action: string }[];
          context_contribution: string;
        }>(result.output);

        const taskResult: TaskResult = {
          task_id: task.id,
          status: "success",
          output: parsed.output,
          artifacts: parsed.artifacts.map((a) => ({
            path: a.path,
            action: a.action as "created" | "modified" | "deleted",
          })),
          context_contribution: parsed.context_contribution,
          cost_usd: 0,
          duration_ms: durationMs,
        };

        await this.store.writeResult(taskResult);
        this.logger.info(`Task ${task.id} completed successfully`);
        console.log(`\n✅ Completed: ${task.title}\n`);
      } else {
        // Task failed
        const taskResult: TaskResult = {
          task_id: task.id,
          status: "failure",
          output: result.output || "Claude exited with non-zero code",
          artifacts: [],
          context_contribution: "",
          cost_usd: 0,
          duration_ms: durationMs,
        };

        await this.store.writeResult(taskResult);
        this.logger.error(`Task ${task.id} failed`);
        console.log(`\n❌ Failed: ${task.title}\n`);
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const taskResult: TaskResult = {
        task_id: task.id,
        status: "failure",
        output: `Error: ${err}`,
        artifacts: [],
        context_contribution: "",
        cost_usd: 0,
        duration_ms: durationMs,
      };

      await this.store.writeResult(taskResult);
      this.logger.error(`Task ${task.id} error: ${err}`);
      console.log(`\n❌ Error: ${task.title}: ${err}\n`);
    }
  }
}
