# Obsidian Command Center (OCC) — Requirements Specification

> **Document Version:** 1.0.0  
> **Methodology:** EARS (Easy Approach to Requirements Syntax)  
> **Status:** Approved Baseline  
> **Reference Documents:** [product.md](./product.md), [milestones.md](./milestones.md)  

---

## 1. Introduction & EARS Pattern Guide

This document specifies the functional, operational, and non-functional requirements for the **Obsidian Command Center (OCC)** plugin. All requirements are documented using the **Easy Approach to Requirements Syntax (EARS)**:

- **Ubiquitous:** *The <system> shall <system response>.*
- **Event-Driven:** *When <trigger>, the <system> shall <system response>.*
- **State-Driven:** *While <in state>, the <system> shall <system response>.*
- **Unwanted Behavior:** *If <condition/trigger>, then the <system> shall <system response>.*
- **Optional Feature:** *Where <feature/condition>, the <system> shall <system response>.*
- **Complex:** *While <in state>, when <trigger>, the <system> shall <system response>.*

Each requirement includes an **Identifier & Title**, an **Associated User Story**, the formal **EARS Statement**, and a set of **Subsection-Numbered Acceptance Criteria**.

---

## Section 1: Command Discovery & Lifecycle Management

### REQ-01: Dynamic Command Discovery
- **User Story:** As an Obsidian power user, I want OCC to automatically scan my designated commands folder for scripts and macro files so that I do not have to manually register or configure each command in settings.
- **EARS Pattern:** Event-Driven
- **Requirement Statement:** When the plugin initializes or the commands directory path is modified, OCC shall scan the configured directory, parse all supported definition files (`.js`, `.mjs`, `.json`), and register valid definitions with Obsidian's command registry.
- **Acceptance Criteria:**
  - **1.1:** OCC shall discover commands stored in the default directory (`.obsidian/plugins/obsidian-command-center/commands/`) or a user-customized vault path.
  - **1.2:** OCC shall recursively traverse subdirectories within the commands directory to locate single-file commands or folder-bundled commands containing an entrypoint file (`command.js` or `index.js`).
  - **1.3:** OCC shall validate that each discovered command has a unique `id` and human-readable `name` before registering it with Obsidian's command palette.

---

### REQ-02: Zero-Downtime Hot-Reloading
- **User Story:** As an extension developer, I want my command scripts to update immediately in Obsidian when saved on disk so that I can develop and test automations rapidly without restarting Obsidian.
- **EARS Pattern:** Event-Driven
- **Requirement Statement:** When an existing command file is modified and saved on disk, OCC shall unbind the old command instance, invoke its cleanup lifecycle, re-evaluate the modified file, and re-register the updated command with Obsidian's command registry.
- **Acceptance Criteria:**
  - **2.1:** OCC shall utilize a file-system watcher to detect file modifications within 200 milliseconds of the save event.
  - **2.2:** OCC shall execute the existing command's `cleanup()` hook (if defined) prior to unloading the module from memory.
  - **2.3:** OCC shall preserve existing user-assigned hotkeys for the reloaded command when re-registering it with Obsidian.

---

### REQ-03: Dynamic Command Removal
- **User Story:** As a user, I want commands to be removed from the Obsidian command palette as soon as I delete their file so that my command list stays clean and free of stale commands.
- **EARS Pattern:** Event-Driven
- **Requirement Statement:** When a command file or folder is deleted from the commands directory, OCC shall invoke the command's cleanup hook and unregister the command from Obsidian's command registry.
- **Acceptance Criteria:**
  - **3.1:** OCC shall immediately remove the command from the Obsidian Command Palette upon file deletion.
  - **3.2:** OCC shall cancel any active background tasks or queued instances associated with the deleted command.
  - **3.3:** OCC shall remove the deleted command from the in-memory Command Registry table.

---

