import { spawn } from "node:child_process";
import { ClaudeRunnerError } from "../utils/errors.js";
import { Logger } from "../utils/logger.js";

export interface ClaudeRunOptions {
  prompt: string;
  systemPrompt?: string;
  jsonSchema?: object;
  maxTurns?: number;
  cwd?: string;
}

export interface ClaudeRunResult {
  output: string;
  exitCode: number;
  durationMs: number;
}

export class ClaudeRunner {
  private logger: Logger;

  constructor(logPrefix: string = "claude-runner") {
    this.logger = new Logger(logPrefix);
  }

  /** Build command-line arguments for claude -p */
  buildArgs(options: ClaudeRunOptions): string[] {
    const args: string[] = ["-p", "--output-format", "json"];

    if (options.systemPrompt) {
      args.push("--system-prompt", options.systemPrompt);
    }

    if (options.jsonSchema) {
      args.push("--json-schema", JSON.stringify(options.jsonSchema));
    }

    if (options.maxTurns) {
      args.push("--max-turns", String(options.maxTurns));
    }

    return args;
  }

  /** Run claude -p with the given options */
  async run(options: ClaudeRunOptions): Promise<ClaudeRunResult> {
    const args = this.buildArgs(options);
    const startTime = Date.now();

    this.logger.info(`Running claude with prompt: ${options.prompt.slice(0, 100)}...`);

    return new Promise<ClaudeRunResult>((resolve, reject) => {
      const proc = spawn("claude", args, {
        cwd: options.cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        process.stdout.write(chunk);
      });

      proc.stderr.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        process.stderr.write(chunk);
      });

      // Send prompt via stdin
      proc.stdin.write(options.prompt);
      proc.stdin.end();

      proc.on("error", (err) => {
        reject(new ClaudeRunnerError(`Failed to spawn claude: ${err.message}`));
      });

      proc.on("close", (code) => {
        const durationMs = Date.now() - startTime;
        const exitCode = code ?? 1;

        if (exitCode !== 0) {
          this.logger.error(`claude exited with code ${exitCode}: ${stderr}`);
        }

        resolve({
          output: stdout,
          exitCode,
          durationMs,
        });
      });
    });
  }

  /** Parse JSON output from claude --output-format json */
  parseJsonOutput<T>(output: string): T {
    // Try parsing as a single JSON object first
    let parsed: Record<string, unknown> | undefined;
    try {
      parsed = JSON.parse(output);
    } catch {
      // Might be NDJSON (multiple JSON lines) — find the result line
      parsed = this.findResultFromNdjson(output);
      if (!parsed) {
        throw new ClaudeRunnerError(
          `Failed to parse claude output: not valid JSON or NDJSON`,
        );
      }
    }

    // Extract result field if present
    if (parsed.result !== undefined) {
      if (typeof parsed.result === "string") {
        return this.parseResultString<T>(parsed.result);
      }
      return parsed.result as T;
    }
    return parsed as T;
  }

  /** Try to parse a result string as JSON, handling markdown code fences */
  private parseResultString<T>(result: string): T {
    // Try direct JSON parse
    try {
      return JSON.parse(result) as T;
    } catch {
      // ignore
    }

    // Try extracting JSON from markdown code fences (```json ... ``` or ``` ... ```)
    const codeFenceMatch = result.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeFenceMatch) {
      try {
        return JSON.parse(codeFenceMatch[1]) as T;
      } catch {
        // ignore
      }
    }

    throw new ClaudeRunnerError(
      `Failed to extract valid JSON from result: ${result.slice(0, 200)}`,
    );
  }

  /** Find the result object from NDJSON output */
  private findResultFromNdjson(
    output: string,
  ): Record<string, unknown> | undefined {
    const lines = output.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === "result" || obj.result !== undefined) {
          return obj;
        }
      } catch {
        // skip non-JSON lines
      }
    }
    return undefined;
  }
}
