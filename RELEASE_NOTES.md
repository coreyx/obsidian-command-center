# Obsidian Command Center (OCC) v0.1.0 Release Notes

**Obsidian Command Center (OCC)** is an extensible automation runtime and macro orchestration engine built for [Obsidian](https://obsidian.md). It bridges the gap between simple hotkey macros and heavyweight, standalone community plugins. In OCC, **every command is an open-ended micro-extension** with complete lifecycle hooks, sequential output piping, concurrency queues, background workers, and interactive UI feedback.

This release represents the culmination of all 9 development milestones, fully specified in [`./spec/obsidian-command-center/`](./spec/obsidian-command-center/), verified across 93 automated unit and integration tests, and packed in an ultra-lean production bundle.

---

## What's New in v0.1.0

### 1. Dynamic Discovery & Zero-Downtime Hot-Reloading (Milestones 1 & 2)
- **Automatic Discovery:** Recursively scans your commands folder (`.obsidian/plugins/obsidian-command-center/commands`) for JavaScript scripts (`*.js`, `*.mjs`) and declarative macros (`*.macro.json`).
- **Zero-Downtime Hot-Reloading:** Saving an edited command immediately compiles, validates, and rebinds it to Obsidian's Command Palette without restarting or reloading Obsidian.
- **Hotkey Preservation:** Custom hotkeys assigned in Obsidian's Core Hotkeys settings are preserved across hot-reload cycles.
- **Micro-Extension Lifecycle Contract:** Commands declare lifecycle hooks: `init(context)`, `canExecute(context)`, `execute(context)`, `cleanup(context)`, and `onError(error, context)`.

### 2. Native Command Bridge & Composable Macro Pipelines (Milestone 3)
- **Native Command Invocation:** Invoke any native or third-party Obsidian command programmatically via `context.commands.execute("command-id")`.
- **Sequential Contextual Output Piping:** Return values from step $N$ automatically pipe into step $N+1$ as `context.input` and `context.$prevOutput`. Downstream commands can inspect the full step history via `context.steps`.
- **Declarative JSON Macros:** Define composable multi-step workflows in `*.macro.json` without writing JavaScript.
- **Fault-Tolerant Step Policies:** Each macro step configures its error recovery policy: `halt` (default), `continue` (ignore non-fatal errors), or `fallback` (trigger an alternative recovery command).

### 3. Interactive UI Feedback Kit (Milestone 4)
- **Interactive Action Toasts:** Notices with responsive action buttons (`[Undo]`, `[Retry]`, etc.), variant styles (`primary`, `warning`, `danger`), and dynamic message updates.
- **Modal Input Helpers:** Pre-built modals for single-line/multiline user prompts (`context.ui.prompt()`), confirmations (`context.ui.confirm()`), and fuzzy-search item pickers (`context.ui.suggest()`).
- **Batch Progress Bars:** 60fps-throttled visual progress indicators with step counters and custom status messages for bulk vault tasks.

### 4. Async Execution, Serial FIFO Queues & Schedulers (Milestone 5)
- **Non-Blocking Asynchronous Runner:** Cooperative yielding via `context.yield()` relinquishes the main JavaScript event loop to preserve fluid typing and editor responsiveness during CPU-intensive loops.
- **Named Serial FIFO Queues:** Guarantee strict one-at-a-time serialized execution for file/vault mutations using `metadata.queueName` or `context.queue.push()`. Supports `haltOnError: true` to prevent data corruption.
- **Debounce & Throttle Schedulers:** Built-in execution controls via `metadata.debounce` and `metadata.throttle`, with cancellation via `context.cancelDebounce()`.

### 5. Background Workers & Cancellation (Milestone 6)
- **Detached Background Workers:** Run long-running tasks asynchronously without blocking the UI (`metadata.isBackground: true`).
- **Status Bar Monitor:** Real-time status bar counter displaying active background jobs. Clicking opens the Task Inspector.
- **Task Inspector Modal:** View running/completed/cancelled tasks, active elapsed runtimes, and trigger instant task cancellation.
- **Cooperative Cancellation:** Injects standard `context.abortSignal` (`AbortSignal`) into worker execution and invokes command `cleanup(context)` upon cancellation.

### 6. Command Center Dashboard & Settings UI (Milestone 7)
- **Command Registry Dashboard:** Tabbed settings view displaying all discovered commands, file paths, types (`Script` vs `Macro`), and instant enable/disable toggles.
- **Visual Macro Builder:** Reorderable step list (`↑`/`↓`), step removal, error policy selectors, and one-click compilation to `*.macro.json`.
- **Execution Log Viewer:** 100-entry ring buffer recording execution timestamps, durations, statuses, and error traces, complete with search filtering and "Copy Diagnostics" JSON export.

### 7. Developer Experience (DX), Scaffolding & Type Safety (Milestone 8)
- **Automated Type Generation:** Automatically generates and maintains `occ.d.ts` in your commands directory, providing full TypeScript/JavaScript autocomplete, docstrings, and type safety in external editors like VS Code.
- **Command Scaffolder Wizard:** Run `Command Center: Create New Command` to scaffold a starter script or macro with boilerplate code and open it immediately in an editor tab.
- **Starter Template Library:** One-click installation of 3 production-ready templates:
  - `daily-briefing.js`: Inspects frontmatter and appends tasks.
  - `format-and-export.macro.json`: Formats note and triggers export.
  - `sync-notes-worker.js`: Background task with progress bars and cancellation.

### 8. Hardening, Security & Cross-Platform Polish (Milestone 9)
- **Execution Watchdog:** Guards against runaway synchronous scripts or infinite loops with a configurable execution timeout (default 15 seconds), warning toasts, and background task exemptions.
- **Safe Execution Sandboxing Proxy:** Opt-in Safe Execution Mode masking direct Node.js `child_process`, `cluster`, `worker_threads`, and direct `fs` calls, raising `SecurityViolationError` while preserving safe vault operations via `context.vault`.
- **Cross-Platform Mobile Polish:** Adapts touch hit targets for interactive toasts and modals (minimum 44x44px for WCAG compliance) and hooks into Cordova/Capacitor `pause` and `resume` lifecycle events to suspend/resume queues cleanly.
- **High-Performance Runtimes:** Verified command dispatch overhead strictly below 5ms (< 0.1ms measured) and verified zero memory leaks across 100 consecutive reload cycles.
- **Automated CI/CD:** GitHub Actions CI workflow running typechecking, Vitest test suites, and production bundling on every pull request and push to `main`.

---

## Installation

### Method 1: Via BRAT (Recommended)

1. Ensure the **BRAT** (Beta Reviewers Auto-update Tester) plugin is installed and enabled in Obsidian.
2. In Obsidian, go to **Settings** > **BRAT**.
3. Under **Beta Plugin List**, click **Add Beta plugin**.
4. Enter the repository path:
   ```text
   coreyx/obsidian-command-center
   ```
5. Click **Add Plugin**. BRAT will download `manifest.json`, `main.js`, and `styles.css`.
6. Go to **Settings** > **Community Plugins** and toggle **Command Center** on.

### Method 2: Manual Installation

1. Download the release assets (`main.js`, `manifest.json`, `styles.css`) below.
2. Inside your Obsidian vault, navigate to `.obsidian/plugins/` and create an `obsidian-command-center` folder:
   ```text
   <Vault>/.obsidian/plugins/obsidian-command-center/
   ```
3. Copy `main.js`, `manifest.json`, and `styles.css` into that directory.
4. Reload Obsidian and enable **Command Center** in **Settings** > **Community Plugins**.

---

## Getting Started

1. Open Obsidian's Command Palette (`Ctrl+P` or `Cmd+P`).
2. Run **`Command Center: Create New Command`**.
3. Give your command a name and choose whether you want a JavaScript script (`.js`) or a declarative macro (`.macro.json`).
4. OCC will scaffold the file in your commands directory and open it for editing.
5. Save the file and run your new command directly from the Command Palette!

---

## Verification & Quality
- **Automated Tests:** 93 passing unit & integration tests across 15 test suites.
- **Bundle Size:** ~43 KB minified bundle.
- **License:** [MIT](./LICENSE)
- **Author:** Corey Struzan ([@coreyx](https://github.com/coreyx))
