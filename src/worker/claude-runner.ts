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
    try {
      // claude --output-format json wraps result in a JSON object
      const parsed = JSON.parse(output);
      // The result field contains the actual output
      if (parsed.result !== undefined) {
        // If result is a string that looks like JSON, try parsing it
        if (typeof parsed.result === "string") {
          try {
            return JSON.parse(parsed.result) as T;
          } catch {
            return parsed.result as T;
          }
        }
        return parsed.result as T;
      }
      return parsed as T;
    } catch (err) {
      throw new ClaudeRunnerError(`Failed to parse claude output: ${err}`);
    }
  }
}
