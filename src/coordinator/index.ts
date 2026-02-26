import * as readline from "node:readline";
import { FileStore } from "../workspace/file-store.js";
import { Watcher } from "../workspace/watcher.js";
import { TaskPlanner } from "./task-planner.js";
import { TaskScheduler } from "./task-scheduler.js";
import { ContextManager } from "./context-manager.js";
import { Logger } from "../utils/logger.js";
import type { Task, TeamConfig } from "../types.js";

export class Coordinator {
  private store: FileStore;
  private watcher: Watcher;
  private planner: TaskPlanner;
  private scheduler: TaskScheduler;
  private contextManager: ContextManager;
  private logger: Logger;
  private team: TeamConfig;
  private cwd: string;
  private currentTasks: Task[] = [];

  constructor(cwd: string, team: TeamConfig) {
    this.cwd = cwd;
    this.team = team;
    this.store = new FileStore(cwd);
    this.watcher = new Watcher("coordinator-watcher");
    this.planner = new TaskPlanner();
    this.scheduler = new TaskScheduler(this.store);
    this.contextManager = new ContextManager(this.store);
    this.logger = new Logger("coordinator");
  }

  /** Start the coordinator in interactive mode */
  async start(): Promise<void> {
    await this.store.init();

    // Watch for results
    this.watcher.watchDirectory(this.store.resultsDir, async (filename) => {
      await this.handleResult(filename);
    });

    this.logger.info("Coordinator started. Waiting for input...");
    console.log("\n🎯 Manju Coordinator");
    console.log("Type your request and press Enter.\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "manju> ",
    });

    rl.prompt();

    rl.on("line", async (line) => {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        return;
      }

      if (input === "status") {
        this.printStatus();
        rl.prompt();
        return;
      }

      if (input === "quit" || input === "exit") {
        this.watcher.stop();
        rl.close();
        process.exit(0);
      }

      try {
        await this.handleRequest(input);
      } catch (err) {
        this.logger.error(`Failed to handle request: ${err}`);
      }

      rl.prompt();
    });

    rl.on("close", () => {
      this.watcher.stop();
    });
  }

  /** Handle a user request: plan and dispatch tasks */
  private async handleRequest(request: string): Promise<void> {
    this.logger.info(`Processing request: ${request}`);
    console.log("\nPlanning tasks...\n");

    const contextSummary = await this.contextManager.buildContextSummary();
    const plan = await this.planner.planTasks(request, contextSummary || undefined, this.cwd);

    console.log(`\nPlan: ${plan.summary}`);
    console.log(`Tasks: ${plan.tasks.length}\n`);

    for (const t of plan.tasks) {
      console.log(`  [${t.role}] ${t.title}`);
    }
    console.log("");

    const tasks = this.planner.assignTasks(plan, this.team);
    this.currentTasks = tasks;

    await this.scheduler.writeTasks(tasks);
    this.logger.info(`Dispatched ${tasks.length} tasks`);
  }

  /** Handle a result file appearing */
  private async handleResult(filename: string): Promise<void> {
    const taskId = filename.replace(".json", "");

    try {
      const result = await this.store.readResult(taskId);
      const task = this.currentTasks.find((t) => t.id === taskId);

      if (!task) return;

      task.status = result.status;
      await this.store.writeTask(task);

      // Add context contribution
      await this.contextManager.addFromResult(result, task.assignee);

      this.logger.info(
        `Task ${taskId} completed (${result.status}): ${task.title}`,
      );

      // Check for newly unblocked tasks
      const newlyAssigned = await this.scheduler.resolveDependencies(
        this.currentTasks,
      );
      if (newlyAssigned.length > 0) {
        this.logger.info(
          `Unblocked ${newlyAssigned.length} tasks`,
        );
      }

      // Check if all done
      if (this.scheduler.isAllComplete(this.currentTasks)) {
        console.log("\n✅ All tasks completed!\n");
        this.printStatus();
      }
    } catch (err) {
      this.logger.error(`Failed to handle result ${taskId}: ${err}`);
    }
  }

  /** Print current task status */
  private printStatus(): void {
    if (this.currentTasks.length === 0) {
      console.log("No active tasks.");
      return;
    }

    const summary = this.scheduler.getStatusSummary(this.currentTasks);
    console.log("\n--- Task Status ---");
    for (const task of this.currentTasks) {
      const icon =
        task.status === "success"
          ? "✅"
          : task.status === "failure"
            ? "❌"
            : task.status === "running"
              ? "🔄"
              : task.status === "assigned"
                ? "📋"
                : "⏳";
      console.log(`  ${icon} [${task.assignee}] ${task.title} (${task.status})`);
    }
    console.log(
      `\nTotal: ${JSON.stringify(summary)}\n`,
    );
  }
}
