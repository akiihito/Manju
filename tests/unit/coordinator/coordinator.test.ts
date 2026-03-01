import { describe, it, expect, vi } from "vitest";
import { TmuxSessionManager } from "../../../src/tmux/session-manager.js";

describe("Coordinator shutdown", () => {
  it("TmuxSessionManager.killSession should call tmux kill-session", () => {
    const mgr = new TmuxSessionManager("test-session");

    // Mock the private exec method to capture commands
    const execCalls: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mgr as any).exec = (cmd: string) => {
      execCalls.push(cmd);
      return "";
    };
    // Mock sessionExists to return true
    mgr.sessionExists = () => true;

    mgr.killSession();

    expect(execCalls).toHaveLength(1);
    expect(execCalls[0]).toContain("tmux kill-session -t test-session");
  });

  it("TmuxSessionManager.killSession should be a no-op if session does not exist", () => {
    const mgr = new TmuxSessionManager("test-session");

    const execCalls: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mgr as any).exec = (cmd: string) => {
      execCalls.push(cmd);
      return "";
    };
    mgr.sessionExists = () => false;

    mgr.killSession();

    expect(execCalls).toHaveLength(0);
  });

  it("Coordinator should accept an onShutdown callback", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");

    // Mock process.exit to prevent test from exiting
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    let shutdownCalled = false;
    const onShutdown = () => {
      shutdownCalled = true;
    };

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    }, onShutdown);

    coord.shutdown();

    expect(shutdownCalled).toBe(true);
    expect(exitMock).toHaveBeenCalledWith(0);

    exitMock.mockRestore();
  });
});

