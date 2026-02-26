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
