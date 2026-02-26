import { FileStore } from "../workspace/file-store.js";
import { Logger } from "../utils/logger.js";
import type { SharedContext, ContextEntry, TaskResult } from "../types.js";

export class ContextManager {
  private store: FileStore;
  private logger: Logger;

  constructor(store: FileStore) {
    this.store = store;
    this.logger = new Logger("context");
  }

  /** Add a result's context contribution to shared context */
  async addFromResult(result: TaskResult, fromWorker: string): Promise<void> {
    if (!result.context_contribution) return;

    const entry: ContextEntry = {
      from: fromWorker,
      task_id: result.task_id,
      summary: result.context_contribution,
    };

    await this.store.addContextEntry(entry);
    this.logger.info(`Added context from ${fromWorker} (${result.task_id})`);
  }

  /** Get the current shared context */
  async getContext(): Promise<SharedContext> {
    return this.store.readContext();
  }

  /** Build a text summary of all shared context for use in prompts */
  async buildContextSummary(): Promise<string> {
    const ctx = await this.store.readContext();
    if (ctx.entries.length === 0) return "";

    const lines = ctx.entries.map(
      (e) => `[${e.from}] ${e.summary}`,
    );
    return lines.join("\n");
  }
}
