# OCC Example Plugins & Macros

This directory contains reference implementations of **Obsidian Command Center (OCC)** micro-extensions and macro workflows.

---

## Included Examples

### 1. `vault-librarian/` (Full Micro-Extension Bundle)
A production-ready note auditor and organization tool demonstrating:
- **Directory-Bundle Structure**: Organized in a dedicated subfolder with `command.js`.
- **Complete Lifecycle Hooks**:
  - `init(context)`: State and snapshot cache initialization.
  - `canExecute(context)`: Pre-execution validation ensuring an active markdown note is open (returns warning toast if closed).
  - `execute(context)`: Main async payload.
  - `onError(error, context)`: Recovery boundary and user error alerts.
  - `cleanup(context)`: Memory teardown on reload or disable.
- **VaultHelper Operations**: Atomic reading (`context.vault.read`), modification (`context.vault.modify`), and YAML frontmatter processing (`context.vault.processFrontmatter`).
- **UI Kit Integrations**:
  - Suggest picker menu (`context.ui.suggest`).
  - Interactive Action Toasts with clickable **[Undo]** and **[Copy]** buttons (`context.ui.toast`).
  - Text prompts (`context.ui.prompt`).
- **Cooperative Concurrency**:
  - Main thread yielding via `await context.yield()` to keep Obsidian UI fluid.
  - Serial queue execution (`metadata.queueName: "vault-mutations"`) to prevent note write collisions.
  - Watchdog timeout protection (`metadata.timeout: 10000`).

### 2. `daily-review.macro.json` (Declarative Macro Pipeline)
A multi-step macro demonstrating:
- Composing a custom OCC command (`vault-librarian`) with native Obsidian commands (`editor:save-file`).
- Non-blocking step error handling policies (`onError: "continue"`).
- Contextual output piping (`context.$prevOutput`).

---

## How to Install in Your Vault

1. Ensure the **Obsidian Command Center** plugin is installed and enabled in your vault.
2. Open your vault's command folder:
   ```text
   <Vault>/.obsidian/plugins/obsidian-command-center/commands/
   ```
3. Copy either:
   - The entire `vault-librarian/` folder into your commands directory.
   - The `daily-review.macro.json` file into your commands directory.
4. OCC will automatically detect the new commands via hot-reloading.
5. Press `Ctrl+P` or `Cmd+P` in Obsidian and type **Vault Librarian** or **Daily Review Pipeline** to run!
