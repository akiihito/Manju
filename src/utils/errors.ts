export class ManjuError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManjuError";
  }
}

export class TmuxError extends ManjuError {
  constructor(message: string) {
    super(message);
    this.name = "TmuxError";
  }
}

export class ClaudeRunnerError extends ManjuError {
  constructor(
    message: string,
    public readonly exitCode?: number,
  ) {
    super(message);
    this.name = "ClaudeRunnerError";
  }
}

export class WorkspaceError extends ManjuError {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

export class TaskError extends ManjuError {
  constructor(
    message: string,
    public readonly taskId?: string,
  ) {
    super(message);
    this.name = "TaskError";
  }
}
