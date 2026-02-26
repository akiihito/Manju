import * as readline from "node:readline";
import { FileStore } from "../workspace/file-store.js";
import { Watcher } from "../workspace/watcher.js";
import { TaskPlanner } from "./task-planner.js";
import { TaskScheduler } from "./task-scheduler.js";
import { ContextManager } from "./context-manager.js";
import { ComplianceChecker } from "./compliance-checker.js";
import { Logger } from "../utils/logger.js";
import type { Task, TeamConfig } from "../types.js";

/** Fixed commands that the coordinator handles directly */
const FIXED_COMMANDS: Record<string, string> = {
  status: "Show current task status",
  quit: "Shut down the session",
  exit: "Shut down the session",
  help: "Show available commands",
  directives: "List current directives",
};

export class Coordinator {
  private store: FileStore;
  private watcher: Watcher;
  private planner: TaskPlanner;
  private scheduler: TaskScheduler;
  private contextManager: ContextManager;
  private complianceChecker: ComplianceChecker;
  private logger: Logger;
  private team: TeamConfig;
  private cwd: string;
  private currentTasks: Task[] = [];
  private directives: string[] = [];
  private onShutdown?: () => void;

  constructor(cwd: string, team: TeamConfig, onShutdown?: () => void) {
    this.cwd = cwd;
    this.team = team;
    this.onShutdown = onShutdown;
    this.store = new FileStore(cwd);
    this.watcher = new Watcher("coordinator-watcher");
    this.planner = new TaskPlanner();
    this.scheduler = new TaskScheduler(this.store);
    this.contextManager = new ContextManager(this.store);
    this.complianceChecker = new ComplianceChecker();
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

      try {
        const result = await this.routeInput(input);
        if (result === "shutdown") {
          rl.close();
          return;
        }
      } catch (err) {
        this.logger.error(`Failed to handle input: ${err}`);
      }

      rl.prompt();
    });

    rl.on("close", () => {
      this.watcher.stop();
    });
  }

  /**
   * Route user input to the appropriate handler.
   * - "/" prefix → coordinator command or directive
   * - "status" / "quit" / "exit" (no prefix) → legacy backward compat
   * - everything else → task decomposition
   */
  private async routeInput(input: string): Promise<"shutdown" | void> {
    // Slash-prefixed commands
    if (input.startsWith("/")) {
      const body = input.slice(1);
      const cmd = body.toLowerCase();

      if (cmd === "status") {
        this.printStatus();
        return;
      }
      if (cmd === "quit" || cmd === "exit") {
        this.shutdown();
        return "shutdown";
      }
      if (cmd === "help") {
        this.printHelp();
        return;
      }
      if (cmd === "directives") {
        this.printDirectives();
        return;
      }

      // Free-form directive
      this.directives.push(body);
      await this.store.writeDirectives(this.directives);
      console.log(`Directive added: ${body}`);
      this.logger.info(`Directive added: ${body}`);
      return;
    }

    // Legacy commands (backward compat, no slash)
    if (input === "status") {
      this.printStatus();
      return;
    }
    if (input === "quit" || input === "exit") {
      this.shutdown();
      return "shutdown";
    }

    // Task request
    await this.handleRequest(input);
  }

  /** Handle a user request: plan and dispatch tasks */
  private async handleRequest(request: string): Promise<void> {
    this.logger.info(`Processing request: ${request}`);
    console.log("\nPlanning tasks...\n");

    const contextSummary = await this.contextManager.buildContextSummary();
    const plan = await this.planner.planTasks(
      request,
      contextSummary || undefined,
      this.cwd,
      this.directives.length > 0 ? this.directives : undefined,
    );

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

      // Compliance check
      if (result.status === "success" && this.directives.length > 0) {
        const compliance = await this.complianceChecker.check(result, task, this.directives);
        if (compliance && !compliance.compliant) {
          this.logger.warn(`Task ${taskId} compliance violations: ${compliance.summary}`);
          console.log(`\n⚠️  Compliance: "${task.title}": ${compliance.summary}`);
          for (const v of compliance.violations) {
            console.log(`   - "${v.directive}" — ${v.reason}`);
          }
        }
      }

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

  /** Print available commands */
  private printHelp(): void {
    console.log("\n--- Manju Commands ---");
    console.log("  /status      Show current task status");
    console.log("  /quit        Shut down the session");
    console.log("  /exit        Shut down the session");
    console.log("  /help        Show this help");
    console.log("  /directives  List current directives");
    console.log("  /<text>      Add a coordinator directive");
    console.log("");
    console.log("Any other input is treated as a task request.\n");
  }

  /** Print current directives */
  private printDirectives(): void {
    if (this.directives.length === 0) {
      console.log("No directives set.");
      return;
    }
    console.log("\n--- Coordinator Directives ---");
    for (const d of this.directives) {
      console.log(`  - ${d}`);
    }
    console.log("");
  }

  /** Shut down the coordinator and the entire tmux session */
  shutdown(): void {
    this.logger.info("Shutting down...");
    this.watcher.stop();
    if (this.onShutdown) {
      this.onShutdown();
    }
    process.exit(0);
  }
}