### REQ-04: Micro-Extension Lifecycle Contract
- **User Story:** As a script author, I want a well-defined lifecycle contract (`init`, `canExecute`, `execute`, `cleanup`, `onError`) so that my command can initialize resources, validate runtime preconditions, and release memory safely.
- **EARS Pattern:** Ubiquitous
- **Requirement Statement:** The OCC runtime shall execute command lifecycle hooks in the strict order: `init` upon registration, `canExecute` prior to invocation, `execute` upon trigger, `cleanup` upon disposal, and `onError` upon unhandled exceptions.
- **Acceptance Criteria:**
  - **4.1:** OCC shall invoke `init(context)` exactly once when a command is first loaded or reloaded.
  - **4.2:** OCC shall pass the active `ExecutionContext` to all lifecycle hooks.
  - **4.3:** OCC shall invoke `cleanup(context)` whenever the command is reloaded, deleted, or when the OCC plugin itself is unloaded.

---

### REQ-05: Pre-Execution Context Validation
- **User Story:** As a user, I want commands that require specific conditions (e.g. an open markdown file) to be hidden or disabled when those conditions are not met so that I do not run commands in invalid contexts.
- **EARS Pattern:** State-Driven
- **Requirement Statement:** While evaluating commands for display or execution, OCC shall invoke the command's `canExecute(context)` hook and suppress execution if the hook returns `false`.
- **Acceptance Criteria:**
  - **5.1:** If `canExecute(context)` returns `false` or a rejected promise, OCC shall halt execution before `execute()` is called.
  - **5.2:** Where `canExecute` returns `false` with a descriptive string reason, OCC shall display a non-intrusive warning notice explaining why the command cannot run.
  - **5.3:** If `canExecute` is omitted in the command definition, OCC shall assume the command is always executable (`true`).

---

### REQ-06: Error Boundary & Fault Isolation
- **User Story:** As a user, I want a script failure in one command to be isolated so that a single broken automation does not crash Obsidian or break other commands.
- **EARS Pattern:** Unwanted Behavior
- **Requirement Statement:** If an uncaught exception or unhandled promise rejection occurs during the execution of any command hook, then OCC shall capture the exception, invoke the command's `onError(error, context)` hook, log the diagnostic trace to the OCC log console, and display an error toast to the user.
- **Acceptance Criteria:**
  - **6.1:** An error in any command shall never propagate to the Obsidian global error handler or terminate other running commands.
  - **6.2:** If `onError` is provided by the command, it shall receive the caught error and active context to perform custom recovery or state rollback.
  - **6.3:** If `onError` itself throws an error, OCC shall safely catch it, log it to the diagnostic console, and display a fallback notice.

---

## Section 2: Execution Context & Pipeline

### REQ-07: Standard Execution Context Injection
- **User Story:** As an automation author, I want my command to have ready-made access to the Obsidian app, active editor, vault helpers, and UI utilities so that I do not have to write boilerplate helper code.
- **EARS Pattern:** Ubiquitous
- **Requirement Statement:** The OCC runtime shall construct and inject a populated `ExecutionContext` instance into every command invocation containing references to `app`, `vault`, `workspace`, `editor`, `file`, `input`, `ui`, and `abortSignal`.
- **Acceptance Criteria:**
  - **7.1:** `context.app` shall provide direct access to the global Obsidian `App` instance.
  - **7.2:** `context.editor` and `context.file` shall automatically resolve to the currently focused editor and active file, or `null` if no document is focused.
  - **7.3:** `context.vault` shall provide convenience utilities for atomic file reads, writes, and frontmatter mutations.

---

### REQ-08: Sequential Output Piping
- **User Story:** As a macro creator, I want the output returned by one command to be available as input to the next command so that I can build composable data pipelines.
- **EARS Pattern:** State-Driven
- **Requirement Statement:** While executing a composite command or macro sequence, OCC shall capture the return value of step $N$ and supply it as `context.input` (and `$prevOutput`) to step $N+1$.
- **Acceptance Criteria:**
  - **8.1:** Return values of primitive types (string, number, boolean) and JSON-serializable objects shall be forwarded without modification.
  - **8.2:** If a step returns `undefined` or `null`, downstream steps shall receive the previous non-null output or an empty input payload based on the macro configuration.
  - **8.3:** Downstream steps shall be able to reference previous outputs by step index (e.g. `context.steps[0].output`).

