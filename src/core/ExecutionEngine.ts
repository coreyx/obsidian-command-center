import type { App } from "obsidian";
import type { OCCCommand } from "../types/command";
import type { ExecutionContext, OCCCommandBridge, OCCUIHelper, VaultHelper } from "../types/context";
import { ExecutionContextImpl } from "../context/ExecutionContextImpl";
import type { CommandRegistry } from "./CommandRegistry";

export interface ExecutionEngineOptions {
  app: App;
  registry: CommandRegistry;
  vaultHelper?: VaultHelper;
  uiHelper?: OCCUIHelper;
  commandBridge?: OCCCommandBridge;
}

export class ExecutionEngine {
  private app: App;
  private registry: CommandRegistry;
  private vaultHelper?: VaultHelper;
  private uiHelper?: OCCUIHelper;
  private commandBridge?: OCCCommandBridge;

  constructor(options: ExecutionEngineOptions) {
    this.app = options.app;
    this.registry = options.registry;
    this.vaultHelper = options.vaultHelper;
    this.uiHelper = options.uiHelper;
    this.commandBridge = options.commandBridge;
  }

  /**
   * Constructs an ExecutionContext for a command invocation.
   */
  public createContext(input?: unknown, abortSignal?: AbortSignal): ExecutionContext {
    return new ExecutionContextImpl({
      app: this.app,
      input,
      abortSignal,
      vaultHelper: this.vaultHelper,
      uiHelper: this.uiHelper,
      commandBridge: this.commandBridge,
    });
  }

  /**
   * Executes a command by its registered ID with full context construction and error boundaries.
   */
  async execute(commandId: string, initialInput?: unknown): Promise<unknown> {
    const command = this.registry.get(commandId);
    if (!command) {
      throw new Error(`Command "${commandId}" is not registered in Command Center`);
    }

    const abortController = new AbortController();
    const context = this.createContext(initialInput, abortController.signal);

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
          console.error(`[OCC] Error in onError handler for "${commandId}":`, recoveryErr);
        }
      }
      context.ui.toast(`Command "${command.metadata.name}" failed: ${error.message}`, {
        type: "error",
      });
      throw error;
    }
  }
}
