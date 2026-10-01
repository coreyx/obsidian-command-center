import type { App, Editor, TFile, Workspace } from "obsidian";
import type {
  ExecutionContext,
  OCCCommandBridge,
  OCCQueueHelper,
  OCCUIHelper,
  QueueOptions,
  VaultHelper,
} from "../types/context";
import { VaultHelperImpl } from "./VaultHelperImpl";
import { OCCCommandBridgeImpl } from "../core/CommandBridge";
import { UIHelperImpl } from "../ui/UIHelperImpl";
import { QueueManager } from "../core/QueueManager";
import type { DebounceThrottleManager } from "../core/DebounceThrottleManager";

export interface ExecutionContextOptions {
  app: App;
  commandId?: string;
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
  queueHelper?: OCCQueueHelper;
  queueManager?: QueueManager;
  debounceThrottleManager?: DebounceThrottleManager;
}

export class ExecutionContextImpl implements ExecutionContext {
  public readonly app: App;
  public readonly vault: VaultHelper;
  public readonly workspace: Workspace;
  public readonly editor: Editor | null;
  public readonly file: TFile | null;
  public readonly commandId?: string;
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
  public readonly queue: OCCQueueHelper;
  public readonly abortSignal: AbortSignal;
  private debounceThrottleManager?: DebounceThrottleManager;

  constructor(options: ExecutionContextOptions) {
    this.app = options.app;
    this.workspace = options.app.workspace;
    this.commandId = options.commandId;
    this.vault = options.vaultHelper ?? new VaultHelperImpl(options.app);
    this.commands = options.commandBridge ?? new OCCCommandBridgeImpl(options.app);
    this.ui = options.uiHelper ?? new UIHelperImpl(options.app);
    this.abortSignal = options.abortSignal ?? new AbortController().signal;
    this.input = options.input;
    this.$prevOutput = options.prevOutput ?? options.input;
    this.steps = options.steps;
    this.debounceThrottleManager = options.debounceThrottleManager;

    if (options.queueHelper) {
      this.queue = options.queueHelper;
    } else {
      const qm = options.queueManager ?? new QueueManager();
      this.queue = {
        push: (name, task, opts) => qm.push(name, task, opts),
      };
    }

    // Resolve active file and editor safely
    this.file = this.workspace?.getActiveFile?.() ?? null;
    // @ts-expect-error getActiveViewOfType may not be strictly typed in all mocks
    const view = this.workspace?.getActiveViewOfType?.(this.app.workspace?.constructor ? null : null) ?? null;
    // @ts-expect-error active editor resolution
    this.editor = (view && "editor" in view && view.editor) ? view.editor : null;
  }

  /**
   * Cooperatively relinquishes the JavaScript main thread to prevent UI freezing during long-running loops.
   */
  public yield(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Cancels a pending debounced invocation for the current or specified command ID.
   */
  public cancelDebounce(id?: string): boolean {
    const targetId = id ?? this.commandId;
    if (!targetId || !this.debounceThrottleManager) {
      return false;
    }
    return this.debounceThrottleManager.cancelDebounce(targetId);
  }
}