---

## Section 3: Native Command Bridge & Macros

### REQ-09: Native Obsidian Command Invocation
- **User Story:** As an automation creator, I want to programmatically invoke any existing Obsidian command (from core or other community plugins) by its command ID so that I can integrate existing features into my scripts.
- **EARS Pattern:** Event-Driven
- **Requirement Statement:** When a script calls `context.commands.execute(commandId)` or a macro step specifies an Obsidian command ID, OCC shall dispatch the command via Obsidian's internal command bus and return a promise resolving on completion.
- **Acceptance Criteria:**
  - **9.1:** OCC shall verify that the specified `commandId` exists in `app.commands.commands` prior to dispatch.
  - **9.2:** If the target command does not exist or fails validation, OCC shall reject the promise with a descriptive `CommandNotFoundError`.
  - **9.3:** OCC shall support passing synthetic parameters or setting active view state when invoking native commands where supported.

---

### REQ-10: Declarative Macro Orchestration
- **User Story:** As a no-code user, I want to write a simple JSON or YAML file listing Obsidian command IDs so that I can run them sequentially as a single macro without writing JavaScript.
- **EARS Pattern:** Event-Driven
- **Requirement Statement:** When a declarative macro is executed, OCC shall iterate through the declared steps sequentially, waiting for each step to resolve before advancing to the subsequent step.
- **Acceptance Criteria:**
  - **10.1:** A declarative macro file shall support specifying an array of steps, where each step defines a `commandId`, optional static parameters, and prompt configurations.
  - **10.2:** OCC shall enforce sequential execution order matching the array order in the macro definition.
  - **10.3:** The macro shall register in Obsidian's command palette under the macro's declared `name` and `id`.

---

### REQ-11: Macro Step Fallback & Error Handling Strategy
- **User Story:** As a macro builder, I want to configure whether a failed step stops the entire macro or continues anyway so that my workflows can handle optional or non-critical actions gracefully.
- **EARS Pattern:** Unwanted Behavior
- **Requirement Statement:** If a step in a declarative macro fails, then OCC shall evaluate the step's configured `onError` policy (`halt`, `continue`, or `fallback`) and execute the designated recovery action.
- **Acceptance Criteria:**
  - **11.1:** When `onError` is set to `halt` (default), execution shall immediately terminate, rollback hooks shall fire, and an error notification shall be displayed.
  - **11.2:** When `onError` is set to `continue`, the error shall be logged to diagnostics and the macro engine shall proceed immediately to the next step.
  - **11.3:** When `onError` specifies a `fallbackCommandId`, OCC shall execute the fallback command before resuming or halting.

---

## Section 4: Concurrency, Queuing & Scheduling

### REQ-12: Non-Blocking Asynchronous Execution
- **User Story:** As an Obsidian user, I want long-running commands to execute asynchronously so that my typing and navigation in Obsidian never freeze or stutter.
- **EARS Pattern:** Ubiquitous
- **Requirement Statement:** The OCC execution engine shall execute all asynchronous commands using standard Promise microtasks and macrotasks without blocking Obsidian’s main UI render loop.
- **Acceptance Criteria:**
  - **12.1:** Any command returning a Promise shall run asynchronously without locking the Obsidian user interface.
  - **12.2:** Heavy computation or batch operations shall yield execution back to the browser event loop using cooperative yielding (`requestAnimationFrame` or `setTimeout(0)`).
  - **12.3:** Command execution shall not delay or drop keystrokes in the active editor.

---

### REQ-13: Serial FIFO Task Queuing
- **User Story:** As a power user, I want operations that modify the same notes or files to execute in a strict sequential queue so that concurrent runs do not cause file write conflicts or race conditions.
- **EARS Pattern:** State-Driven
- **Requirement Statement:** While a named queue has pending tasks, OCC shall dequeue and execute tasks in First-In-First-Out (FIFO) order, ensuring only one task per queue runs concurrently.
- **Acceptance Criteria:**
  - **13.1:** Commands shall have the option to declare a `queueName` in their metadata or enqueue jobs via `context.queue.push(queueName, task)`.
  - **13.2:** Tasks assigned to the same `queueName` shall execute strictly one after another.
  - **13.3:** If a queued task fails, subsequent queued tasks shall still execute unless the queue was explicitly configured with `haltOnError: true`.