describe("Coordinator command routing", () => {
  it("/status should call printStatus", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    // Spy on printStatus (private method, accessed via any)
    const printStatusSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).printStatus = printStatusSpy;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).routeInput("/status");

    expect(printStatusSpy).toHaveBeenCalled();

    exitMock.mockRestore();
  });

  it("/quit should call shutdown", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    const shutdownSpy = vi.fn();
    coord.shutdown = shutdownSpy;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (coord as any).routeInput("/quit");

    expect(shutdownSpy).toHaveBeenCalled();
    expect(result).toBe("shutdown");

    exitMock.mockRestore();
  });

  it("/exit should call shutdown", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    const shutdownSpy = vi.fn();
    coord.shutdown = shutdownSpy;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (coord as any).routeInput("/exit");

    expect(shutdownSpy).toHaveBeenCalled();
    expect(result).toBe("shutdown");

    exitMock.mockRestore();
  });

  it("/help should output help text", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).routeInput("/help");

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("/status");
    expect(output).toContain("/quit");
    expect(output).toContain("/help");
    expect(output).toContain("/directives");

    consoleSpy.mockRestore();
    exitMock.mockRestore();
  });

  it("/directives should show CLAUDE.md content when loaded", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    // Set directives as if loaded from CLAUDE.md
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).directives = "# Rules\n- 日本語で応答して\n- テストは不要";

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).routeInput("/directives");

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("日本語で応答して");
    expect(output).toContain("テストは不要");

    consoleSpy.mockRestore();
    exitMock.mockRestore();
  });

  it("/directives should show 'no directives' when CLAUDE.md not found", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).routeInput("/directives");

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("No directives");

    consoleSpy.mockRestore();
    exitMock.mockRestore();
  });

  it("unknown /command should be treated as task request", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    const handleRequestSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).handleRequest = handleRequestSpy;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).routeInput("/ここからは日本語で");

    expect(handleRequestSpy).toHaveBeenCalledWith("/ここからは日本語で");

    exitMock.mockRestore();
  });

  it("input without / prefix should call handleRequest", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    const handleRequestSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).handleRequest = handleRequestSpy;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).routeInput("Add login feature");

    expect(handleRequestSpy).toHaveBeenCalledWith("Add login feature");

    exitMock.mockRestore();
  });

  it("legacy 'status' (without /) should still call printStatus for backward compat", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    const printStatusSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).printStatus = printStatusSpy;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).routeInput("status");

    expect(printStatusSpy).toHaveBeenCalled();

    exitMock.mockRestore();
  });

  it("legacy 'quit' (without /) should still call shutdown for backward compat", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    const shutdownSpy = vi.fn();
    coord.shutdown = shutdownSpy;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (coord as any).routeInput("quit");

    expect(shutdownSpy).toHaveBeenCalled();
    expect(result).toBe("shutdown");

    exitMock.mockRestore();
  });

  it("handleResult should call complianceChecker.check on success with directives", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    // Set up a current task
    const task = {
      id: "task-123",
      title: "Test task",
      description: "A test task",
      role: "implementer" as const,
      assignee: "implementer-1",
      status: "running" as const,
      dependencies: [],
      context: "",
      created_at: new Date().toISOString(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).currentTasks = [task];

    // Set directives (as if loaded from CLAUDE.md)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).directives = "日本語で応答して";

    // Mock store.readResult
    const mockResult = {
      task_id: "task-123",
      status: "success",
      output: "Done",
      artifacts: [],
      context_contribution: "context",
      cost_usd: 0.01,
      duration_ms: 1000,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).store.readResult = vi.fn().mockResolvedValue(mockResult);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).store.writeTask = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).contextManager.addFromResult = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).scheduler.resolveDependencies = vi.fn().mockResolvedValue([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).scheduler.isAllComplete = vi.fn().mockReturnValue(false);

    // Mock complianceChecker.check
    const checkSpy = vi.fn().mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).complianceChecker.check = checkSpy;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).handleResult("task-123.json");

    expect(checkSpy).toHaveBeenCalledWith(mockResult, task, "日本語で応答して");

    exitMock.mockRestore();
  });

  it("handleResult should not call complianceChecker.check when no directives", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    const task = {
      id: "task-456",
      title: "Test task",
      description: "A test task",
      role: "implementer" as const,
      assignee: "implementer-1",
      status: "running" as const,
      dependencies: [],
      context: "",
      created_at: new Date().toISOString(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).currentTasks = [task];

    const mockResult = {
      task_id: "task-456",
      status: "success",
      output: "Done",
      artifacts: [],
      context_contribution: "context",
      cost_usd: 0.01,
      duration_ms: 1000,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).store.readResult = vi.fn().mockResolvedValue(mockResult);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).store.writeTask = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).contextManager.addFromResult = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).scheduler.resolveDependencies = vi.fn().mockResolvedValue([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).scheduler.isAllComplete = vi.fn().mockReturnValue(false);

    const checkSpy = vi.fn().mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).complianceChecker.check = checkSpy;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).handleResult("task-456.json");

    expect(checkSpy).not.toHaveBeenCalled();

    exitMock.mockRestore();
  });

  it("handleResult should log violations when non-compliant", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    const task = {
      id: "task-789",
      title: "Test task",
      description: "A test task",
      role: "implementer" as const,
      assignee: "implementer-1",
      status: "running" as const,
      dependencies: [],
      context: "",
      created_at: new Date().toISOString(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).currentTasks = [task];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).directives = "日本語で応答して";

    const mockResult = {
      task_id: "task-789",
      status: "success",
      output: "Done",
      artifacts: [],
      context_contribution: "context",
      cost_usd: 0.01,
      duration_ms: 1000,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).store.readResult = vi.fn().mockResolvedValue(mockResult);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).store.writeTask = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).contextManager.addFromResult = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).scheduler.resolveDependencies = vi.fn().mockResolvedValue([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).scheduler.isAllComplete = vi.fn().mockReturnValue(false);

    const checkSpy = vi.fn().mockResolvedValue({
      compliant: false,
      violations: [{ directive: "日本語で応答して", reason: "Output is in English" }],
      summary: "Language mismatch",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).complianceChecker.check = checkSpy;

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).handleResult("task-789.json");

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("Compliance");
    expect(output).toContain("Language mismatch");
    expect(output).toContain("日本語で応答して");

    consoleSpy.mockRestore();
    exitMock.mockRestore();
  });
});
