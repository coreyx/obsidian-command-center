import type { ExecutionContext } from "./context";

export interface OCCCommandMetadata {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  queueName?: string;
  haltOnError?: boolean;
  debounce?: number; // milliseconds
  throttle?: number; // milliseconds
  timeout?: number; // milliseconds, default: 15000
  isBackground?: boolean;
}

export interface OCCCommand {
  metadata: OCCCommandMetadata;
  init?(context: ExecutionContext): Promise<void> | void;
  canExecute?(context: ExecutionContext): Promise<boolean | string> | boolean | string;
  execute(context: ExecutionContext): Promise<unknown> | unknown;
  onError?(error: Error, context: ExecutionContext): Promise<void> | void;
  cleanup?(context: ExecutionContext): Promise<void> | void;
}

export interface CommandFileDescriptor {
  path: string;
  filename: string;
  extension: "js" | "mjs" | "json";
  isDirectoryBundle: boolean;
}
