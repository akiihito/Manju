import { ClaudeRunner } from "../worker/claude-runner.js";
import { INPUT_CLASSIFICATION_SCHEMA } from "../schemas.js";
import { Logger } from "../utils/logger.js";
import type { InputClassification, TeamConfig } from "../types.js";

export interface ClassifierContext {
  teamConfig?: TeamConfig;
  taskSummary?: string;
  directives?: string;
}

export class InputClassifier {
  private claudeRunner: ClaudeRunner;
  private logger: Logger;

  constructor() {
    this.claudeRunner = new ClaudeRunner("input-classifier");
    this.logger = new Logger("input-classifier");
  }

  /**
   * Classify user input as coordinator-directed or worker-directed.
   * Falls back to "worker" on error.
   */
  async classify(
    input: string,
    context?: ClassifierContext,
  ): Promise<InputClassification> {
    try {
      const prompt = this.buildPrompt(input, context);

      const result = await this.claudeRunner.run({
        prompt,
        systemPrompt: [
          "You are an input classifier for a multi-agent orchestration system called Manju.",
          "Your job is to determine whether user input is directed at the coordinator (the orchestration system itself) or should be dispatched to workers (AI agents that perform development tasks).",
          "",
          "Classify as 'coordinator' when the user:",
          "- Asks about the current session, team configuration, or task status",
          "- Asks a general question not related to a specific coding task",
          "- Wants to change settings or configuration",
          "- Asks about how Manju works or what it can do",
          "",
          "Classify as 'worker' when the user:",
          "- Requests code changes, implementation, refactoring, or bug fixes",
          "- Asks for code investigation or analysis",
          "- Requests tests to be written or run",
          "- Gives any instruction that requires working with the codebase",
          "",
          "When target is 'coordinator', provide a helpful response in the same language as the user's input.",
          "When target is 'worker', set response to an empty string.",
          "Output valid JSON matching the provided schema.",
        ].join("\n"),
        jsonSchema: INPUT_CLASSIFICATION_SCHEMA,
        maxTurns: 1,
      });

      if (result.exitCode !== 0) {
        this.logger.warn(`Classification failed with exit code ${result.exitCode}, defaulting to worker`);
        return { target: "worker", response: "" };
      }

      return this.claudeRunner.parseJsonOutput<InputClassification>(result.output);
    } catch (err) {
      this.logger.warn(`Classification error: ${err}, defaulting to worker`);
      return { target: "worker", response: "" };
    }
  }

  private buildPrompt(input: string, context?: ClassifierContext): string {
    const parts: string[] = [
      "## User Input",
      input,
    ];

    if (context?.teamConfig) {
      const tc = context.teamConfig;
      parts.push(
        "",
        "## Current Team Configuration",
        `investigators: ${tc.investigators}, implementers: ${tc.implementers}, testers: ${tc.testers}`,
      );
    }

    if (context?.taskSummary) {
      parts.push(
        "",
        "## Current Task Status",
        context.taskSummary,
      );
    }

    if (context?.directives) {
      parts.push(
        "",
        "## Project Directives (CLAUDE.md)",
        context.directives,
      );
    }

    return parts.join("\n");
  }
}
