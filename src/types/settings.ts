export interface OCCSettings {
  commandsDirectory: string;
  enableHotReload: boolean;
  defaultTimeout: number;
  safeExecutionMode: boolean;
  disabledCommands: string[];
}

export const DEFAULT_SETTINGS: OCCSettings = {
  commandsDirectory: ".obsidian/plugins/obsidian-command-center/commands",
  enableHotReload: true,
  defaultTimeout: 15000,
  safeExecutionMode: false,
  disabledCommands: [],
};
