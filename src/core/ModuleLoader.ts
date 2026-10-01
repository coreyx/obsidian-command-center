import type { App } from "obsidian";
import type { CommandFileDescriptor, OCCCommand, OCCCommandMetadata } from "../types/command";
import { MacroOrchestrator } from "./MacroOrchestrator";
import type { SecuritySandbox } from "./SecuritySandbox";

export class ModuleLoader {
  private macroOrchestrator = new MacroOrchestrator();

  constructor(private app: App, private sandbox?: SecuritySandbox) {}

  public setSandbox(sandbox: SecuritySandbox): void {
    this.sandbox = sandbox;
  }

  /**
   * Loads and instantiates an OCCCommand from a file descriptor.
   */
  async load(descriptor: CommandFileDescriptor): Promise<OCCCommand> {
    if (descriptor.extension === "json") {
      return this.loadJsonCommand(descriptor);
    } else {
      return this.loadScriptCommand(descriptor);
    }
  }

  private async loadJsonCommand(descriptor: CommandFileDescriptor): Promise<OCCCommand> {
    const rawContent = await this.app.vault.adapter.read(descriptor.path);
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e: any) {
      throw new Error(`Failed to parse JSON in ${descriptor.path}: ${e.message}`);
    }

    const definition = this.macroOrchestrator.validateDefinition(parsed, descriptor.path);
    return this.macroOrchestrator.createCommand(definition);
  }

  private async loadScriptCommand(descriptor: CommandFileDescriptor): Promise<OCCCommand> {
    let rawModule: any;

    const isDesktop = typeof process !== "undefined" && process?.versions?.node;
    // @ts-expect-error getBasePath may exist on FileSystemAdapter
    const basePath: string | undefined = this.app.vault.adapter?.getBasePath?.();

    // If safe execution mode is enabled, enforce sandboxed evaluation regardless of platform
    const enforceSandbox = this.sandbox?.isSafeMode === true;

    if (isDesktop && basePath && !enforceSandbox) {
      // Desktop: Dynamic import with cache-busting timestamp
      const absolutePath = this.resolveAbsolutePath(basePath, descriptor.path);
      // Normalize Windows drive letter and forward slashes
      const fileUrl = `file://${absolutePath.replace(/\\/g, "/")}?t=${Date.now()}`;
      try {
        rawModule = await import(/* @vite-ignore */ fileUrl);
      } catch (e: any) {
        throw new Error(`Failed to import script ${descriptor.path}: ${e.message}`);
      }
    } else {
      // Mobile or Safe Mode: Read source text and evaluate via scoped Function
      const code = await this.app.vault.adapter.read(descriptor.path);
      try {
        const moduleExports: { default?: any; command?: any } = {};
        const moduleObj = { exports: moduleExports };

        const safeRequire = (id: string) => {
          if (this.sandbox) {
            this.sandbox.validateModuleAccess(id);
          }
          if (id === "obsidian") return this.app;
          throw new Error(`Cannot require external module "${id}" in sandbox`);
        };

        const wrappedFn = new Function(
          "exports",
          "module",
          "require",
          `"use strict";\n${code}`
        );
        wrappedFn(moduleExports, moduleObj, safeRequire);
        rawModule = moduleObj.exports.default || moduleObj.exports.command || moduleObj.exports;
      } catch (e: any) {
        if (e.name === "SecurityViolationError") {
          throw e;
        }
        throw new Error(`Failed to evaluate script in ${descriptor.path}: ${e.message}`);
      }
    }

    // Resolve exported command instance
    const candidate: any = rawModule?.default ?? rawModule?.command ?? rawModule;

    if (!candidate || typeof candidate !== "object") {
      throw new Error(
        `Script in ${descriptor.path} must export an OCCCommand object (default or named "command")`
      );
    }

    if (!candidate.metadata || typeof candidate.metadata !== "object") {
      throw new Error(`Script in ${descriptor.path} is missing required "metadata" object`);
    }

    this.validateMetadata(candidate.metadata, descriptor.path);

    if (typeof candidate.execute !== "function") {
      throw new Error(`Script in ${descriptor.path} must implement an "execute" function`);
    }

    return candidate as OCCCommand;
  }

  private validateMetadata(metadata: OCCCommandMetadata, filePath: string): void {
    if (!metadata.id || typeof metadata.id !== "string" || metadata.id.trim() === "") {
      throw new Error(`Command in ${filePath} has missing or invalid "id" in metadata`);
    }
    if (!metadata.name || typeof metadata.name !== "string" || metadata.name.trim() === "") {
      throw new Error(`Command in ${filePath} has missing or invalid "name" in metadata`);
    }
  }

  private resolveAbsolutePath(basePath: string, relativePath: string): string {
    const cleanBase = basePath.replace(/\\/g, "/").replace(/\/$/, "");
    const cleanRel = relativePath.replace(/\\/g, "/").replace(/^\//, "");
    return `${cleanBase}/${cleanRel}`;
  }
}
