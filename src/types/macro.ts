export type MacroErrorPolicy = "halt" | "continue" | "fallback";

export interface MacroStepDefinition {
  id?: string;
  commandId: string;
  params?: Record<string, unknown>;
  onError?: MacroErrorPolicy;
  fallbackCommandId?: string;
}

export interface MacroDefinition {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  queueName?: string;
  debounce?: number;
  throttle?: number;
  timeout?: number;
  steps: MacroStepDefinition[];
}

export interface MacroStepExecutionRecord {
  stepIndex: number;
  stepId?: string;
  commandId: string;
  input: unknown;
  output?: unknown;
  error?: Error;
  status: "success" | "failed" | "skipped";
}

export class CommandNotFoundError extends Error {
  constructor(public commandId: string) {
    super(`Command not found: "${commandId}". Ensure the command ID is registered with Obsidian.`);
    this.name = "CommandNotFoundError";
  }
}