---

### REQ-14: Command Debouncing and Throttling
- **User Story:** As an automation crafter, I want to debounce or throttle commands hooked to high-frequency events (like editor change or vault modify) so that my commands do not trigger hundreds of times per minute.
- **EARS Pattern:** State-Driven
- **Requirement Statement:** While a debounced or throttled command is triggered repeatedly within its configured window, OCC shall delay or rate-limit invocation according to the declared interval.
- **Acceptance Criteria:**
  - **14.1:** Commands declaring a `debounce: <ms>` attribute shall postpone execution until `<ms>` milliseconds have elapsed since the last trigger.
  - **14.2:** Commands declaring a `throttle: <ms>` attribute shall execute at most once per `<ms>` milliseconds.
  - **14.3:** Cancellation of a pending debounced invocation shall be supported via `context.cancelDebounce()`.

---

## Section 5: Background Workers & Cancellation

### REQ-15: Background Task Runner & Status Bar Indicator
- **User Story:** As a user, I want background tasks (such as batch metadata updates or remote synchronization) to display their status in the Obsidian status bar so that I know what is running and when it finishes.
- **EARS Pattern:** State-Driven
- **Requirement Statement:** While any command is executing as a background task, OCC shall display an active indicator and human-readable status message in the Obsidian status bar.
- **Acceptance Criteria:**
  - **15.1:** OCC shall register an item in the Obsidian status bar that updates dynamically when background tasks start, report progress, or terminate.
  - **15.2:** Clicking the status bar item shall open the OCC Task Inspector modal showing all active, pending, and recently completed tasks.
  - **15.3:** When all background tasks complete, the status bar indicator shall return to an idle state or hide based on user settings.

---

### REQ-16: Cooperative Task Cancellation
- **User Story:** As a user, I want to cancel a stuck or long-running background task from the UI so that I can stop unwanted actions without quitting Obsidian.
- **EARS Pattern:** Event-Driven
- **Requirement Statement:** When a user clicks the "Cancel" action on a running background task, OCC shall trigger the associated `AbortController` and pass an aborted `AbortSignal` to the running command.
- **Acceptance Criteria:**
  - **16.1:** `context.abortSignal` shall be standard `AbortSignal` instance.
  - **16.2:** Commands that listen to `abortSignal.onabort` or pass the signal to `fetch()` shall gracefully abort execution.
  - **16.3:** Upon cancellation, OCC shall update the task status to `Cancelled` and invoke the command's `cleanup(context)` hook.

---

## Section 6: Interactive Feedback & Human-in-the-Loop UI

### REQ-17: Interactive Action Toasts
- **User Story:** As a user, I want notifications to contain interactive buttons (such as `[Undo]`, `[Open]`, or `[Retry]`) so that I can immediately respond to command results.
- **EARS Pattern:** Ubiquitous
- **Requirement Statement:** The OCC UI utility (`context.ui.toast`) shall render enhanced toast notifications capable of displaying custom labels, icons, variant colors, and clickable action buttons with callback handlers.
- **Acceptance Criteria:**
  - **17.1:** A toast shall support defining one or more action buttons, each with a text label and a callback function.
  - **17.2:** Clicking an action button shall execute the callback immediately and dismiss the toast.
  - **17.3:** A toast shall support configurable display durations, or remain persistent until explicitly dismissed or an action button is clicked.

---

