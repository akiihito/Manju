import { describe, it, expect, vi } from "vitest";
import { TaskPlanner } from "../../../src/coordinator/task-planner.js";
import type { TaskPlan, TeamConfig } from "../../../src/types.js";
import { ClaudeRunner } from "../../../src/worker/claude-runner.js";

describe("TaskPlanner", () => {
  const planner = new TaskPlanner();

  describe("assignTasks", () => {
    const samplePlan: TaskPlan = {
      tasks: [
        {
          title: "Investigate project structure",
          description: "Analyze src/ directory",
          role: "investigator",
          dependencies: [],
        },
        {
          title: "Investigate API routes",
          description: "Analyze routes/",
          role: "investigator",
          dependencies: [],
        },
        {
          title: "Implement login endpoint",
          description: "Create POST /login",
          role: "implementer",
          dependencies: ["Investigate project structure", "Investigate API routes"],
        },
        {
          title: "Write login tests",
          description: "Test login endpoint",
          role: "tester",
          dependencies: ["Implement login endpoint"],
        },
      ],
      summary: "Add login feature",
    };

    const team: TeamConfig = {
      investigators: 2,
      implementers: 2,
      testers: 1,
    };

    it("should assign all tasks from the plan", () => {
      const tasks = planner.assignTasks(samplePlan, team);
      expect(tasks).toHaveLength(4);
    });

    it("should assign unique IDs to all tasks", () => {
      const tasks = planner.assignTasks(samplePlan, team);
      const ids = tasks.map((t) => t.id);
      expect(new Set(ids).size).toBe(4);
    });

    it("should round-robin investigators", () => {
      const tasks = planner.assignTasks(samplePlan, team);
      const investigators = tasks.filter((t) => t.role === "investigator");
      expect(investigators[0].assignee).toBe("investigator-1");
      expect(investigators[1].assignee).toBe("investigator-2");
    });

    it("should mark tasks with dependencies as pending", () => {
      const tasks = planner.assignTasks(samplePlan, team);
      const implTask = tasks.find((t) => t.title === "Implement login endpoint")!;
      expect(implTask.status).toBe("pending");
      expect(implTask.dependencies).toHaveLength(2);
    });

    it("should mark tasks without dependencies as assigned", () => {
      const tasks = planner.assignTasks(samplePlan, team);
      const invTasks = tasks.filter((t) => t.role === "investigator");
      expect(invTasks[0].status).toBe("assigned");
      expect(invTasks[1].status).toBe("assigned");
    });

    it("should resolve dependency titles to task IDs", () => {
      const tasks = planner.assignTasks(samplePlan, team);
      const implTask = tasks.find((t) => t.title === "Implement login endpoint")!;
      const invIds = tasks
        .filter((t) => t.role === "investigator")
        .map((t) => t.id);

      for (const dep of implTask.dependencies) {
        expect(invIds).toContain(dep);
      }
    });
  });

  describe("planTasks validation", () => {
    it("should normalize plan with missing tasks to empty array", async () => {
      const planner = new TaskPlanner();

      // Mock the runner to return a result without tasks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runner: ClaudeRunner = (planner as any).claudeRunner;
      vi.spyOn(runner, "run").mockResolvedValue({
        output: JSON.stringify({ result: JSON.stringify({ summary: "No tasks" }) }),
        exitCode: 0,
        durationMs: 100,
      });

      const plan = await planner.planTasks("do something");
      expect(plan.tasks).toEqual([]);
      expect(plan.summary).toBe("No tasks");
    });

    it("should normalize plan with non-array tasks to empty array", async () => {
      const planner = new TaskPlanner();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runner: ClaudeRunner = (planner as any).claudeRunner;
      vi.spyOn(runner, "run").mockResolvedValue({
        output: JSON.stringify({ result: JSON.stringify({ summary: "Bad", tasks: "not an array" }) }),
        exitCode: 0,
        durationMs: 100,
      });

      const plan = await planner.planTasks("do something");
      expect(plan.tasks).toEqual([]);
    });

    it("should keep valid tasks array as-is", async () => {
      const planner = new TaskPlanner();

      const validPlan = {
        summary: "Good plan",
        tasks: [{ title: "T1", description: "D1", role: "investigator", dependencies: [] }],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runner: ClaudeRunner = (planner as any).claudeRunner;
      vi.spyOn(runner, "run").mockResolvedValue({
        output: JSON.stringify({ result: JSON.stringify(validPlan) }),
        exitCode: 0,
        durationMs: 100,
      });

      const plan = await planner.planTasks("do something");
      expect(plan.tasks).toHaveLength(1);
      expect(plan.tasks[0].title).toBe("T1");
    });
  });
});
