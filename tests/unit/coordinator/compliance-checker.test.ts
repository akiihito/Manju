import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock claude-runner before importing ComplianceChecker
vi.mock("../../../src/worker/claude-runner.js", () => {
  return {
    ClaudeRunner: vi.fn().mockImplementation(() => ({
      run: vi.fn(),
      parseJsonOutput: vi.fn(),
      buildArgs: vi.fn(),
    })),
  };
});

import { ComplianceChecker } from "../../../src/coordinator/compliance-checker.js";
import type { TaskResult, Task, ComplianceResult } from "../../../src/types.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-abc123",
    title: "Implement login feature",
    description: "Add a login form with validation",
    role: "implementer",
    assignee: "implementer-1",
    status: "success",
    dependencies: [],
    context: "",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeResult(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    task_id: "task-abc123",
    status: "success",
    output: "Login feature implemented with form validation.",
    artifacts: [{ path: "src/login.ts", action: "created" }],
    context_contribution: "Login form uses JWT tokens",
    cost_usd: 0.05,
    duration_ms: 3000,
    ...overrides,
  };
}

describe("ComplianceChecker", () => {
  let checker: ComplianceChecker;
  let mockRun: ReturnType<typeof vi.fn>;
  let mockParseJsonOutput: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    checker = new ComplianceChecker();
    // Access the mocked ClaudeRunner instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runner = (checker as any).claudeRunner;
    mockRun = runner.run;
    mockParseJsonOutput = runner.parseJsonOutput;
  });

  it("should return null when directives is empty", async () => {
    const result = await checker.check(makeResult(), makeTask(), []);
    expect(result).toBeNull();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("should return null when result status is failure", async () => {
    const result = await checker.check(
      makeResult({ status: "failure" }),
      makeTask(),
      ["Use Japanese for all responses"],
    );
    expect(result).toBeNull();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("should return compliant result when output complies with directives", async () => {
    const compliantResult: ComplianceResult = {
      compliant: true,
      violations: [],
      summary: "All directives satisfied",
    };

    mockRun.mockResolvedValue({ output: "{}", exitCode: 0, durationMs: 500 });
    mockParseJsonOutput.mockReturnValue(compliantResult);

    const result = await checker.check(
      makeResult(),
      makeTask(),
      ["Use TypeScript"],
    );

    expect(result).toEqual(compliantResult);
    expect(result!.compliant).toBe(true);
    expect(result!.violations).toHaveLength(0);
  });

  it("should return non-compliant result when violations are found", async () => {
    const nonCompliantResult: ComplianceResult = {
      compliant: false,
      violations: [
        {
          directive: "日本語で応答して",
          reason: "Output is entirely in English",
        },
      ],
      summary: "Response language does not match directive",
    };

    mockRun.mockResolvedValue({ output: "{}", exitCode: 0, durationMs: 500 });
    mockParseJsonOutput.mockReturnValue(nonCompliantResult);

    const result = await checker.check(
      makeResult(),
      makeTask(),
      ["日本語で応答して"],
    );

    expect(result).toEqual(nonCompliantResult);
    expect(result!.compliant).toBe(false);
    expect(result!.violations).toHaveLength(1);
    expect(result!.violations[0].directive).toBe("日本語で応答して");
  });

  it("should return null when ClaudeRunner fails", async () => {
    mockRun.mockRejectedValue(new Error("claude process crashed"));

    const result = await checker.check(
      makeResult(),
      makeTask(),
      ["Use TypeScript"],
    );

    expect(result).toBeNull();
  });

  it("should return null when ClaudeRunner exits with non-zero code", async () => {
    mockRun.mockResolvedValue({ output: "", exitCode: 1, durationMs: 500 });

    const result = await checker.check(
      makeResult(),
      makeTask(),
      ["Use TypeScript"],
    );

    expect(result).toBeNull();
  });

  it("should include directives and task info in the prompt", async () => {
    mockRun.mockResolvedValue({ output: "{}", exitCode: 0, durationMs: 500 });
    mockParseJsonOutput.mockReturnValue({
      compliant: true,
      violations: [],
      summary: "OK",
    });

    await checker.check(
      makeResult({ output: "Done: implemented feature X" }),
      makeTask({ title: "Feature X", description: "Build feature X" }),
      ["日本語で応答して", "テストを書くこと"],
    );

    expect(mockRun).toHaveBeenCalledTimes(1);
    const callArgs = mockRun.mock.calls[0][0];

    // Prompt should contain the directives
    expect(callArgs.prompt).toContain("日本語で応答して");
    expect(callArgs.prompt).toContain("テストを書くこと");

    // Prompt should contain task info
    expect(callArgs.prompt).toContain("Feature X");
    expect(callArgs.prompt).toContain("Build feature X");

    // Prompt should contain the task output
    expect(callArgs.prompt).toContain("Done: implemented feature X");

    // Should use maxTurns: 1
    expect(callArgs.maxTurns).toBe(1);
  });
});
