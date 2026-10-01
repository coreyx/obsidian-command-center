import type { App, TFile } from "obsidian";
import type { VaultHelper } from "../types/context";

export class VaultHelperImpl implements VaultHelper {
  constructor(private app: App) {}

  async read(file: TFile): Promise<string> {
    return this.app.vault.read(file);
  }

  async modify(file: TFile, content: string): Promise<void> {
    await this.app.vault.modify(file, content);
  }

  async processFrontmatter(
    file: TFile,
    fn: (frontmatter: Record<string, unknown>) => void
  ): Promise<void> {
    if (this.app.fileManager?.processFrontMatter) {
      await this.app.fileManager.processFrontMatter(file, fn);
    } else {
      // Fallback for testing environments without full fileManager
      const content = await this.read(file);
      const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      let frontmatter: Record<string, unknown> = {};
      let body = content;
      if (match && match[1] !== undefined && match[2] !== undefined) {
        try {
          frontmatter = JSON.parse(match[1]);
        } catch {
          // Keep raw or empty
        }
        body = match[2];
      }
      fn(frontmatter);
      const newHeader = `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n`;
      await this.modify(file, newHeader + body);
    }
  }

  async createNote(path: string, content: string): Promise<TFile> {
    return this.app.vault.create(path, content);
  }
}