### REQ-18: Interactive Prompt & Picker Modals
- **User Story:** As a script author, I want to easily prompt the user for text, selections, or confirmations without writing custom Obsidian modal classes.
- **EARS Pattern:** Event-Driven
- **Requirement Statement:** When a command calls `context.ui.prompt()`, `context.ui.confirm()`, or `context.ui.suggest()`, OCC shall display an accessible, keyboard-navigable modal dialog and resolve the returned promise with the user's input.
- **Acceptance Criteria:**
  - **18.1:** `context.ui.prompt(options)` shall present an input field with placeholder text and resolve with the entered string, or `null` if cancelled via Escape or Close.
  - **18.2:** `context.ui.suggest(items, options)` shall present a fuzzy-searchable suggestion modal and resolve with the selected item.
  - **18.3:** `context.ui.confirm(options)` shall present a confirmation dialog with configurable Confirm and Cancel button labels, resolving with a boolean.

---

### REQ-19: Progress Indication for Batch Operations
- **User Story:** As a user running a batch automation, I want to see a live progress bar showing completed versus total items so that I know how long the operation will take.
- **EARS Pattern:** State-Driven
- **Requirement Statement:** While a command reports progress updates via `context.ui.createProgress()`, OCC shall render a visual progress bar indicating percentage and status text in an interactive notification or status bar.
- **Acceptance Criteria:**
  - **19.1:** The progress handle shall provide `update({ current, total, message })` and `finish()` methods.
  - **19.2:** The progress UI shall smoothly reflect incremental updates without causing UI re-render thrashing.
  - **19.3:** Calling `finish()` shall dismiss the progress bar and optionally display a final completion toast.

---

## Section 7: Command Center Dashboard & Settings

### REQ-20: Command Registry & Management Dashboard
- **User Story:** As a user, I want a settings tab showing all discovered commands with toggles to enable or disable them so that I can manage my automations in one central place.
- **EARS Pattern:** Ubiquitous
- **Requirement Statement:** OCC shall provide a settings tab displaying an interactive table of all discovered commands, detailing Command Name, ID, Source File, Type (Script vs. Macro), Status (Active / Disabled / Errored), and an enable/disable switch.
- **Acceptance Criteria:**
  - **20.1:** Users shall be able to toggle any command on or off; disabled commands shall be unlinked from the Obsidian Command Palette immediately.
  - **20.2:** The dashboard shall provide a "Reload Commands" button to trigger an immediate rescan of the commands directory.
  - **20.3:** The dashboard shall display error badges for any commands that failed compilation, parsing, or initialization.

---

### REQ-21: Visual Macro Builder
- **User Story:** As a no-code user, I want a visual macro builder in settings where I can assemble and reorder command steps using an interface so that I do not have to hand-craft JSON files.
- **EARS Pattern:** Optional Feature
- **Requirement Statement:** Where the user opens the Visual Macro Builder in settings, OCC shall provide a drag-and-drop or reorderable list interface allowing users to select Obsidian commands, configure step parameters, and save the macro as a declarative definition file.
- **Acceptance Criteria:**
  - **21.1:** The builder shall allow searching native Obsidian commands using an autocomplete dropdown.
  - **21.2:** Users shall be able to reorder steps using up/down controls or drag handles.
  - **21.3:** Saving the visual macro shall write a properly formatted declarative JSON definition to the commands directory.

---

### REQ-22: Execution Logging & Diagnostics
- **User Story:** As an automation developer or power user, I want a live diagnostic log viewer so that I can inspect command execution history, duration, arguments, and error traces.
- **EARS Pattern:** State-Driven
- **Requirement Statement:** While commands execute, OCC shall record invocation telemetry (timestamp, command ID, execution duration, status: success/failure, and error stack trace if applicable) in a ring-buffer log accessible in settings.
- **Acceptance Criteria:**
  - **22.1:** OCC shall maintain an in-memory execution log of the last 100 command runs.
  - **22.2:** The settings view shall provide an "Execution Logs" viewer with search and filtering by command ID and status.
  - **22.3:** A "Copy Diagnostics" button shall allow users to copy the sanitized log to the clipboard for troubleshooting.

---

## Section 8: Developer Experience (DX) & Scaffolding

