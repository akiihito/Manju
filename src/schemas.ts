/** JSON Schema for task plan output from claude -p */
export const TASK_PLAN_SCHEMA = {
  type: "object" as const,
  properties: {
    tasks: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const, description: "Short task title" },
          description: {
            type: "string" as const,
            description: "Detailed task description with instructions",
          },
          role: {
            type: "string" as const,
            enum: ["investigator", "implementer", "tester"],
            description: "Worker role to assign this task to",
          },
          dependencies: {
            type: "array" as const,
            items: { type: "string" as const },
            description:
              "Titles of tasks that must complete before this one (use exact titles)",
          },
        },
        required: ["title", "description", "role", "dependencies"],
      },
      description: "List of tasks to execute",
    },
    summary: {
      type: "string" as const,
      description: "Brief summary of the overall plan",
    },
  },
  required: ["tasks", "summary"],
};

/** JSON Schema for worker task result from claude -p */
export const TASK_RESULT_SCHEMA = {
  type: "object" as const,
  properties: {
    output: {
      type: "string" as const,
      description: "Main output/result of the task",
    },
    artifacts: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          path: { type: "string" as const, description: "File path" },
          action: {
            type: "string" as const,
            enum: ["created", "modified", "deleted"],
          },
        },
        required: ["path", "action"],
      },
      description: "Files created, modified, or deleted",
    },
    context_contribution: {
      type: "string" as const,
      description:
        "Key information discovered that other workers should know about",
    },
  },
  required: ["output", "artifacts", "context_contribution"],
};
