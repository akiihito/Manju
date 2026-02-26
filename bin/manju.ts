#!/usr/bin/env node

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { TmuxSessionManager } from "../src/tmux/session-manager.js";
import { Coordinator } from "../src/coordinator/index.js";
import { WorkerDaemon } from "../src/worker/daemon.js";
import { FileStore } from "../src/workspace/file-store.js";
import { getPaneNames } from "../src/tmux/layout.js";
import { Logger } from "../src/utils/logger.js";
import { DEFAULT_TEAM } from "../src/types.js";
import type { TeamConfig, WorkerRole } from "../src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = new Logger("cli");

function printUsage(): void {
  console.log(`
Manju - Multi-Agent Orchestration Framework

Usage:
  manju start [--cwd <path>]       Start a new orchestration session
  manju stop                        Stop the current session
  manju status                      Show session status
  manju coordinator --cwd <path>   Run coordinator (internal)
  manju worker --name <n> --role <r> --cwd <path>  Run worker (internal)

Options:
  --cwd <path>        Working directory (default: current directory)
  --investigators <n> Number of investigators (default: 2)
  --implementers <n>  Number of implementers (default: 2)
  --testers <n>       Number of testers (default: 1)
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true";
      parsed[key] = value;
      if (value !== "true") i++;
    } else if (!parsed._command) {
      parsed._command = args[i];
    }
  }
  return parsed;
}

function getTeamConfig(args: Record<string, string>): TeamConfig {
  return {
    investigators: parseInt(args.investigators || String(DEFAULT_TEAM.investigators), 10),
    implementers: parseInt(args.implementers || String(DEFAULT_TEAM.implementers), 10),
    testers: parseInt(args.testers || String(DEFAULT_TEAM.testers), 10),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args._command;

  if (!command || command === "help") {
    printUsage();
    process.exit(0);
  }

  const cwd = args.cwd || process.cwd();

  switch (command) {
    case "start": {
      const team = getTeamConfig(args);
      const tmux = new TmuxSessionManager();

      // Initialize workspace
      const store = new FileStore(cwd);
      await store.init();
      await store.writeSession({
        id: `session-${Date.now()}`,
        started_at: new Date().toISOString(),
        working_directory: cwd,
        team,
        status: "active",
      });

      // Create tmux session
      const binPath = path.resolve(__dirname, "manju.js");
      tmux.createSession(team, cwd);

      // Start processes in panes
      const paneNames = getPaneNames(team);
      tmux.startWorkers(paneNames, cwd, binPath);

      // Attach to session
      logger.info("Session started. Attaching...");
      tmux.attach();
      break;
    }

    case "stop": {
      const tmux = new TmuxSessionManager();
      tmux.killSession();
      logger.info("Session stopped.");
      break;
    }

    case "status": {
      const store = new FileStore(cwd);
      try {
        const session = await store.readSession();
        console.log(`Session: ${session.id}`);
        console.log(`Started: ${session.started_at}`);
        console.log(`Status: ${session.status}`);
        console.log(`Team: ${JSON.stringify(session.team)}`);
        const tasks = await store.listTasks();
        console.log(`Tasks: ${tasks.length}`);
        for (const t of tasks) {
          console.log(`  [${t.status}] ${t.assignee}: ${t.title}`);
        }
      } catch {
        console.log("No active session found.");
      }
      break;
    }

    case "coordinator": {
      const team = getTeamConfig(args);
      const coordinator = new Coordinator(cwd, team);
      await coordinator.start();
      break;
    }

    case "worker": {
      const name = args.name;
      const role = args.role as WorkerRole;
      if (!name || !role) {
        console.error("Worker requires --name and --role");
        process.exit(1);
      }
      const daemon = new WorkerDaemon(name, role, cwd);
      await daemon.start();
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  logger.error(`Fatal: ${err}`);
  process.exit(1);
});
