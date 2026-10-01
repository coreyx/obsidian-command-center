# Release Notes — Obsidian Command Center v0.1.0

**Obsidian Command Center (OCC)** v0.1.0 is the initial beta release providing an extensible, zero-downtime automation runtime and macro orchestration engine for Obsidian.

---

## What's New in v0.1.0

### 🚀 Core Engine & Dynamic Command Loader
- **Zero-Downtime Micro-Extensions:** Drop any JavaScript (`.js`, `.mjs`) or declarative JSON (`.json`) file into your commands folder (`.obsidian/plugins/obsidian-command-center/commands/`), and it is immediately validated and registered with Obsidian's Command Palette without restarting the application.
- **Directory Bundles:** Group complex automations into dedicated folders containing `command.js` or `index.js`.
- **Full Micro-Extension Lifecycle:** Commands can implement `init(context)`, `canExecute(context)`, `execute(context)`, `cleanup(context)`, and `onError(error, context)` hooks.
- **Hotkey Preservation:** User-assigned hotkeys are automatically preserved when scripts are hot-reloaded on disk.

### 🔗 Native Command Bridge & Composable Macros
- **Execute Native Commands:** Programmatically trigger core or community commands from scripts using `context.commands.execute(commandId)`.
- **Declarative Macro Pipelines:** Build multi-step automation chains via `*.macro.json` without writing code.
- **Sequential Output Piping:** Step return values automatically flow into downstream steps as `context.input` and `context.$prevOutput`.
- **Step Recovery Policies:** Configure step error handling policies:
  - `halt`: Abort macro and display error notification (default).
  - `continue`: Log step failure and proceed to subsequent steps.
  - `fallback`: Execute a designated fallback command upon failure.

### 🛡️ Safety & Fault Isolation
- **Error Boundaries:** Broken scripts or unhandled exceptions are caught gracefully and will never crash the host Obsidian application.
- **Pre-execution Preconditions:** Commands can declare `canExecute(context)` to conditionally enable or disable invocation based on active note state.

---

## Installation via BRAT

To install this release via **BRAT**:
1. Open Obsidian Settings > **Community Plugins** > **BRAT**.
2. Click **Add Beta plugin**.
3. Enter `coreyx/obsidian-command-center`.
4. Enable **Command Center** in your Community Plugins list.

---

## Release Assets
- `main.js` (Core plugin bundle)
- `manifest.json` (Plugin metadata)
- `styles.css` (Plugin styles)
