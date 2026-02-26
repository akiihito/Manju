import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TaskScheduler } from "../../../src/coordinator/task-scheduler.js";
import { FileStore } from "../../../src/workspace/file-store.js";
import type { Task } from "../../../src/types.js";

describe("TaskScheduler", () => {
  let tmpDir: string;
  let store: FileStore;
  let scheduler: TaskScheduler;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manju-sched-test-"));
    store = new FileStore(tmpDir);
    await store.init();
    scheduler = new TaskScheduler(store);
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  const makeTasks = (): Task[] => [
    {
      id: "t1",
      title: "Investigate",
      description: "",
      role: "investigator",
      assignee: "investigator-1",
      status: "assigned",
      dependencies: [],
      context: "",
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "t2",
      title: "Implement",
      description: "",
      role: "implementer",
      assignee: "implementer-1",
      status: "pending",
      dependencies: ["t1"],
      context: "",
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "t3",
      title: "Test",
      description: "",
      role: "tester",
      assignee: "tester-1",
      status: "pending",
      dependencies: ["t2"],
      context: "",
      created_at: "2026-01-01T00:00:00Z",
    },
  ];

  describe("writeTasks", () => {
    it("should write all tasks to the store", async () => {
      const tasks = makeTasks();
      await scheduler.writeTasks(tasks);

      const stored = await store.listTasks();
      expect(stored).toHaveLength(3);
    });
  });

  describe("resolveDependencies", () => {
    it("should unblock task when dependency completes", async () => {
      const tasks = makeTasks();
      tasks[0].status = "success"; // t1 complete
      await scheduler.writeTasks(tasks);

      const newlyAssigned = await scheduler.resolveDependencies(tasks);
      expect(newlyAssigned).toHaveLength(1);
      expect(newlyAssigned[0].id).toBe("t2");
      expect(tasks[1].status).toBe("assigned");
    });

    it("should not unblock task when dependencies are incomplete", async () => {
      const tasks = makeTasks();
      // t1 still assigned (not complete)
      await scheduler.writeTasks(tasks);

      const newlyAssigned = await scheduler.resolveDependencies(tasks);
      expect(newlyAssigned).toHaveLength(0);
      expect(tasks[1].status).toBe("pending");
    });

    it("should handle chain dependencies", async () => {
      const tasks = makeTasks();
      tasks[0].status = "success";
      tasks[1].status = "success";
      await scheduler.writeTasks(tasks);

      const newlyAssigned = await scheduler.resolveDependencies(tasks);
      expect(newlyAssigned).toHaveLength(1);
      expect(newlyAssigned[0].id).toBe("t3");
    });
  });

  describe("isAllComplete", () => {
    it("should return true when all tasks are success/failure", () => {
      const tasks = makeTasks();
      tasks[0].status = "success";
      tasks[1].status = "success";
      tasks[2].status = "failure";
      expect(scheduler.isAllComplete(tasks)).toBe(true);
    });

    it("should return false when tasks are still running", () => {
      const tasks = makeTasks();
      tasks[0].status = "success";
      expect(scheduler.isAllComplete(tasks)).toBe(false);
    });
  });

  describe("getActiveTasks", () => {
    it("should return assigned and running tasks", () => {
      const tasks = makeTasks();
      tasks[0].status = "running";
      const active = scheduler.getActiveTasks(tasks);
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe("t1");
    });
  });

  describe("getStatusSummary", () => {
    it("should count tasks by status", () => {
      const tasks = makeTasks();
      const summary = scheduler.getStatusSummary(tasks);
      expect(summary).toEqual({ assigned: 1, pending: 2 });
    });
  });
});
