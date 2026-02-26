import { describe, it, expect } from "vitest";
import { generateLayoutCommands } from "../../../src/tmux/layout.js";
import { DEFAULT_TEAM } from "../../../src/types.js";

describe("generateLayoutCommands", () => {
  const sessionName = "manju";
  const cwd = "/tmp/test";

  it("should not use tiled layout", () => {
    const cmds = generateLayoutCommands(sessionName, DEFAULT_TEAM, cwd);
    const hasTiled = cmds.some((c) => c.includes("select-layout") && c.includes("tiled"));
    expect(hasTiled).toBe(false);
  });

  it("should generate correct commands for default team (2 inv, 2 impl, 1 tester)", () => {
    const cmds = generateLayoutCommands(sessionName, DEFAULT_TEAM, cwd);
    const splits = cmds.filter((c) => c.includes("split-window"));

    // Command sequence for default team:
    // 0: row split (top/bottom) -v at pane 0
    // 1: row split (row1/row2) -v at pane 1
    // 2: coordinator/investigator h-split at pane 0
    // 3: investigator v-split at pane 1
    // 4: implementer h-split at pane 3
    expect(splits[0]).toContain(":0.0 -v");
    expect(splits[1]).toContain(":0.1 -v");
    expect(splits[2]).toContain(":0.0 -h");
    expect(splits[3]).toContain(":0.1 -v");
    expect(splits[4]).toContain(":0.3 -h");

    // Should select coordinator pane at the end
    const lastCmd = cmds[cmds.length - 1];
    expect(lastCmd).toContain("select-pane");
    expect(lastCmd).toContain(":0.0");
  });

  it("should produce 5 split commands for default team (6 panes = 5 splits)", () => {
    const cmds = generateLayoutCommands(sessionName, DEFAULT_TEAM, cwd);
    const splits = cmds.filter((c) => c.includes("split-window"));
    // 2 row splits + 1 h-split (coordinator/inv) + 1 v-split (inv) + 1 h-split (impl) = 5
    expect(splits).toHaveLength(5);
  });

  it("should handle 3 investigators correctly", () => {
    const team = { investigators: 3, implementers: 2, testers: 1 };
    const cmds = generateLayoutCommands(sessionName, team, cwd);
    const splits = cmds.filter((c) => c.includes("split-window"));
    // 2 row splits + 1 h-split (coord/inv) + 2 v-split (inv) + 1 h-split (impl) = 6
    expect(splits).toHaveLength(6);
  });

  it("should handle 1 investigator correctly", () => {
    const team = { investigators: 1, implementers: 2, testers: 1 };
    const cmds = generateLayoutCommands(sessionName, team, cwd);
    const splits = cmds.filter((c) => c.includes("split-window"));
    // 2 row splits + 1 h-split (coord/inv) + 0 v-split (inv) + 1 h-split (impl) = 4
    expect(splits).toHaveLength(4);
  });

  it("should handle zero implementers (2 rows only)", () => {
    const team = { investigators: 2, implementers: 0, testers: 1 };
    const cmds = generateLayoutCommands(sessionName, team, cwd);
    const splits = cmds.filter((c) => c.includes("split-window"));
    // 1 row split + 1 h-split (coord/inv) + 1 v-split (inv) = 3
    expect(splits).toHaveLength(3);
  });

  it("should handle zero testers (2 rows only)", () => {
    const team = { investigators: 2, implementers: 2, testers: 0 };
    const cmds = generateLayoutCommands(sessionName, team, cwd);
    const splits = cmds.filter((c) => c.includes("split-window"));
    // 1 row split + 1 h-split (coord/inv) + 1 v-split (inv) + 1 h-split (impl) = 4
    expect(splits).toHaveLength(4);
  });

  it("should handle single row (only coordinator + investigators)", () => {
    const team = { investigators: 2, implementers: 0, testers: 0 };
    const cmds = generateLayoutCommands(sessionName, team, cwd);
    const splits = cmds.filter((c) => c.includes("split-window"));
    // 0 row splits + 1 h-split (coord/inv) + 1 v-split (inv) = 2
    expect(splits).toHaveLength(2);
  });

  it("should use percentage-based splits, not tiled layout", () => {
    const cmds = generateLayoutCommands(sessionName, DEFAULT_TEAM, cwd);
    for (const cmd of cmds) {
      if (cmd.includes("split-window")) {
        expect(cmd).toContain("-p ");
      }
    }
  });

  it("should include cwd in all split commands", () => {
    const cmds = generateLayoutCommands(sessionName, DEFAULT_TEAM, cwd);
    for (const cmd of cmds) {
      if (cmd.includes("split-window")) {
        expect(cmd).toContain(`-c "${cwd}"`);
      }
    }
  });
});
