import type { App, Editor, TFile, Workspace } from "obsidian";
import type {
  ExecutionContext,
  OCCCommandBridge,
  OCCUIHelper,
  PromptOptions,
  ConfirmOptions,
  ToastOptions,
  VaultHelper,
} from "../types/context";
import { VaultHelperImpl } from "./VaultHelperImpl";
import { Notice } from "obsidian";

import { OCCCommandBridgeImpl } from "../core/CommandBridge";

export class DefaultUIHelper implements OCCUIHelper {
  toast(message: string, options?: ToastOptions): void {
    const duration = options?.duration ?? 4000;
    new Notice(message, duration);
  }

  async prompt(options: PromptOptions): Promise<string | null> {
    // In headless or MVP, provide basic fallback, interactive modal added in M4
    return options.defaultValue ?? null;
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    return true;
  }
}

export interface ExecutionContextOptions {
  app: App;
  input?: unknown;
  prevOutput?: unknown;
  steps?: Array<{
    stepIndex: number;
    stepId?: string;
    commandId: string;
    output?: unknown;
    error?: Error;
  }>;
  abortSignal?: AbortSignal;
  vaultHelper?: VaultHelper;
  uiHelper?: OCCUIHelper;
  commandBridge?: OCCCommandBridge;
}

export class ExecutionContextImpl implements ExecutionContext {
  public readonly app: App;
  public readonly vault: VaultHelper;
  public readonly workspace: Workspace;
  public readonly editor: Editor | null;
  public readonly file: TFile | null;
  public input: unknown;
  public $prevOutput: unknown;
  public steps?: Array<{
    stepIndex: number;
    stepId?: string;
    commandId: string;
    output?: unknown;
    error?: Error;
  }>;
  public readonly commands: OCCCommandBridge;
  public readonly ui: OCCUIHelper;
  public readonly abortSignal: AbortSignal;

  constructor(options: ExecutionContextOptions) {
    this.app = options.app;
    this.workspace = options.app.workspace;
    this.vault = options.vaultHelper ?? new VaultHelperImpl(options.app);
    this.commands = options.commandBridge ?? new OCCCommandBridgeImpl(options.app);
    this.ui = options.uiHelper ?? new DefaultUIHelper();
    this.abortSignal = options.abortSignal ?? new AbortController().signal;
    this.input = options.input;
    this.$prevOutput = options.prevOutput ?? options.input;
    this.steps = options.steps;

    // Resolve active file and editor safely
    this.file = this.workspace?.getActiveFile?.() ?? null;
    // @ts-expect-error getActiveViewOfType may not be strictly typed in all mocks
    const view = this.workspace?.getActiveViewOfType?.(this.app.workspace?.constructor ? null : null) ?? null;
    // @ts-expect-error active editor resolution
    this.editor = (view && "editor" in view && view.editor) ? view.editor : null;
  }
}
