import type { App } from "obsidian";
import type { OCCCommand, CommandFileDescriptor } from "../types/command";
import type { ExecutionContext } from "../types/context";
import type { CommandRegistry } from "./CommandRegistry";
import type { ModuleLoader } from "./ModuleLoader";

export type CommandState =
  | "DISCOVERED"
  | "INITIALIZING"
  | "READY"
  | "EXECUTING"
  | "CLEANUP"
  | "ERRORED";

export class LifecycleManager {
  private states = new Map<string, CommandState>();

  constructor(
    private app: App,
    private registry: CommandRegistry,
    private loader: ModuleLoader
  ) {}

  getState(commandId: string): CommandState {
    return this.states.get(commandId) ?? "DISCOVERED";
  }

  /**
   * Initializes a command, invoking its init() hook and registering it.
   */
  async loadAndRegister(
    descriptor: CommandFileDescriptor,
    context: ExecutionContext,
    isEnabled = true
  ): Promise<OCCCommand> {
    this.states.set(descriptor.path, "INITIALIZING");

    let command: OCCCommand;
    try {
      command = await this.loader.load(descriptor);
    } catch (err: any) {
      this.states.set(descriptor.path, "ERRORED");
      throw err;
    }

    const commandId = command.metadata.id;

    // Check if hotkeys need to be preserved
    const existingRecord = this.registry.getRecord(commandId);
    let cachedHotkeys: any = null;
    if (existingRecord) {
      cachedHotkeys = this.extractHotkeys(existingRecord.obsidianCommandId);
      // Clean up previous instance
      await this.cleanupCommand(existingRecord.command, context);
      this.registry.unregister(commandId);
    }

    // Register with OCC & Obsidian
    this.registry.register(command, descriptor.path, isEnabled);

    // Reapply hotkeys if previously preserved
    if (cachedHotkeys && isEnabled) {
      const newRecord = this.registry.getRecord(commandId);
      if (newRecord) {
        this.restoreHotkeys(newRecord.obsidianCommandId, cachedHotkeys);
      }
    }

    // Run init() hook if present
    if (typeof command.init === "function") {
      try {
        await command.init(context);
      } catch (initErr: any) {
        this.states.set(commandId, "ERRORED");
        console.error(`[OCC] Command "${commandId}" init() failed:`, initErr);
        throw initErr;
      }
    }

    this.states.set(commandId, "READY");
    return command;
  }

  /**
   * Cleans up a command, invoking its cleanup() hook.
   */
  async cleanupCommand(command: OCCCommand, context: ExecutionContext): Promise<void> {
    const commandId = command.metadata.id;
    this.states.set(commandId, "CLEANUP");

    if (typeof command.cleanup === "function") {
      try {
        await command.cleanup(context);
      } catch (err) {
        console.error(`[OCC] Error during cleanup() of "${commandId}":`, err);
      }
    }

    this.states.delete(commandId);
  }

  /**
   * Unregisters and disposes a command by its file path.
   */
  async removeByFilePath(filePath: string, context: ExecutionContext): Promise<boolean> {
    const normalized = filePath.replace(/\\/g, "/");
    const records = this.registry.listRecords();
    const target = records.find(
      (r) => r.filePath.replace(/\\/g, "/") === normalized
    );

    if (!target) return false;

    await this.cleanupCommand(target.command, context);
    this.registry.unregister(target.command.metadata.id);
    return true;
  }

  /**
   * Extracts user-assigned hotkeys for an Obsidian command.
   */
  private extractHotkeys(obsidianCommandId: string): any {
    // @ts-expect-error Obsidian private hotkey manager API
    const hotkeyManager = this.app.hotkeyManager;
    if (hotkeyManager?.customKeys && obsidianCommandId in hotkeyManager.customKeys) {
      return hotkeyManager.customKeys[obsidianCommandId];
    }
    // @ts-expect-error Obsidian private commands API
    const cmd = this.app.commands?.commands?.[obsidianCommandId];
    return cmd?.hotkeys ?? null;
  }

  /**
   * Restores user-assigned hotkeys for an Obsidian command.
   */
  private restoreHotkeys(obsidianCommandId: string, hotkeys: any): void {
    // @ts-expect-error Obsidian private hotkey manager API
    const hotkeyManager = this.app.hotkeyManager;
    if (hotkeyManager?.customKeys && hotkeys) {
      hotkeyManager.customKeys[obsidianCommandId] = hotkeys;
    }
  }
}
