import {
  DAILY_BRIEFING_TEMPLATE,
  FORMAT_AND_EXPORT_MACRO_TEMPLATE,
  SYNC_NOTES_WORKER_TEMPLATE,
} from "../templates/starterTemplates";

export interface ScaffoldOptions {
  name: string;
  type: "script" | "macro";
}

export class CommandScaffolder {
  /**
   * Generates a slugified command identifier.
   */
  public slugify(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "my-command"
    );
  }

  /**
   * Scaffolds a new command script or macro definition and opens it in an active editor.
   */
  public async scaffoldCommand(
    options: ScaffoldOptions,
    commandsDir: string,
    vault: any,
    workspace?: any
  ): Promise<string> {
    const slug = this.slugify(options.name);
    const isScript = options.type === "script";
    const filename = isScript ? `${slug}.js` : `${slug}.macro.json`;
    const fullPath = `${commandsDir}/${filename}`.replace(/\/+/g, "/");

    let content: string;
    if (isScript) {
      content = `/// <reference path="./occ.d.ts" />

export const metadata = {
  id: "${slug}",
  name: "${options.name}",
  icon: "command",
  description: "Custom command created with Command Center scaffolder.",
};

export async function canExecute(context) {
  return true;
}

export async function execute(context) {
  context.ui.toast("Hello from ${options.name}!", { type: "info" });
  return { success: true };
}

export function onError(err, context) {
  console.error("[Command Error - ${slug}]:", err);
}
`;
    } else {
      content = JSON.stringify(
        {
          id: slug,
          name: options.name,
          description: "Declarative macro pipeline created with Command Center scaffolder.",
          steps: [
            {
              id: "step-1",
              commandId: "editor:toggle-fold",
              onError: "continue",
            },
          ],
        },
        null,
        2
      );
    }

    const adapter = vault.adapter;
    if (adapter) {
      if (typeof adapter.exists === "function" && !(await adapter.exists(commandsDir))) {
        if (typeof vault.createFolder === "function") {
          await vault.createFolder(commandsDir);
        }
      }
      if (typeof adapter.write === "function") {
        await adapter.write(fullPath, content);
      }
    }

    // Automatically open in workspace if available
    if (workspace && typeof workspace.openLinkText === "function") {
      try {
        await workspace.openLinkText(filename, fullPath, true);
      } catch (e) {
        // Fallback or ignore if openLinkText is unavailable in mock
      }
    }

    return fullPath;
  }

  /**
   * Installs the bundled starter command template library into the commands directory.
   */
  public async installStarterTemplates(commandsDir: string, vault: any): Promise<string[]> {
    const templates: Array<{ filename: string; content: string }> = [
      { filename: "daily-briefing.js", content: DAILY_BRIEFING_TEMPLATE },
      { filename: "format-and-export.macro.json", content: FORMAT_AND_EXPORT_MACRO_TEMPLATE },
      { filename: "sync-notes-worker.js", content: SYNC_NOTES_WORKER_TEMPLATE },
    ];

    const adapter = vault.adapter;
    if (adapter && typeof adapter.exists === "function" && !(await adapter.exists(commandsDir))) {
      if (typeof vault.createFolder === "function") {
        await vault.createFolder(commandsDir);
      }
    }

    const installedPaths: string[] = [];
    for (const t of templates) {
      const fullPath = `${commandsDir}/${t.filename}`.replace(/\/+/g, "/");
      if (adapter && typeof adapter.write === "function") {
        await adapter.write(fullPath, t.content);
        installedPaths.push(fullPath);
      }
    }

    return installedPaths;
  }
}
