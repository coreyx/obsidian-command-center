import type { App } from "obsidian";
import type { OCCCommand } from "../types/command";
import type { ExecutionContext, OCCCommandBridge, OCCUIHelper, VaultHelper } from "../types/context";
import { ExecutionContextImpl } from "../context/ExecutionContextImpl";
import type { CommandRegistry } from "./CommandRegistry";
import { QueueManager } from "./QueueManager";
import { DebounceThrottleManager } from "./DebounceThrottleManager";
import { BackgroundWorkerManager } from "./BackgroundWorkerManager";

export interface ExecutionEngineOptions {
  app: App;
  registry: CommandRegistry;
  vaultHelper?: VaultHelper;
  uiHelper?: OCCUIHelper;
  commandBridge?: OCCCommandBridge;
  queueManager?: QueueManager;
  debounceThrottleManager?: DebounceThrottleManager;
  workerManager?: BackgroundWorkerManager;
}

export class ExecutionEngine {
  private app: App;
  private registry: CommandRegistry;
  private vaultHelper?: VaultHelper;
  private uiHelper?: OCCUIHelper;
  private commandBridge?: OCCCommandBridge;
  private queueManager: QueueManager;
  private debounceThrottleManager: DebounceThrottleManager;
  private workerManager: BackgroundWorkerManager;

  constructor(options: ExecutionEngineOptions) {
    this.app = options.app;
    this.registry = options.registry;
    this.vaultHelper = options.vaultHelper;
    this.uiHelper = options.uiHelper;
    this.commandBridge = options.commandBridge;
    this.queueManager = options.queueManager ?? new QueueManager();
    this.debounceThrottleManager = options.debounceThrottleManager ?? new DebounceThrottleManager();
    this.workerManager = options.workerManager ?? new BackgroundWorkerManager();
  }

  public getQueueManager(): QueueManager {
    return this.queueManager;
  }

  public getDebounceThrottleManager(): DebounceThrottleManager {
    return this.debounceThrottleManager;
  }

  public getWorkerManager(): BackgroundWorkerManager {
    return this.workerManager;
  }

  /**
   * Constructs an ExecutionContext for a command invocation.
   */
  public createContext(
    input?: unknown,
    abortSignal?: AbortSignal,
    commandId?: string
  ): ExecutionContext {
    return new ExecutionContextImpl({
      app: this.app,
      commandId,
      input,
      abortSignal,
      vaultHelper: this.vaultHelper,
      uiHelper: this.uiHelper,
      commandBridge: this.commandBridge,
      queueManager: this.queueManager,
      debounceThrottleManager: this.debounceThrottleManager,
    });
  }

  /**
   * Executes a command by its registered ID with debounce/throttle scheduling, queue routing, and error boundaries.
   */
  async execute(commandId: string, initialInput?: unknown): Promise<unknown> {
    const command = this.registry.get(commandId);
    if (!command) {
      throw new Error(`Command "${commandId}" is not registered in Command Center`);
    }

    const run = () => this.runCommand(command, initialInput);

    // 1. Debounce scheduling
    if (typeof command.metadata.debounce === "number" && command.metadata.debounce > 0) {
      return this.debounceThrottleManager.debounce(commandId, run, command.metadata.debounce);
    }

    // 2. Throttle scheduling
    if (typeof command.metadata.throttle === "number" && command.metadata.throttle > 0) {
      return this.debounceThrottleManager.throttle(commandId, run, command.metadata.throttle);
    }

    // 3. Direct or background execution (with queue routing if declared)
    return run();
  }

  /**
   * Routes command through background runner or serial queue if declared, otherwise executes directly.
   */
  private async runCommand(command: OCCCommand, initialInput?: unknown): Promise<unknown> {
    if (command.metadata.isBackground) {
      return this.workerManager.spawn(
        command,
        (ctx) => this.executeWithContext(command, ctx),
        (signal) => this.createContext(initialInput, signal, command.metadata.id)
      );
    }

    if (command.metadata.queueName) {
      return this.queueManager.push(
        command.metadata.queueName,
        () => this.executeCore(command, initialInput),
        { haltOnError: command.metadata.haltOnError }
      );
    }

    return this.executeCore(command, initialInput);
  }

  /**
   * Core execution pipeline: creates context and executes.
   */
  private async executeCore(command: OCCCommand, initialInput?: unknown): Promise<unknown> {
    const abortController = new AbortController();
    const context = this.createContext(initialInput, abortController.signal, command.metadata.id);
    return this.executeWithContext(command, context);
  }

  /**
   * Inner execution logic: canExecute pre-validation, execute invocation, and onError recovery boundary.
   */
  private async executeWithContext(command: OCCCommand, context: ExecutionContext): Promise<unknown> {
    // 1. Pre-execution validation (canExecute)
    if (typeof command.canExecute === "function") {
      try {
        const canRun = await command.canExecute(context);
        if (canRun === false) {
          return null;
        }
        if (typeof canRun === "string") {
          context.ui.toast(canRun, { type: "warning" });
          return null;
        }
      } catch (err: any) {
        if (typeof command.onError === "function") {
          await command.onError(err, context);
        }
        throw err;
      }
    }

    // 2. Main execution payload
    try {
      const result = await command.execute(context);
      return result;
    } catch (error: any) {
      if (typeof command.onError === "function") {
        try {
          await command.onError(error, context);
        } catch (recoveryErr) {
          console.error(`[OCC] Error in onError handler for "${command.metadata.id}":`, recoveryErr);
        }
      }
      context.ui.toast(`Command "${command.metadata.name}" failed: ${error.message}`, {
        type: "error",
      });
      throw error;
    }
  }
}

