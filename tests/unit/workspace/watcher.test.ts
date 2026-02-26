import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Watcher } from "../../../src/workspace/watcher.js";

describe("Watcher", () => {
  let tmpDir: string;
  let watcher: Watcher;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manju-watch-test-"));
    watcher = new Watcher("test-watcher");
  });

  afterEach(async () => {
    watcher.stop();
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("should detect new files", async () => {
    const detected: string[] = [];
    watcher.watchDirectory(tmpDir, (filename) => {
      detected.push(filename);
    }, 100);

    // Wait for initial scan
    await sleep(150);

    // Create a new file
    fs.writeFileSync(path.join(tmpDir, "test.json"), '{"hello": "world"}');

    // Wait for detection
    await sleep(250);

    expect(detected).toContain("test.json");
  });

  it("should detect modified files", async () => {
    // Create initial file
    fs.writeFileSync(path.join(tmpDir, "existing.json"), '{"v": 1}');

    await sleep(50);

    const detected: string[] = [];
    watcher.watchDirectory(tmpDir, (filename) => {
      detected.push(filename);
    }, 100);

    // Wait for initial scan
    await sleep(150);

    // Modify the file (ensure mtime changes)
    await sleep(50);
    fs.writeFileSync(path.join(tmpDir, "existing.json"), '{"v": 2}');

    // Wait for detection
    await sleep(250);

    expect(detected).toContain("existing.json");
  });

  it("should ignore non-JSON files", async () => {
    const detected: string[] = [];
    watcher.watchDirectory(tmpDir, (filename) => {
      detected.push(filename);
    }, 100);

    await sleep(150);

    fs.writeFileSync(path.join(tmpDir, "readme.txt"), "hello");

    await sleep(250);

    expect(detected).not.toContain("readme.txt");
  });

  it("should ignore temp files", async () => {
    const detected: string[] = [];
    watcher.watchDirectory(tmpDir, (filename) => {
      detected.push(filename);
    }, 100);

    await sleep(150);

    fs.writeFileSync(path.join(tmpDir, ".tmp-abc123.json"), '{}');

    await sleep(250);

    expect(detected.some((f) => f.startsWith(".tmp-"))).toBe(false);
  });

  it("should stop watching", async () => {
    const detected: string[] = [];
    watcher.watchDirectory(tmpDir, (filename) => {
      detected.push(filename);
    }, 100);

    await sleep(150);
    watcher.stop();

    fs.writeFileSync(path.join(tmpDir, "after-stop.json"), '{}');
    await sleep(250);

    expect(detected).not.toContain("after-stop.json");
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
