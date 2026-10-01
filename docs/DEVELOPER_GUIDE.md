# Obsidian Command Center (OCC) Plugin Developer Guide

Welcome to the **Obsidian Command Center (OCC)** developer documentation!

OCC transforms Obsidian's command architecture by treating **every command as an open-ended micro-extension**. Instead of scaffolding, compiling, and distributing an entire boilerplate Obsidian plugin for each workflow or automation, OCC gives you a high-performance runtime environment with zero-downtime hot-reloading, complete lifecycle hooks, concurrency queues, background workers, an interactive UI kit, and full IDE autocomplete.

---

## Table of Contents

1. [Architecture Overview: The Micro-Extension Model](#architecture-overview-the-micro-extension-model)
2. [Quick Start: Your First OCC Command in 60 Seconds](#quick-start-your-first-occ-command-in-60-seconds)
3. [File Formats & Directory Structure](#file-formats--directory-structure)
4. [Type Safety & IDE Autocomplete (`occ.d.ts`)](#type-safety--ide-autocomplete-occdts)
5. [Anatomy of an OCC Command](#anatomy-of-an-occ-command)
6. [The Micro-Extension Lifecycle Contract](#the-micro-extension-lifecycle-contract)
7. [The `ExecutionContext` API Reference](#the-executioncontext-api-reference)
   - [Vault Operations (`context.vault`)](#vault-operations-contextvault)
   - [Interactive UI Kit (`context.ui`)](#interactive-ui-kit-contextui)
   - [Native Command Bridge (`context.commands`)](#native-command-bridge-contextcommands)
   - [Concurrency Queues (`context.queue`)](#concurrency-queues-contextqueue)
   - [Cooperative Yielding (`context.yield`)](#cooperative-yielding-contextyield)
   - [Cancellation (`context.abortSignal`)](#cancellation-contextabortsignal)
   - [Piping & Macro State (`context.input`, `context.$prevOutput`)](#piping--macro-state-contextinput-contextprevoutput)
8. [Declarative Macro Pipelines (`*.macro.json`)](#declarative-macro-pipelines-macrojson)
9. [Advanced Patterns](#advanced-patterns)
   - [Background Workers & Status Bar Integration](#background-workers--status-bar-integration)
   - [Debouncing & Throttling](#debouncing--throttling)
   - [Safe Execution Sandboxing](#safe-execution-sandboxing)
10. [Walkthrough: The Vault Librarian Example](#walkthrough-the-vault-librarian-example)
11. [Testing & Diagnostics](#testing--diagnostics)

---

## Architecture Overview: The Micro-Extension Model

Traditional Obsidian plugin development requires Node.js tooling, TypeScript compilers, bundling configurations, and manual plugin restarts for every minor code iteration.

OCC inverts this paradigm:

| Feature | Standalone Community Plugin | OCC Micro-Extension |
| :--- | :--- | :--- |
| **Setup Time** | 15–30 minutes (scaffold, git, npm, esbuild) | Instant (save a file in your commands folder) |
| **Hot Reloading** | Requires plugin reload or Obsidian restart | **Zero-downtime hot-reloading** (200ms debounce) |
| **Lifecycle Hooks** | Generic `onload` / `onunload` | `init`, `canExecute`, `execute`, `cleanup`, `onError` |
| **Concurrency** | Custom manual locking code | Built-in serial FIFO queues & debouncers |
| **UI Kit** | Custom CSS & manual DOM manipulation | Built-in interactive toasts, prompts, pickers & progress bars |
| **Composition** | Cannot easily chain with other plugins | Seamless output piping & declarative macros |

Every OCC command runs inside Obsidian with full access to the active vault, workspace, editor, and the native command bridge.

---

## Quick Start: Your First OCC Command in 60 Seconds

### Method A: Using the Command Scaffolder Wizard
1. Open Obsidian and press `Ctrl+P` (or `Cmd+P` on macOS) to bring up the Command Palette.
2. Select **`Command Center: Create New Command`**.
3. Enter a name (e.g. `Word Count Inspector`).
4. Select **`JavaScript Script (.js)`**.
5. OCC will generate the boilerplate in your commands folder and automatically open the file for editing.

### Method B: Manual File Creation
In your Obsidian vault, navigate to your configured commands directory (default: `.obsidian/plugins/obsidian-command-center/commands/`) and create `hello-world.js`:

```javascript
/** @type {import('./occ').OCCCommand} */
const command = {
  metadata: {
    id: "hello-world",
    name: "Say Hello World",
  },

  execute(context) {
    context.ui.toast("Hello from Obsidian Command Center!", {
      type: "success",
    });
    return "Hello World!";
  },
};

module.exports = command;
```

Save the file. OCC instantly detects the file, validates its structure, and registers **`Say Hello World`** in Obsidian's Command Palette without restarting!

---

## File Formats & Directory Structure

OCC discovers commands in your configured commands folder (`.obsidian/plugins/obsidian-command-center/commands/`):

```text
.obsidian/plugins/obsidian-command-center/commands/
├── occ.d.ts                      # Generated TypeScript definitions for IDE autocomplete
├── format-note.js                # Single-file JavaScript command
├── daily-briefing.mjs            # Single-file ES module command
├── publish-pipeline.macro.json   # Declarative multi-step macro pipeline
└── vault-librarian/              # Directory bundle (multi-file micro-plugin)
    ├── command.js                # Entry point (or index.js)
    ├── utils.js                  # Helper module
    └── README.md
```

### Supported Formats
1. **Single-File Scripts (`*.js`, `*.mjs`)**: Self-contained micro-extensions exporting an `OCCCommand` object.
2. **Directory Bundles (`<folder>/command.js` or `<folder>/index.js`)**: For more complex micro-extensions that require helper files, assets, or modular organization.
3. **Declarative Macros (`*.macro.json`)**: No-code pipeline configurations chaining native Obsidian commands and OCC scripts.

---

## Type Safety & IDE Autocomplete (`occ.d.ts`)

OCC automatically generates and maintains a comprehensive TypeScript declaration file named **`occ.d.ts`** directly in your commands folder.

To enable full IntelliSense, autocomplete, parameter documentation, and hover types in VS Code or other external editors, include the JSDoc type annotation at the top of your scripts:

```javascript
/** @type {import('./occ').OCCCommand} */
const command = {
  metadata: {
    id: "my-command",
    name: "My Command",
  },
  execute(context) {
    // Typing "context." provides full autocomplete for vault, ui, commands, etc.!
  }
};

module.exports = command;
```

> [!TIP]
> If you ever update OCC or wish to regenerate the declaration file, click **Generate occ.d.ts** in **Settings > Command Center > General Settings**.

---

## Anatomy of an OCC Command

An OCC command is an object adhering to the `OCCCommand` interface:

```typescript
interface OCCCommand {
  metadata: OCCCommandMetadata;
  init?(context: ExecutionContext): Promise<void> | void;
  canExecute?(context: ExecutionContext): Promise<boolean | string> | boolean | string;
  execute(context: ExecutionContext): Promise<unknown> | unknown;
  onError?(error: Error, context: ExecutionContext): Promise<void> | void;
  cleanup?(context: ExecutionContext): Promise<void> | void;
}
```

### The `metadata` Object

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | *(Required)* | Unique machine identifier (e.g. `"daily-summary"`). |
| `name` | `string` | *(Required)* | Display name in Obsidian's Command Palette. |
| `description` | `string` | `undefined` | Optional human-readable description shown in the dashboard. |
| `icon` | `string` | `undefined` | Optional Lucide icon name. |
| `queueName` | `string` | `undefined` | Routes execution to a named serial FIFO queue to prevent concurrent race conditions. |
| `haltOnError` | `boolean` | `false` | When true in a named queue, pauses or cancels subsequent pending tasks on failure. |
| `debounce` | `number` | `undefined` | Quiet period in milliseconds to debounce rapid invocations. |
| `throttle` | `number` | `undefined` | Frequency limit in milliseconds for throttled execution. |
| `timeout` | `number` | `15000` | Execution watchdog timeout in milliseconds. Set `0` to disable. |
| `isBackground` | `boolean` | `false` | When true, runs as a detached background worker exempt from synchronous timeouts. |

---

## The Micro-Extension Lifecycle Contract

OCC commands enjoy a structured lifecycle managed by OCC's `LifecycleManager`:

```
 [File Detected]
        │
        ▼
   init(context) ─────────► Executed once on discovery / reload
        │
        ▼
 [User Invokes Command]
        │
        ▼
canExecute(context) ──────► Pre-execution guard check
        │
   ┌────┴────┐
 [Pass]    [Fail] ────────► Aborts execution (shows warning toast if string)
   │
   ▼
execute(context) ─────────► Main business logic
   │
   ├─────────┬─────────┐
[Success]  [Error]   [Timeout]
   │         │         │
   │         └────┬────┘
   │              ▼
   │      onError(err, ctx) ──► Error boundary & recovery
   │              │
   └──────────────┴───────────► Returns output to pipeline
        │
        ▼
 cleanup(context) ────────► Invoked on reload, disable, or plugin unload
```

### 1. `init(context)`
Executed when OCC first loads or hot-reloads the command. Ideal for warming up caches, reading configuration, or registering standing event listeners.

### 2. `canExecute(context)`
Evaluated immediately before `execute()`.
- Return `true`: Proceed with execution.
- Return `false`: Silently abort.
- Return `string`: Abort and display the string as a warning toast to the user.

```javascript
canExecute(context) {
  if (!context.file) {
    return "Please open a markdown note in the editor before running this command.";
  }
  return true;
}
```

### 3. `execute(context)`
The main execution logic. Can be synchronous or asynchronous (returns a Promise). Any value returned by `execute` becomes available as `context.$prevOutput` to the next command if chained inside a macro.

### 4. `onError(error, context)`
Invoked if `execute()` or `canExecute()` throws an uncaught error, or if the command times out. Allows rolling back state or alerting the user.

### 5. `cleanup(context)`
Invoked when the command is unregistered, hot-reloaded, disabled in settings, or when Obsidian unloads OCC. Clean up timers, abort controllers, and event listeners here.

---

## The `ExecutionContext` API Reference

Every lifecycle hook receives the unified `ExecutionContext` instance:

```typescript
interface ExecutionContext {
  app: App;
  workspace: Workspace;
  vault: VaultHelper;
  editor: Editor | null;
  file: TFile | null;
  input: unknown;
  $prevOutput: unknown;
  steps?: StepRecord[];
  commands: OCCCommandBridge;
  ui: OCCUIHelper;
  queue: OCCQueueHelper;
  abortSignal: AbortSignal;
  yield(): Promise<void>;
  cancelDebounce(id?: string): boolean;
}
```

---

### Vault Operations (`context.vault`)

The `VaultHelper` provides atomic operations for modifying files safely:

```javascript
// 1. Read note content
const content = await context.vault.read(context.file);

// 2. Modify note content atomically
await context.vault.modify(context.file, updatedContent);

// 3. Process YAML frontmatter safely
await context.vault.processFrontmatter(context.file, (frontmatter) => {
  frontmatter.status = "archived";
  frontmatter.reviewedAt = new Date().toISOString();
});

// 4. Create a new note in the vault
const newFile = await context.vault.createNote(
  "Summaries/Meeting-Summary.md",
  "# Meeting Summary\n\nGenerated automatically."
);
```

---

### Interactive UI Kit (`context.ui`)

OCC includes a native UI toolkit for feedback and human-in-the-loop interactions:

#### 1. Interactive Action Toasts
Notices that support clickable action buttons:

```javascript
context.ui.toast("Document formatted successfully.", {
  type: "success",
  duration: 8000,
  actions: [
    {
      label: "Undo",
      variant: "warning",
      onClick: async () => {
        await context.vault.modify(context.file, originalContent);
        context.ui.toast("Restored previous content.", { type: "info" });
      },
    },
  ],
});
```

#### 2. Text Prompts (`context.ui.prompt`)
Prompt the user for input with single-line or multiline modals:

```javascript
const tag = await context.ui.prompt({
  title: "Add Document Tag",
  placeholder: "e.g. project/alpha",
  defaultValue: "status/draft",
  multiline: false,
});

if (tag) {
  // User submitted tag
}
```

#### 3. Confirmations (`context.ui.confirm`)
Request explicit user confirmation before destructive actions:

```javascript
const confirmed = await context.ui.confirm({
  title: "Delete All Archive Backlinks?",
  message: "This will remove all obsolete link blocks from the current note.",
  confirmLabel: "Delete Links",
  cancelLabel: "Cancel",
});

if (!confirmed) return;
```

#### 4. Suggest Pickers (`context.ui.suggest`)
Fuzzy search pickers for choosing from lists or collections of objects:

```javascript
const choice = await context.ui.suggest(
  [
    { id: "compact", label: "Compact Summary (Bullet Points)" },
    { id: "full", label: "Full Summary (With Headings & Tags)" },
  ],
  {
    title: "Select Formatting Style",
    renderItem: (item) => item.label,
  }
);
```

#### 5. Batch Progress Bars (`context.ui.createProgress`)
Smooth, 60fps-throttled progress bars for bulk tasks:

```javascript
const progress = context.ui.createProgress({
  title: "Backlinking Vault Notes",
  total: 50,
  initialMessage: "Starting pass...",
});

for (let i = 1; i <= 50; i++) {
  await context.yield(); // Keep Obsidian responsive!
  progress.update({ current: i, message: `Processing note ${i} of 50...` });
}

progress.finish("Completed all 50 notes!");
```

---

### Native Command Bridge (`context.commands`)

Invoke native Obsidian commands or commands from other installed community plugins:

```javascript
// Execute a native Obsidian command by ID
await context.commands.execute("editor:toggle-fold");

// Query all registered Obsidian commands
const commands = context.commands.listCommands();
```

---

### Concurrency Queues (`context.queue`)

Prevent race conditions when multiple operations mutate the vault:

```javascript
// Enqueue a vault mutation on the named "vault-writer" queue
await context.queue.push("vault-writer", async () => {
  const content = await context.vault.read(file);
  await context.vault.modify(file, content + "\nAppended line");
});
```

---

### Cooperative Yielding (`context.yield`)

When running CPU-intensive operations (parsing large markdown documents, iterating thousands of files), call `await context.yield()` periodically. This relinquishes the main JavaScript thread, allowing Obsidian to render frames, process keystrokes, and maintain typing responsiveness:

```javascript
for (const file of allFiles) {
  await processFile(file);
  await context.yield(); // Prevents UI freezes!
}
```

---

### Cancellation (`context.abortSignal`)

Background workers and long-running jobs receive an `AbortSignal` on `context.abortSignal`. Check `signal.aborted` regularly or attach listeners:

```javascript
if (context.abortSignal.aborted) {
  throw new Error("Operation cancelled by user");
}

context.abortSignal.addEventListener("abort", () => {
  // Clean up ongoing connections or handles
});
```

---

### Piping & Macro State (`context.input`, `context.$prevOutput`)

In composable macro pipelines, output from step $N$ flows into step $N+1$:

```javascript
// Step 1 returns structured data
execute(context) {
  return { wordCount: 450, sentiment: "positive" };
}

// Step 2 receives that data as $prevOutput
execute(context) {
  const prev = context.$prevOutput;
  console.log(`Previous step word count: ${prev.wordCount}`);
}
```

---

## Declarative Macro Pipelines (`*.macro.json`)

Macros allow you to combine custom OCC commands and native Obsidian commands into reusable workflows without writing code:

```json
{
  "id": "publish-pipeline",
  "name": "Publish Document Pipeline",
  "description": "Formats active note, updates frontmatter, and exports to PDF.",
  "icon": "share",
  "steps": [
    {
      "commandId": "vault-librarian",
      "name": "Audit & Format Note",
      "onError": "halt"
    },
    {
      "commandId": "editor:save-file",
      "name": "Save File",
      "onError": "continue"
    },
    {
      "commandId": "app:export-pdf",
      "name": "Export Note as PDF",
      "onError": "fallback",
      "fallbackCommandId": "editor:open-search"
    }
  ]
}
```

### Step Error Policies
- **`halt` (Default)**: Immediately stops pipeline execution and displays an error toast.
- **`continue`**: Logs the step error and continues to the next step.
- **`fallback`**: Invokes a designated `fallbackCommandId` before proceeding.

---

## Advanced Patterns

### Background Workers & Status Bar Integration

Declare `isBackground: true` in your metadata to spawn detached background jobs:

```javascript
const command = {
  metadata: {
    id: "vault-indexer-worker",
    name: "Index Vault in Background",
    isBackground: true,
  },

  async execute(context) {
    const files = context.app.vault.getMarkdownFiles();
    for (let i = 0; i < files.length; i++) {
      if (context.abortSignal.aborted) return;
      await context.yield();
      // process file...
    }
  },

  cleanup(context) {
    console.log("Background worker cancelled or finished.");
  }
};
```

When running, OCC displays a badge in the Obsidian status bar. Clicking the status bar opens the **Task Inspector**, allowing users to view runtime durations and trigger instant cooperative cancellation.

---

### Debouncing & Throttling

Control execution frequency for high-frequency events (e.g. editor changes or hotkey repeats):

```javascript
const command = {
  metadata: {
    id: "auto-format-on-type",
    name: "Auto Format Active Section",
    debounce: 400, // Waits 400ms after the last invocation before executing
  },
  execute(context) {
    // Executes only after a 400ms quiet window
  }
};
```

Cancel pending debounces at any time with `context.cancelDebounce()`.

---

### Safe Execution Sandboxing

OCC provides an optional **Safe Execution Mode** (configurable in **Settings > Command Center > General Settings**).

When enabled, OCC isolates script evaluation in a sandboxed Proxy environment that blocks:
- Node.js `child_process` / `node:child_process`
- Node.js `cluster` and `worker_threads`
- Direct external filesystem calls (`fs`, `node:fs`) outside the vault

All file mutations are strictly restricted to the Obsidian vault via `context.vault`. Attempting to access forbidden modules throws a `SecurityViolationError`.

---

## Walkthrough: The Vault Librarian Example

The reference example micro-extension is available in [`examples/vault-librarian/command.js`](../examples/vault-librarian/command.js).

It illustrates:
1. **Validation**: Uses `canExecute` to verify an active markdown note is open.
2. **Atomic Vault Access**: Reads and modifies note content using `context.vault.read` and `context.vault.modify`.
3. **UI Prompts & Pickers**: Presents choices via `context.ui.suggest` and `context.ui.prompt`.
4. **Interactive Undo**: Preserves a content snapshot and attaches an **[Undo]** button to an interactive toast.
5. **Serial Queue Protection**: Declares `queueName: "vault-mutations"` so that multiple simultaneous executions never overwrite each other.

---

## Testing & Diagnostics

### Viewing Execution Telemetry
Navigate to **Settings > Command Center > Execution Logs** to view:
- Command name, ID, and execution status (`Success` vs `Error`).
- Millisecond runtime durations.
- Full error stack traces.
- One-click **Copy Diagnostics** button exporting sanitized JSON logs.

### Automated Unit Testing
You can write unit tests for your OCC commands using [Vitest](https://vitest.dev). Inspect [`tests/examples.test.ts`](../tests/examples.test.ts) for a full example of mocking Obsidian's `App` and verifying command execution in an automated CI environment.

---

## Author & License

- **Author:** Corey Struzan ([@coreyx](https://github.com/coreyx))
- **Repository:** [`coreyx/obsidian-command-center`](https://github.com/coreyx/obsidian-command-center)
- **License:** [MIT](../LICENSE)
