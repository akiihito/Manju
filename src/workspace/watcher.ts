import * as fs from "node:fs";
import { Logger } from "../utils/logger.js";

export type WatchCallback = (filename: string) => void;

export class Watcher {
  private logger: Logger;
  private watchers: fs.FSWatcher[] = [];
  private pollingTimers: ReturnType<typeof setInterval>[] = [];

  constructor(logPrefix: string = "watcher") {
    this.logger = new Logger(logPrefix);
  }

  /**
   * Watch a directory for new/changed JSON files using polling.
   * More reliable than fs.watch across platforms.
   */
  watchDirectory(
    dir: string,
    callback: WatchCallback,
    intervalMs: number = 500,
  ): void {
    let knownFiles = new Map<string, number>();

    // Initial scan
    this.scanDir(dir, knownFiles);

    const timer = setInterval(() => {
      const currentFiles = new Map<string, number>();
      this.scanDir(dir, currentFiles);

      for (const [file, mtime] of currentFiles) {
        const prevMtime = knownFiles.get(file);
        if (prevMtime === undefined || prevMtime < mtime) {
          this.logger.debug(`Detected change: ${file}`);
          callback(file);
        }
      }

      knownFiles = currentFiles;
    }, intervalMs);

    this.pollingTimers.push(timer);
  }

  /** Stop all watchers */
  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    for (const timer of this.pollingTimers) {
      clearInterval(timer);
    }
    this.watchers = [];
    this.pollingTimers = [];
  }

  private scanDir(dir: string, out: Map<string, number>): void {
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry.endsWith(".json") && !entry.startsWith(".tmp-")) {
          const fullPath = `${dir}/${entry}`;
          try {
            const stat = fs.statSync(fullPath);
            out.set(entry, stat.mtimeMs);
          } catch {
            // file may have been deleted between readdir and stat
          }
        }
      }
    } catch {
      // directory may not exist yet
    }
  }
}
