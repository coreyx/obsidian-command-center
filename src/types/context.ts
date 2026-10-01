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

export interface OCCUIHelper {
  toast(message: string, options?: ToastOptions): void;
  prompt(options: PromptOptions): Promise<string | null>;
  confirm(options: ConfirmOptions): Promise<boolean>;
}

export interface OCCCommandBridge {
  execute(commandId: string, params?: unknown): Promise<unknown>;
  listCommands(): Array<{ id: string; name: string }>;
}

export interface ExecutionContext {
  app: App;
  vault: VaultHelper;
  workspace: Workspace;
  editor: Editor | null;
  file: TFile | null;
  input: unknown;
  $prevOutput: unknown;
  commands: OCCCommandBridge;
  ui: OCCUIHelper;
  abortSignal: AbortSignal;
}
