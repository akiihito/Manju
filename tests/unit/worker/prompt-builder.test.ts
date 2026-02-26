import { describe, it, expect } from "vitest";
import { PromptBuilder } from "../../../src/worker/prompt-builder.js";
import type { Task, SharedContext } from "../../../src/types.js";

describe("PromptBuilder", () => {
  const builder = new PromptBuilder();

  describe("getSystemPrompt", () => {
    it("should return investigator prompt", () => {
      const prompt = builder.getSystemPrompt("investigator");
      expect(prompt).toContain("Investigator");
      expect(prompt).toContain("Do NOT modify any files");
    });

    it("should return implementer prompt", () => {
      const prompt = builder.getSystemPrompt("implementer");
      expect(prompt).toContain("Implementer");
      expect(prompt).toContain("write and modify code");
    });

    it("should return tester prompt", () => {
      const prompt = builder.getSystemPrompt("tester");
      expect(prompt).toContain("Tester");
      expect(prompt).toContain("test");
    });
  });

  describe("buildTaskPrompt", () => {
    const sampleTask: Task = {
      id: "task-001",
      title: "Investigate project structure",
      description: "Analyze the src/ directory",
      role: "investigator",
      assignee: "investigator-1",
      status: "assigned",
      dependencies: [],
      context: "This is a Node.js project",
      created_at: "2026-02-25T10:00:00Z",
    };

    it("should include task title and description", () => {
      const prompt = builder.buildTaskPrompt(sampleTask);
      expect(prompt).toContain("Investigate project structure");
      expect(prompt).toContain("Analyze the src/ directory");
    });

    it("should include task context", () => {
      const prompt = builder.buildTaskPrompt(sampleTask);
      expect(prompt).toContain("This is a Node.js project");
    });

    it("should include shared context", () => {
      const sharedCtx: SharedContext = {
        entries: [
          {
            from: "investigator-1",
            task_id: "task-000",
            summary: "Express 4.x project with Mongoose",
          },
        ],
      };
      const prompt = builder.buildTaskPrompt(sampleTask, sharedCtx);
      expect(prompt).toContain("investigator-1");
      expect(prompt).toContain("Express 4.x project with Mongoose");
    });

    it("should handle empty shared context", () => {
      const prompt = builder.buildTaskPrompt(sampleTask, { entries: [] });
      expect(prompt).not.toContain("Shared Context");
    });
  });

  describe("buildPlanningPrompt", () => {
    it("should include user request", () => {
      const prompt = builder.buildPlanningPrompt("Add login feature");
      expect(prompt).toContain("Add login feature");
    });

    it("should list available roles", () => {
      const prompt = builder.buildPlanningPrompt("Add login feature");
      expect(prompt).toContain("investigator");
      expect(prompt).toContain("implementer");
      expect(prompt).toContain("tester");
    });

    it("should include context summary when provided", () => {
      const prompt = builder.buildPlanningPrompt("Add login feature", "Express app with JWT");
      expect(prompt).toContain("Express app with JWT");
    });
  });
});
