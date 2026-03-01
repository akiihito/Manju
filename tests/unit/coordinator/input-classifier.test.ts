import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock claude-runner before importing InputClassifier
vi.mock("../../../src/worker/claude-runner.js", () => {
  return {
    ClaudeRunner: vi.fn().mockImplementation(() => ({
      run: vi.fn(),
      parseJsonOutput: vi.fn(),
    })),
  };
});

import { InputClassifier } from "../../../src/coordinator/input-classifier.js";
import type { InputClassification } from "../../../src/types.js";

describe("InputClassifier", () => {
  let classifier: InputClassifier;
  let mockRun: ReturnType<typeof vi.fn>;
  let mockParseJsonOutput: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    classifier = new InputClassifier();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runner = (classifier as any).claudeRunner;
    mockRun = runner.run;
    mockParseJsonOutput = runner.parseJsonOutput;
  });

  it("should classify a coding task as 'worker'", async () => {
    const classification: InputClassification = {
      target: "worker",
      response: "",
    };

    mockRun.mockResolvedValue({ output: "{}", exitCode: 0, durationMs: 500 });
    mockParseJsonOutput.mockReturnValue(classification);

    const result = await classifier.classify("ログイン機能を実装して");

    expect(result.target).toBe("worker");
  });

  it("should classify a coordinator question as 'coordinator' with response", async () => {
    const classification: InputClassification = {
      target: "coordinator",
      response: "現在のチーム構成は investigator: 2, implementer: 2, tester: 1 です。",
    };

    mockRun.mockResolvedValue({ output: "{}", exitCode: 0, durationMs: 500 });
    mockParseJsonOutput.mockReturnValue(classification);

    const result = await classifier.classify("チーム構成を教えて");

    expect(result.target).toBe("coordinator");
    expect(result.response).toContain("チーム構成");
  });

  it("should include team config and task status in the prompt", async () => {
    mockRun.mockResolvedValue({ output: "{}", exitCode: 0, durationMs: 500 });
    mockParseJsonOutput.mockReturnValue({ target: "worker", response: "" });

    const teamConfig = { investigators: 2, implementers: 3, testers: 1 };

    await classifier.classify("何か作業して", { teamConfig });

    const callArgs = mockRun.mock.calls[0][0];
    expect(callArgs.prompt).toContain("investigators: 2");
    expect(callArgs.prompt).toContain("implementers: 3");
    expect(callArgs.prompt).toContain("testers: 1");
  });

  it("should include current task status in the prompt when provided", async () => {
    mockRun.mockResolvedValue({ output: "{}", exitCode: 0, durationMs: 500 });
    mockParseJsonOutput.mockReturnValue({ target: "coordinator", response: "status info" });

    await classifier.classify("今の進捗は？", {
      taskSummary: "3 tasks: 1 success, 1 running, 1 pending",
    });

    const callArgs = mockRun.mock.calls[0][0];
    expect(callArgs.prompt).toContain("3 tasks");
  });

  it("should default to 'worker' when Claude call fails", async () => {
    mockRun.mockRejectedValue(new Error("claude process crashed"));

    const result = await classifier.classify("何かして");

    expect(result.target).toBe("worker");
  });

  it("should default to 'worker' when exit code is non-zero", async () => {
    mockRun.mockResolvedValue({ output: "", exitCode: 1, durationMs: 500 });

    const result = await classifier.classify("何かして");

    expect(result.target).toBe("worker");
  });

  it("should use maxTurns: 1 for fast classification", async () => {
    mockRun.mockResolvedValue({ output: "{}", exitCode: 0, durationMs: 500 });
    mockParseJsonOutput.mockReturnValue({ target: "worker", response: "" });

    await classifier.classify("テストを書いて");

    const callArgs = mockRun.mock.calls[0][0];
    expect(callArgs.maxTurns).toBe(1);
  });
});
