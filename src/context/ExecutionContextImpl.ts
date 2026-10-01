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

export class DefaultCommandBridge implements OCCCommandBridge {
  constructor(private app: App) {}

  async execute(commandId: string, _params?: unknown): Promise<unknown> {
    // @ts-expect-error Obsidian private commands API
    const exists = this.app.commands?.commands?.[commandId];
    if (!exists) {
      throw new Error(`Command not found: ${commandId}`);
    }
    // @ts-expect-error Obsidian private commands API
    return this.app.commands.executeCommandById(commandId);
  }

  listCommands(): Array<{ id: string; name: string }> {
    // @ts-expect-error Obsidian private commands API
    const cmds = this.app.commands?.commands ?? {};
    return Object.values(cmds).map((c: any) => ({
      id: c.id,
      name: c.name,
    }));
  }
}

export interface ExecutionContextOptions {
  app: App;
  input?: unknown;
  prevOutput?: unknown;
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
  public readonly input: unknown;
  public readonly $prevOutput: unknown;
  public readonly commands: OCCCommandBridge;
  public readonly ui: OCCUIHelper;
  public readonly abortSignal: AbortSignal;

  constructor(options: ExecutionContextOptions) {
    this.app = options.app;
    this.workspace = options.app.workspace;
    this.vault = options.vaultHelper ?? new VaultHelperImpl(options.app);
    this.commands = options.commandBridge ?? new DefaultCommandBridge(options.app);
    this.ui = options.uiHelper ?? new DefaultUIHelper();
    this.abortSignal = options.abortSignal ?? new AbortController().signal;
    this.input = options.input;
    this.$prevOutput = options.prevOutput ?? options.input;

    // Resolve active file and editor safely
    this.file = this.workspace?.getActiveFile?.() ?? null;
    // @ts-expect-error getActiveViewOfType may not be strictly typed in all mocks
    const view = this.workspace?.getActiveViewOfType?.(this.app.workspace?.constructor ? null : null) ?? null;
    // @ts-expect-error active editor resolution
    this.editor = (view && "editor" in view && view.editor) ? view.editor : null;
  }
}
