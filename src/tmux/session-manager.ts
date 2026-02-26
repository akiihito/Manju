import { execSync, spawn } from "node:child_process";
import { TmuxError } from "../utils/errors.js";
import { Logger } from "../utils/logger.js";
import { generateLayoutCommands, getTotalPanes } from "./layout.js";
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

    const totalPanes = getTotalPanes(team);

    this.logger.info(`Creating session "${this.sessionName}" with ${totalPanes} panes`);

    // Create session with first pane (coordinator)
    this.exec(
      `tmux new-session -d -s ${this.sessionName} -x 200 -y 50 -c "${cwd}"`,
    );

    // Rename first pane's window
    this.exec(`tmux rename-window -t ${this.sessionName} "manju"`);

    // Apply the layout using explicit percentage-based splits
    const layoutCmds = generateLayoutCommands(this.sessionName, team, cwd);
    for (const cmd of layoutCmds) {
      this.exec(cmd);
    }

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
