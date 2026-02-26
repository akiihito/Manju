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

  it("/ + free text should add a directive", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).routeInput("/ここからは日本語で");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((coord as any).directives).toContain("ここからは日本語で");

    exitMock.mockRestore();
  });

  it("/directives should list current directives", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    // Add some directives first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).directives = ["日本語で応答して", "テストは不要"];

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (coord as any).routeInput("/directives");

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("日本語で応答して");
    expect(output).toContain("テストは不要");

    consoleSpy.mockRestore();
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

  it("directives should be passed to handleRequest context", async () => {
    const { Coordinator } = await import("../../../src/coordinator/index.js");
    const exitMock = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    const coord = new Coordinator("/tmp/test", {
      investigators: 1,
      implementers: 1,
      testers: 1,
    });

    // Add a directive
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coord as any).directives = ["日本語で応答して"];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((coord as any).directives).toEqual(["日本語で応答して"]);

    exitMock.mockRestore();
  });
});
