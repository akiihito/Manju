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

/** JSON Schema for input classification result */
export const INPUT_CLASSIFICATION_SCHEMA = {
  type: "object" as const,
  properties: {
    target: {
      type: "string" as const,
      enum: ["coordinator", "worker"],
      description:
        "Where to route this input: 'coordinator' if the input is a question or command directed at the orchestration system itself, 'worker' if it is a development task that should be decomposed and dispatched to workers",
    },
    response: {
      type: "string" as const,
      description:
        "When target is 'coordinator', provide a helpful response to the user. When target is 'worker', leave empty.",
    },
  },
  required: ["target", "response"],
};

/** JSON Schema for compliance check result */
export const COMPLIANCE_CHECK_SCHEMA = {
  type: "object" as const,
  properties: {
    compliant: {
      type: "boolean" as const,
      description: "Whether the task output complies with all directives",
    },
    violations: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          directive: {
            type: "string" as const,
            description: "The directive that was violated",
          },
          reason: {
            type: "string" as const,
            description: "Why the output violates this directive",
          },
        },
        required: ["directive", "reason"],
      },
      description: "List of directive violations found",
    },
    summary: {
      type: "string" as const,
      description: "Brief summary of the compliance check result",
    },
  },
  required: ["compliant", "violations", "summary"],
};
