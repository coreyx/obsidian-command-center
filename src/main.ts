import { Plugin } from "obsidian";
import type { OCCSettings } from "./types/settings";
import { DEFAULT_SETTINGS } from "./types/settings";
import { CommandScanner } from "./core/CommandScanner";
import { ModuleLoader } from "./core/ModuleLoader";
import { CommandRegistry } from "./core/CommandRegistry";
import { ExecutionEngine } from "./core/ExecutionEngine";
import { FileWatcher } from "./core/FileWatcher";
import { LifecycleManager } from "./core/LifecycleManager";
import { OCCSettingTab } from "./settings/SettingTab";
import type { CommandFileDescriptor } from "./types/command";
import { StatusBarMonitor } from "./ui/StatusBarMonitor";
import { TypeDefinitionGenerator } from "./core/TypeDefinitionGenerator";
import { CommandScaffolder } from "./core/CommandScaffolder";

export default class CommandCenterPlugin extends Plugin {
  public settings: OCCSettings = DEFAULT_SETTINGS;
  public scanner!: CommandScanner;
  public loader!: ModuleLoader;
  public registry!: CommandRegistry;
  public engine!: ExecutionEngine;
  public watcher!: FileWatcher;
  public lifecycle!: LifecycleManager;
  public statusBarMonitor?: StatusBarMonitor;
  public typeGen = new TypeDefinitionGenerator();
  public scaffolder = new CommandScaffolder();

  async onload(): Promise<void> {
    await this.loadSettings();

    // 1. Initialize core subsystems
    this.scanner = new CommandScanner(this.app);
    this.loader = new ModuleLoader(this.app);
    this.registry = new CommandRegistry(this.app, this, async (id) => {
      return this.engine.execute(id);
    });
    this.engine = new ExecutionEngine({
      app: this.app,
      registry: this.registry,
    });
    this.lifecycle = new LifecycleManager(this.app, this.registry, this.loader);
    this.watcher = new FileWatcher(this.app);

    // 2. Ensure TypeScript declaration file (occ.d.ts) exists
    try {
      await this.typeGen.ensureDeclarationsFile(this.settings.commandsDirectory, this.app.vault);
    } catch (e: any) {
      console.error("[OCC] Error generating occ.d.ts:", e.message);
    }

    // 3. Register status bar monitor for background tasks
    const statusBarEl = this.addStatusBarItem();
    this.statusBarMonitor = new StatusBarMonitor(
      statusBarEl,
      this.engine.getWorkerManager(),
      this.app
    );

    // 4. Register settings tab
    this.addSettingTab(new OCCSettingTab(this.app, this));

    // 5. Register management commands
    this.addCommand({
      id: "reload-commands",
      name: "Reload All Commands",
      callback: async () => {
        await this.reloadAllCommands();
      },
    });

    this.addCommand({
      id: "create-new-command",
      name: "Create New Command",
      callback: async () => {
        await this.promptCreateNewCommand();
      },
    });

    // 5. Setup file watcher for zero-downtime hot-reloading
    if (this.settings.enableHotReload) {
      this.setupFileWatcher();
    }

    // 6. Initial command discovery and registration
    this.app.workspace.onLayoutReady(async () => {
      await this.reloadAllCommands();
    });
  }

  onunload(): void {
    // 1. Stop file watcher
    this.watcher?.stop();

    // 2. Destroy status bar monitor
    this.statusBarMonitor?.destroy();

    // 3. Cancel active background workers and clear timers
    this.engine?.getWorkerManager().cancelAll().catch((e) => {
      console.error("[OCC] Error cancelling background workers on unload:", e);
    });
    this.engine?.getDebounceThrottleManager().clearAll();
    this.engine?.getQueueManager().clearAll();

    // 4. Clean up all registered commands
    const records = this.registry.listRecords();
    const context = this.engine.createContext();
    for (const record of records) {
      this.lifecycle.cleanupCommand(record.command, context).catch((e) => {
        console.error(`[OCC] Error during cleanup of "${record.command.metadata.id}":`, e);
      });
    }

    this.registry.clear();
  }

  public setupFileWatcher(): void {
    this.watcher.stop();
    this.watcher.start(this.settings.commandsDirectory);
    this.watcher.onEvent(async (event) => {
      const context = this.engine.createContext();
      if (event.type === "DELETE") {
        await this.lifecycle.removeByFilePath(event.path, context);
      } else {
        // CREATE or MODIFY
        const descriptor = this.createDescriptorForPath(event.path);
        if (descriptor) {
          try {
            const isEnabled = !this.settings.disabledCommands.includes(descriptor.filename);
            const cmd = await this.lifecycle.loadAndRegister(descriptor, context, isEnabled);
            console.log(`[OCC] Hot-reloaded command: "${cmd.metadata.name}" (${cmd.metadata.id})`);
          } catch (err: any) {
            console.error(`[OCC] Hot-reload error for "${event.path}":`, err.message);
          }
        }
      }
    });
  }

  private createDescriptorForPath(filePath: string): CommandFileDescriptor | null {
    const filename = this.scanner.getFilename(filePath);
    if (filename.startsWith(".") || filename.endsWith(".d.ts")) return null;

    if (filename.endsWith(".js") || filename.endsWith(".mjs")) {
      return {
        path: this.scanner.normalizePath(filePath),
        filename,
        extension: filename.endsWith(".mjs") ? "mjs" : "js",
        isDirectoryBundle: false,
      };
    } else if (filename.endsWith(".json")) {
      return {
        path: this.scanner.normalizePath(filePath),
        filename,
        extension: "json",
        isDirectoryBundle: false,
      };
    }
    return null;
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Rescans the commands directory, cleans up stale commands, and loads active definitions.
   */
  async reloadAllCommands(): Promise<void> {
    const records = this.registry.listRecords();
    const context = this.engine.createContext();

    for (const record of records) {
      await this.lifecycle.cleanupCommand(record.command, context);
    }
    this.registry.clear();

    const descriptors = await this.scanner.scan(this.settings.commandsDirectory);

    for (const desc of descriptors) {
      try {
        const isEnabled = !this.settings.disabledCommands.includes(desc.filename);
        await this.lifecycle.loadAndRegister(desc, context, isEnabled);
      } catch (err: any) {
        console.error(`[OCC] Failed to load command from "${desc.path}":`, err.message);
      }
    }
  }

  /**
   * Interactive wizard for scaffolding a new command script or macro pipeline.
   */
  async promptCreateNewCommand(): Promise<void> {
    const context = this.engine.createContext();

    const name = await context.ui.prompt({
      title: "Command Center — Create New Command",
      placeholder: "e.g. Daily Briefing, Format Note, Sync Notes...",
    });

    if (!name || !name.trim()) return;

    const choice = await context.ui.suggest(
      [
        { label: "JavaScript Script (.js) — Full scripting power with lifecycle hooks", type: "script" as const },
        { label: "Declarative Macro (.macro.json) — Composable native command pipeline", type: "macro" as const },
      ],
      {
        title: "Select Command Type",
        renderItem: (item) => item.label,
      }
    );

    if (!choice) return;

    try {
      const createdPath = await this.scaffolder.scaffoldCommand(
        { name: name.trim(), type: choice.type },
        this.settings.commandsDirectory,
        this.app.vault,
        this.app.workspace
      );

      context.ui.toast(`Command "${name.trim()}" created successfully!`, {
        type: "success",
      });

      await this.reloadAllCommands();
    } catch (err: any) {
      context.ui.toast(`Failed to create command: ${err.message}`, {
        type: "error",
      });
      console.error("[OCC Scaffolding Error]:", err);
    }
  }
}
