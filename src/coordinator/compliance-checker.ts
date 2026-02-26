import { ClaudeRunner } from "../worker/claude-runner.js";
import { COMPLIANCE_CHECK_SCHEMA } from "../schemas.js";
import { Logger } from "../utils/logger.js";
import type { TaskResult, Task, ComplianceResult } from "../types.js";

export class ComplianceChecker {
  private claudeRunner: ClaudeRunner;
  private logger: Logger;

  constructor() {
    this.claudeRunner = new ClaudeRunner("compliance-checker");
    this.logger = new Logger("compliance-checker");
  }

  /**
   * Check whether a task result complies with the given directives.
   * Returns null if check is skipped (no directives, failure result, or error).
   */
  async check(
    result: TaskResult,
    task: Task,
    directives: string[],
  ): Promise<ComplianceResult | null> {
    if (directives.length === 0) return null;
    if (result.status !== "success") return null;

    try {
      const prompt = this.buildPrompt(result, task, directives);

      const runResult = await this.claudeRunner.run({
        prompt,
        systemPrompt:
          "You are a compliance checker. Evaluate whether a task output complies with the given directives. Output valid JSON matching the provided schema.",
        jsonSchema: COMPLIANCE_CHECK_SCHEMA,
        maxTurns: 1,
      });

      if (runResult.exitCode !== 0) {
        this.logger.warn(`Compliance check failed with exit code ${runResult.exitCode}`);
        return null;
      }

      return this.claudeRunner.parseJsonOutput<ComplianceResult>(runResult.output);
    } catch (err) {
      this.logger.warn(`Compliance check error: ${err}`);
      return null;
    }
  }

  private buildPrompt(
    result: TaskResult,
    task: Task,
    directives: string[],
  ): string {
    const directiveList = directives.map((d, i) => `${i + 1}. ${d}`).join("\n");
    return [
      "## Directives",
      directiveList,
      "",
      "## Task",
      `Title: ${task.title}`,
      `Description: ${task.description}`,
      "",
      "## Task Output",
      result.output,
      "",
      "## Instructions",
      "Check whether the task output complies with ALL of the directives above.",
      "For each violated directive, provide the directive text and reason for violation.",
      "If all directives are satisfied, set compliant to true with an empty violations array.",
    ].join("\n");
  }
}
