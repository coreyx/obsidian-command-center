import type { App, Command, Plugin } from "obsidian";
import type { OCCCommand } from "../types/command";

export interface RegisteredCommandRecord {
  command: OCCCommand;
  filePath: string;
  obsidianCommandId: string;
  isEnabled: boolean;
}

export class CommandRegistry {
  private commands = new Map<string, RegisteredCommandRecord>();

  constructor(
    private app: App,
    private plugin: Plugin,
    private executeCallback?: (commandId: string) => Promise<unknown>
  ) {}

  /**
   * Registers an OCCCommand with the internal registry and binds it to Obsidian's command palette.
   */
  register(command: OCCCommand, filePath = "", isEnabled = true): void {
    const commandId = command.metadata.id;

    // If already registered, unregister previous instance first
    if (this.commands.has(commandId)) {
      this.unregister(commandId);
    }

    let obsidianCommandId = commandId;

    if (isEnabled) {
      const added = this.plugin.addCommand({
        id: commandId,
        name: `Command Center: ${command.metadata.name}`,
        icon: command.metadata.icon,
        callback: () => {
          this.executeCallback?.(commandId)?.catch((err) => {
            console.error(`[OCC] Error executing command "${commandId}":`, err);
          });
        },
      });

      // Obsidian prefixes plugin commands with `<plugin-id>:<command-id>`
      obsidianCommandId = added?.id ?? `${this.plugin.manifest.id}:${commandId}`;
    }

    this.commands.set(commandId, {
      command,
      filePath,
      obsidianCommandId,
      isEnabled,
    });
  }

  /**
   * Unregisters a command from OCC and Obsidian's command palette.
   */
  unregister(commandId: string): boolean {
    const record = this.commands.get(commandId);
    if (!record) return false;

    // Unbind from Obsidian's internal command registry
    this.removeObsidianCommand(record.obsidianCommandId);
    // Also try without prefix in case of direct ID
    this.removeObsidianCommand(commandId);

    this.commands.delete(commandId);
    return true;
  }

  private removeObsidianCommand(fullCommandId: string): void {
    // @ts-expect-error Obsidian private commands API
    const appCommands = this.app.commands;
    if (appCommands) {
      if (typeof appCommands.removeCommand === "function") {
        appCommands.removeCommand(fullCommandId);
      } else if (appCommands.commands && fullCommandId in appCommands.commands) {
        delete appCommands.commands[fullCommandId];
      }
    }
  }

  get(commandId: string): OCCCommand | undefined {
    return this.commands.get(commandId)?.command;
  }

  getRecord(commandId: string): RegisteredCommandRecord | undefined {
    return this.commands.get(commandId);
  }

  has(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  list(): OCCCommand[] {
    return Array.from(this.commands.values()).map((r) => r.command);
  }

  listRecords(): RegisteredCommandRecord[] {
    return Array.from(this.commands.values());
  }

  clear(): void {
    for (const commandId of this.commands.keys()) {
      this.unregister(commandId);
    }
  }
}
