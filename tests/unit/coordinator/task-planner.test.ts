import { describe, it, expect } from "vitest";
import { TaskPlanner } from "../../../src/coordinator/task-planner.js";
import type { TaskPlan, TeamConfig } from "../../../src/types.js";

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
});
