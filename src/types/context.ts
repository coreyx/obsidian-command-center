import type { App, Editor, TFile, Workspace } from "obsidian";

export interface VaultHelper {
  read(file: TFile): Promise<string>;
  modify(file: TFile, content: string): Promise<void>;
  processFrontmatter(
    file: TFile,
    fn: (frontmatter: Record<string, unknown>) => void
  ): Promise<void>;
  createNote(path: string, content: string): Promise<TFile>;
}

export interface ToastAction {
  label: string;
  variant?: "default" | "primary" | "warning" | "danger";
  onClick: () => void | Promise<void>;
}

export interface ToastOptions {
  duration?: number;
  actions?: ToastAction[];
  icon?: string;
  type?: "info" | "success" | "warning" | "error";
}

export interface PromptOptions {
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface SuggestOptions<T> {
  title?: string;
  placeholder?: string;
  renderItem?: (item: T) => string;
}

export interface ProgressUpdate {
  current?: number;
  total?: number;
  message?: string;
}

export interface ProgressReporter {
  update(update: ProgressUpdate): void;
  finish(completionMessage?: string): void;
}

export interface ProgressOptions {
  title?: string;
  total?: number;
  initialMessage?: string;
}

export interface InteractiveToastHandle {
  hide(): void;
  setMessage(msg: string): void;
}

export interface OCCUIHelper {
  toast(message: string, options?: ToastOptions): InteractiveToastHandle;
  prompt(options: PromptOptions): Promise<string | null>;
  confirm(options: ConfirmOptions): Promise<boolean>;
  suggest<T>(items: T[], options?: SuggestOptions<T>): Promise<T | null>;
  createProgress(options?: ProgressOptions): ProgressReporter;
}

export interface OCCCommandBridge {
  execute(commandId: string, params?: unknown): Promise<unknown>;
  listCommands(): Array<{ id: string; name: string }>;
}

export interface QueueOptions {
  haltOnError?: boolean;
}

export interface OCCQueueHelper {
  push<T>(queueName: string, task: () => Promise<T> | T, options?: QueueOptions): Promise<T>;
}

export interface ExecutionContext {
  app: App;
  vault: VaultHelper;
  workspace: Workspace;
  editor: Editor | null;
  file: TFile | null;
  input: unknown;
  $prevOutput: unknown;
  commandId?: string;
  steps?: Array<{
    stepIndex: number;
    stepId?: string;
    commandId: string;
    output?: unknown;
    error?: Error;
  }>;
  commands: OCCCommandBridge;
  ui: OCCUIHelper;
  queue: OCCQueueHelper;
  abortSignal: AbortSignal;
  yield(): Promise<void>;
  cancelDebounce(id?: string): boolean;
}
