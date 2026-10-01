/**
 * @type {import('../../src/types/command').OCCCommand}
 * 
 * Vault Librarian — An Example Micro-Extension Plugin for Obsidian Command Center (OCC).
 * Demonstrates the full OCC lifecycle, VaultHelper, UI helpers, queue scheduling,
 * cooperative event loop yielding, and interactive undo toasts.
 */

// In-memory snapshot cache for supporting interactive undo actions
const contentSnapshots = new Map();

const command = {
  metadata: {
    id: "vault-librarian",
    name: "Vault Librarian: Inspect & Organize Note",
    description: "Audits note frontmatter, calculates metrics, suggests tags, and provides interactive undo.",
    icon: "library",
    queueName: "vault-mutations", // Enforces serial FIFO execution for note writes
    timeout: 10000,               // 10s execution watchdog guard
  },

  /**
   * Lifecycle: Called when OCC registers or hot-reloads the command.
   */
  init(context) {
    // Perform any startup initialization or state cache prep
    contentSnapshots.clear();
  },

  /**
   * Lifecycle: Pre-execution guard.
   * Return true to proceed, false to abort silently, or a string to abort with a warning toast.
   */
  canExecute(context) {
    if (!context.file) {
      return "Please open a markdown note in the editor before running Vault Librarian.";
    }
    return true;
  },

  /**
   * Lifecycle: Main execution payload.
   */
  async execute(context) {
    const file = context.file;
    if (!file) return null;

    // 1. Read note content using atomic VaultHelper
    const originalContent = await context.vault.read(file);

    // Save snapshot for interactive undo
    contentSnapshots.set(file.path, originalContent);

    // 2. Yield event loop so Obsidian UI remains 100% responsive
    await context.yield();

    // 3. Compute note analytics
    const words = (originalContent.match(/\b\w+\b/g) || []).length;
    const lines = originalContent.split("\n").length;
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

    // 4. Prompt the user to choose an action via OCC suggest picker
    const choices = [
      {
        id: "stats",
        label: `Insert Stats Block (${words} words, ~${readingTimeMinutes} min read)`,
      },
      {
        id: "tags",
        label: "Audit & Add Frontmatter Tag",
      },
      {
        id: "notify",
        label: "Show Interactive Analytics Toast",
      },
    ];

    const selected = await context.ui.suggest(choices, {
      title: "Vault Librarian — Select Action",
      renderItem: (item) => item.label,
    });

    if (!selected) {
      context.ui.toast("Vault Librarian cancelled by user.", { type: "info" });
      return { cancelled: true };
    }

    let actionTaken = selected.id;

    // 5. Execute chosen action
    if (selected.id === "stats") {
      const statsBlock = `> [!INFO] Document Metrics\n> - **Word Count:** ${words}\n> - **Lines:** ${lines}\n> - **Estimated Reading Time:** ${readingTimeMinutes} min\n\n`;
      const newContent = statsBlock + originalContent;
      await context.vault.modify(file, newContent);

      // Offer instant Undo toast with interactive action button
      context.ui.toast("Inserted document metrics block.", {
        type: "success",
        actions: [
          {
            label: "Undo",
            variant: "warning",
            onClick: async () => {
              const previous = contentSnapshots.get(file.path);
              if (previous !== undefined) {
                await context.vault.modify(file, previous);
                context.ui.toast("Restored previous note content.", { type: "info" });
              }
            },
          },
        ],
      });
    } else if (selected.id === "tags") {
      const newTag = await context.ui.prompt({
        title: "Vault Librarian — Add Tag",
        placeholder: "e.g. status/in-progress, review, archive",
      });

      if (newTag && newTag.trim()) {
        const cleanTag = newTag.trim().replace(/^#/, "");
        await context.vault.processFrontmatter(file, (fm) => {
          if (!Array.isArray(fm.tags)) {
            fm.tags = fm.tags ? [String(fm.tags)] : [];
          }
          if (!fm.tags.includes(cleanTag)) {
            fm.tags.push(cleanTag);
          }
        });

        context.ui.toast(`Added tag #${cleanTag} to frontmatter.`, {
          type: "success",
        });
      }
    } else if (selected.id === "notify") {
      context.ui.toast(
        `Note Analytics: ${words} words • ${lines} lines • ~${readingTimeMinutes} min read`,
        {
          type: "info",
          actions: [
            {
              label: "Copy Word Count",
              variant: "primary",
              onClick: () => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(String(words));
                  context.ui.toast("Copied word count to clipboard!", { type: "success" });
                }
              },
            },
          ],
        }
      );
    }

    // 6. Return structured output for sequential macro chaining ($prevOutput)
    return {
      filePath: file.path,
      action: actionTaken,
      wordCount: words,
      lineCount: lines,
      readingTimeMinutes,
      timestamp: Date.now(),
    };
  },

  /**
   * Lifecycle: Error recovery boundary.
   */
  async onError(error, context) {
    console.error(`[Vault Librarian Error]:`, error);
    context.ui.toast(`Vault Librarian encountered an error: ${error.message}`, {
      type: "error",
    });
  },

  /**
   * Lifecycle: Called when command is reloaded, removed, or plugin unloads.
   */
  cleanup(context) {
    contentSnapshots.clear();
  },
};

module.exports = command;
