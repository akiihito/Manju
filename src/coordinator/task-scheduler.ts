import { FileStore } from "../workspace/file-store.js";
import { Logger } from "../utils/logger.js";
import type { Task } from "../types.js";

export class TaskScheduler {
  private store: FileStore;
  private logger: Logger;

  constructor(store: FileStore) {
    this.store = store;
    this.logger = new Logger("scheduler");
  }

  /** Write all tasks to the file store */
  async writeTasks(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      await this.store.writeTask(task);
      this.logger.info(`Wrote task ${task.id}: ${task.title} -> ${task.assignee}`);
    }
  }

  /** Check completed results and unblock dependent tasks */
  async resolveDependencies(allTasks: Task[]): Promise<Task[]> {
    const completedIds = new Set<string>();
    const newlyAssigned: Task[] = [];

    // Find completed tasks
    for (const task of allTasks) {
      if (task.status === "success" || task.status === "failure") {
        completedIds.add(task.id);
      }
    }

    // Check pending tasks whose dependencies are all complete
    for (const task of allTasks) {
      if (task.status !== "pending") continue;

      const allDepsComplete = task.dependencies.every((dep) => completedIds.has(dep));
      if (allDepsComplete) {
        task.status = "assigned";
        await this.store.writeTask(task);
        newlyAssigned.push(task);
        this.logger.info(`Unblocked task ${task.id}: ${task.title}`);
      }
    }

    return newlyAssigned;
  }

  /** Check if all tasks in a set are complete */
  isAllComplete(tasks: Task[]): boolean {
    return tasks.every(
      (t) => t.status === "success" || t.status === "failure",
    );
  }

  /** Get tasks that are currently runnable (assigned or running) */
  getActiveTasks(tasks: Task[]): Task[] {
    return tasks.filter(
      (t) => t.status === "assigned" || t.status === "running",
    );
  }

  /** Get tasks that are still pending */
  getPendingTasks(tasks: Task[]): Task[] {
    return tasks.filter((t) => t.status === "pending");
  }

  /** Get summary of task statuses */
  getStatusSummary(tasks: Task[]): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const task of tasks) {
      summary[task.status] = (summary[task.status] || 0) + 1;
    }
    return summary;
  }
}
