import type { App } from "obsidian";
import type { OCCCommandBridge } from "../types/context";
import { CommandNotFoundError } from "../types/macro";

export class OCCCommandBridgeImpl implements OCCCommandBridge {
  constructor(private app: App) {}

  /**
   * Dispatches a command by ID via Obsidian's internal command bus.
   */
  async execute(commandId: string, _params?: unknown): Promise<unknown> {
    // @ts-expect-error Obsidian private commands API
    const commandsMap = this.app.commands?.commands;
    if (!commandsMap || !(commandId in commandsMap)) {
      throw new CommandNotFoundError(commandId);
    }

    // @ts-expect-error Obsidian private commands API
    const result = await this.app.commands.executeCommandById(commandId);
    return result;
  }

  /**
   * Lists all currently registered commands in Obsidian.
   */
  listCommands(): Array<{ id: string; name: string }> {
    // @ts-expect-error Obsidian private commands API
    const commandsMap = this.app.commands?.commands ?? {};
    return Object.values(commandsMap).map((cmd: any) => ({
      id: cmd.id,
      name: cmd.name ?? cmd.id,
    }));
  }
}
