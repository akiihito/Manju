import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { FileStore } from "../../../src/workspace/file-store.js";
import type { Task, TaskResult } from "../../../src/types.js";

describe("FileStore", () => {
  let tmpDir: string;
  let store: FileStore;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manju-test-"));
    store = new FileStore(tmpDir);
    await store.init();
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create workspace directories on init", () => {
    expect(fs.existsSync(store.basePath)).toBe(true);
    expect(fs.existsSync(store.tasksDir)).toBe(true);
    expect(fs.existsSync(store.resultsDir)).toBe(true);
    expect(fs.existsSync(store.contextDir)).toBe(true);
    expect(fs.existsSync(store.logsDir)).toBe(true);
  });

  describe("tasks", () => {
    const sampleTask: Task = {
      id: "task-001",
      title: "Investigate project structure",
      description: "Analyze the project directory and report on architecture",
      role: "investigator",
      assignee: "investigator-1",
      status: "assigned",
      dependencies: [],
      context: "",
      created_at: "2026-02-25T10:00:00Z",
    };

    it("should write and read a task", async () => {
      await store.writeTask(sampleTask);
      const task = await store.readTask("task-001");
      expect(task).toEqual(sampleTask);
    });

    it("should list tasks", async () => {
      await store.writeTask(sampleTask);
      await store.writeTask({ ...sampleTask, id: "task-002", title: "Second task" });
      const tasks = await store.listTasks();
      expect(tasks).toHaveLength(2);
    });

    it("should update task status", async () => {
      await store.writeTask(sampleTask);
      await store.updateTaskStatus("task-001", "running");
      const task = await store.readTask("task-001");
      expect(task.status).toBe("running");
    });
  });

  describe("results", () => {
    const sampleResult: TaskResult = {
      task_id: "task-001",
      status: "success",
      output: "Found Express 4.x project",
      artifacts: [{ path: "docs/arch.md", action: "created" }],
      context_contribution: "Express 4.x with Mongoose",
      cost_usd: 0.05,
      duration_ms: 8000,
    };

    it("should write and read a result", async () => {
      await store.writeResult(sampleResult);
      const result = await store.readResult("task-001");
      expect(result).toEqual(sampleResult);
    });

    it("should check if result exists", async () => {
      expect(await store.hasResult("task-001")).toBe(false);
      await store.writeResult(sampleResult);
      expect(await store.hasResult("task-001")).toBe(true);
    });

    it("should list results", async () => {
      await store.writeResult(sampleResult);
      const results = await store.listResults();
      expect(results).toHaveLength(1);
      expect(results[0].task_id).toBe("task-001");
    });
  });

  describe("context", () => {
    it("should return empty context when no file exists", async () => {
      const ctx = await store.readContext();
      expect(ctx.entries).toEqual([]);
    });

    it("should add context entries", async () => {
      await store.addContextEntry({
        from: "investigator-1",
        task_id: "task-001",
        summary: "Express 4.x project",
      });
      await store.addContextEntry({
        from: "implementer-1",
        task_id: "task-002",
        summary: "Added new route",
      });
      const ctx = await store.readContext();
      expect(ctx.entries).toHaveLength(2);
    });
  });

  describe("session", () => {
    it("should write and read session", async () => {
      const session = {
        id: "session-1",
        started_at: "2026-02-25T10:00:00Z",
        working_directory: "/tmp/project",
        team: { investigators: 2, implementers: 2, testers: 1 },
        status: "active" as const,
      };
      await store.writeSession(session);
      const read = await store.readSession();
      expect(read).toEqual(session);
    });
  });

  describe("clean", () => {
    it("should remove workspace directory", async () => {
      expect(fs.existsSync(store.basePath)).toBe(true);
      await store.clean();
      expect(fs.existsSync(store.basePath)).toBe(false);
    });
  });
});