### REQ-23: Automated Type Definition Generation
- **User Story:** As a TypeScript/JavaScript script crafter, I want an up-to-date `occ.d.ts` declaration file in my vault so that my IDE provides full autocomplete and documentation while writing scripts.
- **EARS Pattern:** Event-Driven
- **Requirement Statement:** When the OCC plugin loads or detects that the type declaration file is missing or outdated, OCC shall generate a comprehensive `occ.d.ts` declaration file in the commands folder.
- **Acceptance Criteria:**
  - **23.1:** `occ.d.ts` shall export full TypeScript typings for `ExecutionContext`, `CommandDefinition`, lifecycle hooks, UI options, and queue handles.
  - **23.2:** The generated file shall reference the active Obsidian API typings where appropriate.
  - **23.3:** Regeneration of the declaration file shall be non-destructive to user scripts in the folder.

---

### REQ-24: Interactive Command Scaffolder Wizard
- **User Story:** As a user, I want a command palette action `Command Center: Create New Command` that prompts me for details and generates starter code so that I do not have to write boilerplate from scratch.
- **EARS Pattern:** Event-Driven
- **Requirement Statement:** When a user executes the `Command Center: Create New Command` action, OCC shall prompt the user for the command name, command type (Script or Macro), and create a populated boilerplate template in the commands folder.
- **Acceptance Criteria:**
  - **24.1:** OCC shall generate a slugified filename and unique ID from the user-entered command name.
  - **24.2:** For scripted commands, OCC shall generate a starter JavaScript file with standard lifecycle hooks and example `ExecutionContext` usage.
  - **24.3:** For macros, OCC shall generate a starter declarative JSON file with placeholder steps.
  - **24.4:** Upon creation, OCC shall immediately open the newly created file in the active Obsidian editor.

---

## Section 9: Security, Guardrails & Reliability

### REQ-25: Execution Timeout Protection
- **User Story:** As a user, I want OCC to detect and abort commands that hang or run in infinite loops so that Obsidian does not lock up permanently.
- **EARS Pattern:** Unwanted Behavior
- **Requirement Statement:** If a synchronous command step or unyielding loop exceeds the configured execution timeout (default: 15 seconds) without yielding, then OCC shall abort the operation, alert the user with a warning toast, and log the timeout event.
- **Acceptance Criteria:**
  - **25.1:** Users shall be able to configure the default maximum execution timeout in settings.
  - **25.2:** Commands flagged as long-running background tasks shall be exempt from the synchronous timeout but subject to voluntary `abortSignal` checks.
  - **25.3:** When a timeout occurs, OCC shall log the stack trace and invoke `onError(new TimeoutError(), context)`.

---

### REQ-26: Safe Execution Sandboxing Mode
- **User Story:** As a security-conscious user, I want an optional Safe Execution Mode that restricts direct access to Node.js `child_process` and external filesystem APIs so that untrusted community scripts cannot compromise my operating system.
- **EARS Pattern:** Optional Feature
- **Requirement Statement:** Where Safe Execution Mode is enabled in settings, OCC shall evaluate scripts in a restricted context that masks direct access to Node `child_process` and restricts filesystem modifications strictly to the active Obsidian vault.
- **Acceptance Criteria:**
  - **26.1:** Safe Execution Mode shall be configurable via a toggle in OCC settings (default: Disabled for maximum flexibility).
  - **26.2:** When Safe Execution Mode is enabled, any attempt by a command script to access `child_process` or require unauthorized Node modules shall throw a `SecurityViolationError`.
  - **26.3:** File operations initiated through `context.vault` shall remain unrestricted within the vault boundaries.

---

## Summary of Requirements Traceability

