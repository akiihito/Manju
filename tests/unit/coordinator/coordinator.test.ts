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
