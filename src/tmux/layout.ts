import type { TeamConfig, PaneInfo, Layout, Role } from "../types.js";

/**
 * Calculate tmux pane layout for the given team configuration.
 *
 * Layout pattern:
 * +------------------+------------------+
 * |                  | Investigator-1   |
 * |  Coordinator     +------------------+
 * |                  | Investigator-2   |
 * +------------------+------------------+
 * | Implementer-1    | Implementer-2    |
 * +------------------+------------------+
 * |           Tester                    |
 * +-------------------------------------+
 *
 * Row 0: Coordinator (left) + Investigators (right, stacked)
 * Row 1: Implementers (side by side)
 * Row 2: Testers (full width)
 */
export function calculateLayout(team: TeamConfig): Layout {
  const panes: PaneInfo[] = [];
  const rows: PaneInfo[][] = [];
  let paneId = 0;

  // Row 0: Coordinator + Investigators
  const row0: PaneInfo[] = [];
  const coordinatorPane: PaneInfo = {
    id: paneId++,
    role: "coordinator" as Role,
    name: "coordinator",
    width: 50,
    height: Math.max(30, team.investigators * 15),
  };
  row0.push(coordinatorPane);
  panes.push(coordinatorPane);

  for (let i = 1; i <= team.investigators; i++) {
    const pane: PaneInfo = {
      id: paneId++,
      role: "investigator" as Role,
      name: `investigator-${i}`,
      width: 50,
      height: Math.floor(coordinatorPane.height / team.investigators),
    };
    row0.push(pane);
    panes.push(pane);
  }
  rows.push(row0);

  // Row 1: Implementers
  if (team.implementers > 0) {
    const row1: PaneInfo[] = [];
    const implWidth = Math.floor(100 / team.implementers);
    for (let i = 1; i <= team.implementers; i++) {
      const pane: PaneInfo = {
        id: paneId++,
        role: "implementer" as Role,
        name: `implementer-${i}`,
        width: implWidth,
        height: 30,
      };
      row1.push(pane);
      panes.push(pane);
    }
    rows.push(row1);
  }

  // Row 2: Testers
  if (team.testers > 0) {
    const row2: PaneInfo[] = [];
    const testWidth = Math.floor(100 / team.testers);
    for (let i = 1; i <= team.testers; i++) {
      const pane: PaneInfo = {
        id: paneId++,
        role: "tester" as Role,
        name: `tester-${i}`,
        width: testWidth,
        height: 20,
      };
      row2.push(pane);
      panes.push(pane);
    }
    rows.push(row2);
  }

  return { panes, rows };
}

/**
 * Generate the sequence of tmux commands to create the desired layout.
 *
 * Strategy: create row structure first with vertical splits, then split
 * within each row. Uses explicit percentage-based splits instead of
 * "select-layout tiled" to preserve the intended layout proportions.
 *
 * Pane index tracking:
 * - After creating rows, panes are indexed 0, 1, 2 (one per row).
 * - When splitting within a row, all subsequent row panes shift up by 1.
 */
export function generateLayoutCommands(
  sessionName: string,
  team: TeamConfig,
  cwd: string,
): string[] {
  const s = sessionName;
  const cmds: string[] = [];

  const hasImplRow = team.implementers > 0;
  const hasTestRow = team.testers > 0;
  const rowCount = 1 + (hasImplRow ? 1 : 0) + (hasTestRow ? 1 : 0);

  // Step 1: Create row structure by vertical splits
  if (rowCount >= 2) {
    const bottomPercent = rowCount === 3 ? 60 : 50;
    cmds.push(
      `tmux split-window -t ${s}:0.0 -v -p ${bottomPercent} -c "${cwd}"`,
    );
  }
  if (rowCount === 3) {
    cmds.push(
      `tmux split-window -t ${s}:0.1 -v -p 50 -c "${cwd}"`,
    );
  }

  // Step 2: Split Row 0 into Coordinator (left) + Investigators (right)
  let panesAddedRow0 = 0;

  if (team.investigators > 0) {
    cmds.push(
      `tmux split-window -t ${s}:0.0 -h -p 50 -c "${cwd}"`,
    );
    panesAddedRow0++;

    // Split investigator area vertically for multiple investigators
    for (let i = 1; i < team.investigators; i++) {
      const targetPane = i;
      const percent = Math.floor(
        (100 * (team.investigators - i)) / (team.investigators - i + 1),
      );
      cmds.push(
        `tmux split-window -t ${s}:0.${targetPane} -v -p ${percent} -c "${cwd}"`,
      );
      panesAddedRow0++;
    }
  }

  // Step 3: Split Row 1 (Implementers) horizontally
  const row1Start = hasImplRow ? 1 + panesAddedRow0 : -1;
  let panesAddedRow1 = 0;

  if (hasImplRow && team.implementers > 1) {
    for (let i = 1; i < team.implementers; i++) {
      const targetPane = row1Start + i - 1;
      const percent = Math.floor(
        (100 * (team.implementers - i)) / (team.implementers - i + 1),
      );
      cmds.push(
        `tmux split-window -t ${s}:0.${targetPane} -h -p ${percent} -c "${cwd}"`,
      );
      panesAddedRow1++;
    }
  }

  // Step 4: Split Row 2 (Testers) horizontally
  const row2Start = hasTestRow
    ? (hasImplRow ? 2 : 1) + panesAddedRow0 + panesAddedRow1
    : -1;

  if (hasTestRow && team.testers > 1) {
    for (let i = 1; i < team.testers; i++) {
      const targetPane = row2Start + i - 1;
      const percent = Math.floor(
        (100 * (team.testers - i)) / (team.testers - i + 1),
      );
      cmds.push(
        `tmux split-window -t ${s}:0.${targetPane} -h -p ${percent} -c "${cwd}"`,
      );
    }
  }

  // Select coordinator pane
  cmds.push(`tmux select-pane -t ${s}:0.0`);

  return cmds;
}

/** Get total number of panes for a team configuration */
export function getTotalPanes(team: TeamConfig): number {
  return 1 + team.investigators + team.implementers + team.testers;
}

/** Generate pane names for a team configuration */
export function getPaneNames(team: TeamConfig): string[] {
  const names: string[] = ["coordinator"];
  for (let i = 1; i <= team.investigators; i++) names.push(`investigator-${i}`);
  for (let i = 1; i <= team.implementers; i++) names.push(`implementer-${i}`);
  for (let i = 1; i <= team.testers; i++) names.push(`tester-${i}`);
  return names;
}
