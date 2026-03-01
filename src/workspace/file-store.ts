import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { Task, TaskResult, SharedContext, Session } from "../types.js";
import { WorkspaceError } from "../utils/errors.js";

const MANJU_DIR = ".manju";

export class FileStore {
  private root: string;
  private workingDirectory: string;

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory;
    this.root = path.join(workingDirectory, MANJU_DIR);
  }

  get basePath(): string {
    return this.root;
  }

  get tasksDir(): string {
    return path.join(this.root, "tasks");
  }

  get resultsDir(): string {
    return path.join(this.root, "results");
  }

  get contextDir(): string {
    return path.join(this.root, "context");
  }

  get logsDir(): string {
    return path.join(this.root, "logs");
  }

  /** Initialize workspace directories */
  async init(): Promise<void> {
    const dirs = [this.root, this.tasksDir, this.resultsDir, this.contextDir, this.logsDir];
    for (const dir of dirs) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  /** Clean workspace */
  async clean(): Promise<void> {
    if (fs.existsSync(this.root)) {
      await fs.promises.rm(this.root, { recursive: true, force: true });
    }
  }

  /** Write JSON atomically (write to temp then rename) */
  private async writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    const tmpFile = path.join(dir, `.tmp-${randomUUID()}.json`);
    try {
      await fs.promises.writeFile(tmpFile, JSON.stringify(data, null, 2), "utf-8");
      await fs.promises.rename(tmpFile, filePath);
    } catch (err) {
      // Clean up temp file on error
      try {
        await fs.promises.unlink(tmpFile);
      } catch {
        // ignore cleanup error
      }
      throw new WorkspaceError(`Failed to write ${filePath}: ${err}`);
    }
  }

  /** Read and parse JSON file */
  private async readJson<T>(filePath: string): Promise<T> {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch (err) {
      throw new WorkspaceError(`Failed to read ${filePath}: ${err}`);
    }
  }

  // --- Tasks ---

  async writeTask(task: Task): Promise<void> {
    const filePath = path.join(this.tasksDir, `${task.id}.json`);
    await this.writeJsonAtomic(filePath, task);
  }

  async readTask(taskId: string): Promise<Task> {
    const filePath = path.join(this.tasksDir, `${taskId}.json`);
    return this.readJson<Task>(filePath);
  }

  async listTasks(): Promise<Task[]> {
    const files = await this.listJsonFiles(this.tasksDir);
    const tasks: Task[] = [];
    for (const file of files) {
      tasks.push(await this.readJson<Task>(path.join(this.tasksDir, file)));
    }
    return tasks;
  }

  async updateTaskStatus(taskId: string, status: Task["status"]): Promise<void> {
    const task = await this.readTask(taskId);
    task.status = status;
    await this.writeTask(task);
  }

  // --- Results ---

  async writeResult(result: TaskResult): Promise<void> {
    const filePath = path.join(this.resultsDir, `${result.task_id}.json`);
    await this.writeJsonAtomic(filePath, result);
  }

  async readResult(taskId: string): Promise<TaskResult> {
    const filePath = path.join(this.resultsDir, `${taskId}.json`);
    return this.readJson<TaskResult>(filePath);
  }

  async listResults(): Promise<TaskResult[]> {
    const files = await this.listJsonFiles(this.resultsDir);
    const results: TaskResult[] = [];
    for (const file of files) {
      results.push(await this.readJson<TaskResult>(path.join(this.resultsDir, file)));
    }
    return results;
  }

  async hasResult(taskId: string): Promise<boolean> {
    const filePath = path.join(this.resultsDir, `${taskId}.json`);
    return fs.existsSync(filePath);
  }

  // --- Context ---

  async readContext(): Promise<SharedContext> {
    const filePath = path.join(this.contextDir, "shared.json");
    if (!fs.existsSync(filePath)) {
      return { entries: [] };
    }
    return this.readJson<SharedContext>(filePath);
  }

  async addContextEntry(entry: SharedContext["entries"][0]): Promise<void> {
    const ctx = await this.readContext();
    ctx.entries.push(entry);
    const filePath = path.join(this.contextDir, "shared.json");
    await this.writeJsonAtomic(filePath, ctx);
  }

  // --- Directives ---

  async writeDirectives(content: string): Promise<void> {
    const filePath = path.join(this.root, "directives.json");
    await this.writeJsonAtomic(filePath, { content });
  }

  async readDirectives(): Promise<string | null> {
    const filePath = path.join(this.root, "directives.json");
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const data = await this.readJson<{ content: string }>(filePath);
    return data.content;
  }

  /** Read CLAUDE.md from the working directory */
  async readClaudeMd(): Promise<string | null> {
    const filePath = path.join(this.workingDirectory, "CLAUDE.md");
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      return await fs.promises.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  // --- Session ---

  async writeSession(session: Session): Promise<void> {
    const filePath = path.join(this.root, "session.json");
    await this.writeJsonAtomic(filePath, session);
  }

  async readSession(): Promise<Session> {
    const filePath = path.join(this.root, "session.json");
    return this.readJson<Session>(filePath);
  }

  // --- Helpers ---

  private async listJsonFiles(dir: string): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(dir);
      return entries.filter((f) => f.endsWith(".json") && !f.startsWith(".tmp-"));
    } catch {
      return [];
    }
  }
}
