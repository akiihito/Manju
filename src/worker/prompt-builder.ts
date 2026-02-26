import type { WorkerRole, SharedContext, Task } from "../types.js";

const ROLE_SYSTEM_PROMPTS: Record<WorkerRole, string> = {
  investigator: `You are an Investigator agent in a multi-agent development team.
Your job is to analyze code, research project structure, and gather information.
You should:
- Read and understand code thoroughly
- Report findings clearly and concisely
- Identify key patterns, dependencies, and architectural decisions
- Provide actionable information for implementers
Do NOT modify any files. Only read and analyze.`,

  implementer: `You are an Implementer agent in a multi-agent development team.
Your job is to write and modify code based on instructions and context from investigators.
You should:
- Write clean, well-structured code
- Follow existing project conventions
- Create or modify only the files needed
- Report what files you created or changed
Focus on implementation quality and correctness.`,

  tester: `You are a Tester agent in a multi-agent development team.
Your job is to write tests and verify implementations.
You should:
- Write comprehensive test cases
- Run existing tests and report results
- Identify edge cases and potential issues
- Verify that implementations match requirements
Focus on test coverage and finding bugs.`,
};

export class PromptBuilder {
  /** Get the system prompt for a given worker role */
  getSystemPrompt(role: WorkerRole): string {
    return ROLE_SYSTEM_PROMPTS[role];
  }

  /** Build the task execution prompt including context */
  buildTaskPrompt(task: Task, sharedContext?: SharedContext): string {
    let prompt = `# Task: ${task.title}\n\n`;
    prompt += `${task.description}\n`;

    if (task.context) {
      prompt += `\n## Additional Context\n${task.context}\n`;
    }

    if (sharedContext && sharedContext.entries.length > 0) {
      prompt += `\n## Shared Context from Other Agents\n`;
      for (const entry of sharedContext.entries) {
        prompt += `\n### From ${entry.from} (${entry.task_id})\n${entry.summary}\n`;
      }
    }

    return prompt;
  }

  /** Build the coordinator's task planning prompt */
  buildPlanningPrompt(userRequest: string, contextSummary?: string, directives?: string[]): string {
    let prompt = `# User Request\n\n${userRequest}\n\n`;
    prompt += `Break this request into concrete tasks for a development team.\n`;
    prompt += `Available roles:\n`;
    prompt += `- investigator: Code analysis, research, information gathering (read-only)\n`;
    prompt += `- implementer: Code writing and modification\n`;
    prompt += `- tester: Test writing and execution\n\n`;
    prompt += `Consider task dependencies - investigation should come before implementation, and testing after implementation.\n`;
    prompt += `Use the exact task title in the dependencies array to reference dependent tasks.\n`;

    if (contextSummary) {
      prompt += `\n## Current Project Context\n${contextSummary}\n`;
    }

    if (directives && directives.length > 0) {
      prompt += `\n## Coordinator Directives\n`;
      for (const d of directives) {
        prompt += `- ${d}\n`;
      }
    }

    return prompt;
  }
}
