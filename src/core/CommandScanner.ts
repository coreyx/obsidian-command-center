import type { App, DataAdapter } from "obsidian";
import type { CommandFileDescriptor } from "../types/command";

export class CommandScanner {
  constructor(private app: App) {}

  private get adapter(): DataAdapter {
    return this.app.vault.adapter;
  }

  /**
   * Scans the configured directory path recursively for command definitions.
   * Supports .js, .mjs, .json single files and folder bundles with command.js / index.js.
   */
  async scan(directoryPath: string): Promise<CommandFileDescriptor[]> {
    const normalizedDir = this.normalizePath(directoryPath);
    const exists = await this.adapter.exists(normalizedDir);
    if (!exists) {
      // Create commands directory if it doesn't exist yet
      try {
        await this.adapter.mkdir(normalizedDir);
      } catch {
        // If creation fails (e.g. read-only or nested path), return empty
        return [];
      }
      return [];
    }

    const descriptors: CommandFileDescriptor[] = [];
    await this.traverseDirectory(normalizedDir, descriptors);
    return descriptors;
  }

  private async traverseDirectory(
    currentDir: string,
    descriptors: CommandFileDescriptor[]
  ): Promise<void> {
    const listing = await this.adapter.list(currentDir);

    // 1. Check direct files
    for (const filePath of listing.files) {
      const normalizedPath = this.normalizePath(filePath);
      const filename = this.getFilename(normalizedPath);

      if (filename.startsWith(".") || filename.endsWith(".d.ts")) {
        continue;
      }

      if (filename.endsWith(".js") || filename.endsWith(".mjs")) {
        descriptors.push({
          path: normalizedPath,
          filename,
          extension: filename.endsWith(".mjs") ? "mjs" : "js",
          isDirectoryBundle: false,
        });
      } else if (filename.endsWith(".json")) {
        descriptors.push({
          path: normalizedPath,
          filename,
          extension: "json",
          isDirectoryBundle: false,
        });
      }
    }

    // 2. Check subdirectories
    for (const folderPath of listing.folders) {
      const normalizedFolder = this.normalizePath(folderPath);
      const folderName = this.getFilename(normalizedFolder);

      if (folderName.startsWith(".")) {
        continue;
      }

      // Check if folder is a command bundle (contains command.js or index.js)
      const subListing = await this.adapter.list(normalizedFolder);
      const entrypoint = subListing.files.find((f) => {
        const name = this.getFilename(f);
        return (
          name === "command.js" ||
          name === "index.js" ||
          name === "command.mjs" ||
          name === "index.mjs"
        );
      });

      if (entrypoint) {
        const name = this.getFilename(entrypoint);
        descriptors.push({
          path: this.normalizePath(entrypoint),
          filename: folderName,
          extension: name.endsWith(".mjs") ? "mjs" : "js",
          isDirectoryBundle: true,
        });
      } else {
        // Recurse into subfolder if not a single bundle
        await this.traverseDirectory(normalizedFolder, descriptors);
      }
    }
  }

  public normalizePath(pathStr: string): string {
    return pathStr.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
  }

  public getFilename(pathStr: string): string {
    const parts = pathStr.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] ?? "";
  }
}