| ID | Title | EARS Pattern | Milestone Mapping |
| :--- | :--- | :--- | :--- |
| **REQ-01** | Dynamic Command Discovery | Event-Driven | [M1: Core Engine & Dynamic Loader (MVP)](./milestones.md#L29-L38) |
| **REQ-02** | Zero-Downtime Hot-Reloading | Event-Driven | [M2: Lifecycle Engine & Zero-Downtime Hot-Reloading](./milestones.md#L41-L50) |
| **REQ-03** | Dynamic Command Removal | Event-Driven | [M2: Lifecycle Engine & Zero-Downtime Hot-Reloading](./milestones.md#L41-L50) |
| **REQ-04** | Micro-Extension Lifecycle Contract | Ubiquitous | [M2: Lifecycle Engine & Zero-Downtime Hot-Reloading](./milestones.md#L41-L50) |
| **REQ-05** | Pre-Execution Context Validation | State-Driven | [M2: Lifecycle Engine & Zero-Downtime Hot-Reloading](./milestones.md#L41-L50) |
| **REQ-06** | Error Boundary & Fault Isolation | Unwanted Behavior | [M2: Lifecycle Engine & Zero-Downtime Hot-Reloading](./milestones.md#L41-L50) |
| **REQ-07** | Standard Execution Context Injection | Ubiquitous | [M1: Core Engine & Dynamic Loader (MVP)](./milestones.md#L29-L38) |
| **REQ-08** | Sequential Output Piping | State-Driven | [M3: Native Command Bridge & Composable Macro Pipeline](./milestones.md#L52-L60) |
| **REQ-09** | Native Obsidian Command Invocation | Event-Driven | [M3: Native Command Bridge & Composable Macro Pipeline](./milestones.md#L52-L60) |
| **REQ-10** | Declarative Macro Orchestration | Event-Driven | [M3: Native Command Bridge & Composable Macro Pipeline](./milestones.md#L52-L60) |
| **REQ-11** | Macro Step Fallback & Error Handling | Unwanted Behavior | [M3: Native Command Bridge & Composable Macro Pipeline](./milestones.md#L52-L60) |
| **REQ-12** | Non-Blocking Asynchronous Execution | Ubiquitous | [M5: Execution Engine — Async, Queuing & Scheduling](./milestones.md#L73-L81) |
| **REQ-13** | Serial FIFO Task Queuing | State-Driven | [M5: Execution Engine — Async, Queuing & Scheduling](./milestones.md#L73-L81) |
| **REQ-14** | Command Debouncing and Throttling | State-Driven | [M5: Execution Engine — Async, Queuing & Scheduling](./milestones.md#L73-L81) |
| **REQ-15** | Background Task Runner & Status Bar | State-Driven | [M6: Background Worker Engine & Cancellation](./milestones.md#L84-L92) |
| **REQ-16** | Cooperative Task Cancellation | Event-Driven | [M6: Background Worker Engine & Cancellation](./milestones.md#L84-L92) |
| **REQ-17** | Interactive Action Toasts | Ubiquitous | [M4: Interactive Feedback & Human-in-the-Loop UI](./milestones.md#L63-L71) |
| **REQ-18** | Interactive Prompt & Picker Modals | Event-Driven | [M4: Interactive Feedback & Human-in-the-Loop UI](./milestones.md#L63-L71) |
| **REQ-19** | Progress Indication for Batch Operations | State-Driven | [M4: Interactive Feedback & Human-in-the-Loop UI](./milestones.md#L63-L71) |
| **REQ-20** | Command Registry & Dashboard | Ubiquitous | [M7: Command Center Dashboard & Settings UI](./milestones.md#L95-L103) |
| **REQ-21** | Visual Macro Builder | Optional Feature | [M7: Command Center Dashboard & Settings UI](./milestones.md#L95-L103) |
| **REQ-22** | Execution Logging & Diagnostics | State-Driven | [M7: Command Center Dashboard & Settings UI](./milestones.md#L95-L103) |
| **REQ-23** | Automated Type Definition Generation | Event-Driven | [M8: Developer Experience (DX), Scaffolding & Type Safety](./milestones.md#L106-L114) |
| **REQ-24** | Interactive Command Scaffolder Wizard | Event-Driven | [M8: Developer Experience (DX), Scaffolding & Type Safety](./milestones.md#L106-L114) |
| **REQ-25** | Execution Timeout Protection | Unwanted Behavior | [M9: Hardening, Security, Performance & Cross-Platform Polish](./milestones.md#L117-L125) |
| **REQ-26** | Safe Execution Sandboxing Mode | Optional Feature | [M9: Hardening, Security, Performance & Cross-Platform Polish](./milestones.md#L117-L125) |
