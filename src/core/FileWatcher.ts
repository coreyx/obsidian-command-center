import type { App, EventRef } from "obsidian";

export type FileEventType = "CREATE" | "MODIFY" | "DELETE";

export interface FileChangeEvent {
  type: FileEventType;
  path: string;
}

export type FileChangeHandler = (event: FileChangeEvent) => void | Promise<void>;

export class FileWatcher {
  private handlers: FileChangeHandler[] = [];
  private eventRefs: EventRef[] = [];
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private debounceMs: number;
  private watchedDir: string = "";

  constructor(private app: App, debounceMs = 200) {
    this.debounceMs = debounceMs;
  }

  /**
   * Starts watching the target commands directory for changes.
   */
  start(directoryPath: string): void {
    this.stop();
    this.watchedDir = this.normalizePath(directoryPath);

    // Hook into Obsidian Vault event listeners
    const onCreate = this.app.vault.on("create", (file) => {
      this.handleVaultEvent("CREATE", file.path);
    });

    const onModify = this.app.vault.on("modify", (file) => {
      this.handleVaultEvent("MODIFY", file.path);
    });

    const onDelete = this.app.vault.on("delete", (file) => {
      this.handleVaultEvent("DELETE", file.path);
    });

    const onRename = this.app.vault.on("rename", (file, oldPath) => {
      this.handleVaultEvent("DELETE", oldPath);
      this.handleVaultEvent("CREATE", file.path);
    });

    this.eventRefs.push(onCreate, onModify, onDelete, onRename);
  }

  /**
   * Stops watching and cleans up all event listeners and pending timers.
   */
  stop(): void {
    for (const ref of this.eventRefs) {
      this.app.vault.offref(ref);
    }
    this.eventRefs = [];

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  onEvent(handler: FileChangeHandler): void {
    this.handlers.push(handler);
  }

  private handleVaultEvent(type: FileEventType, filePath: string): void {
    const normalized = this.normalizePath(filePath);

    // Only process files inside the watched commands directory
    if (!normalized.startsWith(this.watchedDir + "/") && normalized !== this.watchedDir) {
      return;
    }

    // Coalesce rapid disk events per file path using debounce
    const existingTimer = this.debounceTimers.get(normalized);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(normalized);
      this.dispatch({ type, path: normalized });
    }, this.debounceMs);

    this.debounceTimers.set(normalized, timer);
  }

  private dispatch(event: FileChangeEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error(`[OCC FileWatcher] Error in event handler:`, err);
      }
    }
  }

  private normalizePath(pathStr: string): string {
    return pathStr.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
  }
}
