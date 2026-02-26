import { execSync, spawn } from "node:child_process";
import { TmuxError } from "../utils/errors.js";
import { Logger } from "../utils/logger.js";
import { calculateLayout, getTotalPanes } from "./layout.js";
import type { TeamConfig } from "../types.js";

const SESSION_NAME = "manju";

export class TmuxSessionManager {
  private logger: Logger;
  private sessionName: string;

  constructor(sessionName: string = SESSION_NAME) {
    this.sessionName = sessionName;
    this.logger = new Logger("tmux");
  }

  /** Check if tmux is available */
  checkTmux(): boolean {
    try {
      execSync("tmux -V", { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  /** Check if a session already exists */
  sessionExists(): boolean {
    try {
      execSync(`tmux has-session -t ${this.sessionName} 2>/dev/null`, { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  /** Create a new tmux session with the specified layout */
  createSession(team: TeamConfig, cwd: string): void {
    if (!this.checkTmux()) {
      throw new TmuxError("tmux is not installed or not available in PATH");
    }

    if (this.sessionExists()) {
      throw new TmuxError(
        `Session "${this.sessionName}" already exists. Run "manju stop" first.`,
      );
    }

    const layout = calculateLayout(team);
    const totalPanes = getTotalPanes(team);

    this.logger.info(`Creating session "${this.sessionName}" with ${totalPanes} panes`);

    // Create session with first pane (coordinator)
    this.exec(
      `tmux new-session -d -s ${this.sessionName} -x 200 -y 50 -c "${cwd}"`,
    );

    // Rename first pane's window
    this.exec(`tmux rename-window -t ${this.sessionName} "manju"`);

    // Create the layout: split into rows, then split rows into columns
    // Row 0 already exists (first pane). We need to create row 1 and row 2 by horizontal splits.

    const rows = layout.rows;

    // Create additional rows by splitting horizontally
    for (let r = 1; r < rows.length; r++) {
      this.exec(
        `tmux split-window -t ${this.sessionName} -v -c "${cwd}"`,
      );
    }

    // Now we have N horizontal panes (one per row). We need to split each row vertically.
    // After horizontal splits, pane indices are 0, 1, 2, ...
    // We'll go row by row and split for additional columns.

    // Even out the row heights
    this.exec(`tmux select-layout -t ${this.sessionName} tiled`);

    // Get current pane count before vertical splits
    // At this point we have rows.length panes (one per row)
    let currentPaneIdx = 0;

    for (let r = 0; r < rows.length; r++) {
      const rowPanes = rows[r];
      // First pane in row already exists
      // Split for additional panes in this row
      for (let c = 1; c < rowPanes.length; c++) {
        this.exec(
          `tmux split-window -t ${this.sessionName}:0.${currentPaneIdx} -h -c "${cwd}"`,
        );
      }
      currentPaneIdx += rowPanes.length;
    }

    // Apply tiled layout for even distribution, then we'll rely on tmux's even split
    this.exec(`tmux select-layout -t ${this.sessionName} tiled`);

    // Select the first pane (coordinator)
    this.exec(`tmux select-pane -t ${this.sessionName}:0.0`);

    this.logger.info("Session created successfully");
  }

  /** Send a command to a specific pane */
  sendCommand(paneIndex: number, command: string): void {
    this.exec(
      `tmux send-keys -t ${this.sessionName}:0.${paneIndex} "${this.escapeForTmux(command)}" Enter`,
    );
  }

  /** Start worker processes in their respective panes */
  startWorkers(paneNames: string[], cwd: string, binPath: string): void {
    for (let i = 0; i < paneNames.length; i++) {
      const name = paneNames[i];
      if (name === "coordinator") {
        // Coordinator runs interactively
        this.sendCommand(i, `node "${binPath}" coordinator --cwd "${cwd}"`);
      } else {
        // Workers run as daemons
        const [role] = name.split("-");
        this.sendCommand(
          i,
          `node "${binPath}" worker --name "${name}" --role "${role}" --cwd "${cwd}"`,
        );
      }
    }
  }

  /** Kill the session */
  killSession(): void {
    if (this.sessionExists()) {
      this.exec(`tmux kill-session -t ${this.sessionName}`);
      this.logger.info("Session killed");
    }
  }

  /** Attach to the session */
  attach(): void {
    const child = spawn("tmux", ["attach-session", "-t", this.sessionName], {
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      process.exit(code ?? 0);
    });
  }

  private exec(cmd: string): string {
    try {
      return execSync(cmd, { encoding: "utf-8", stdio: "pipe" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new TmuxError(`tmux command failed: ${cmd}\n${message}`);
    }
  }

  private escapeForTmux(str: string): string {
    return str.replace(/"/g, '\\"').replace(/\$/g, "\\$");
  }
}
