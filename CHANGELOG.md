# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-10-01

### Added
- **Milestone 4: Interactive Feedback & Human-in-the-Loop UI**:
  - `InteractiveToast`: Interactive notice component wrapping Obsidian's `Notice` with action buttons (`[Undo]`, `[Retry]`, etc.), variant styling (`primary`, `warning`), dynamic message updates, and error-safe action handlers.
  - `PromptModal`: Modal dialog extending `Modal` for single-line and multiline user text input with keyboard submission (`Enter`) and cancellation (`Escape`).
  - `ConfirmModal`: Confirmation modal dialog providing configurable confirm and cancel buttons and labels, returning a boolean promise.
  - `SuggestPickerModal`: Fuzzy search and selection modal extending `SuggestModal<T>` for choosing from arbitrary arrays of objects or strings with custom `renderItem` support.
  - `OCCProgressReporter`: Throttled (60fps) batch progress bar notice reporting real-time step progress (`update({ current, total, message })`) and automatic completion notice on `finish()`.
  - `OCCUIHelper` & `UIHelperImpl`: Clean, unified UI helper surface exposed directly on `context.ui`.
  - Full Obsidian-native dark/light theme CSS styling for action toasts, modals, and progress bars in `styles.css`.
- **Milestone 5: Execution Engine — Async, Queuing & Scheduling**:
  - `context.yield()`: Cooperative yielding mechanism to relinquish the main JavaScript event loop during intensive operations, ensuring fluid typing and editor responsiveness.
  - `FIFOQueue` & `QueueManager`: Named serial FIFO queuing engine ensuring strict sequential, non-overlapping execution for note/vault mutating commands.
  - Support for `metadata.queueName` on commands for automatic serial dispatch, plus `context.queue.push(queueName, task, options)` for programmatic task queuing.
  - Queue error handling policy with `haltOnError: true` to pause or abort subsequent pending tasks when a critical error occurs.
  - `DebounceThrottleManager`: High-frequency execution scheduler supporting `metadata.debounce` and `metadata.throttle`.
  - `context.cancelDebounce()`: Cancellation method for aborting scheduled debounced command invocations.
- **Milestone 6: Background Worker Engine & Cancellation**:
  - `BackgroundWorkerManager`: Background task runner for long-running, detached operations declared via `metadata.isBackground: true`.
  - In-memory lifecycle tracking of background tasks with full state transitions: `PENDING`, `RUNNING`, `CANCELLED`, `COMPLETED`, and `FAILED`.
  - `StatusBarMonitor`: Dynamic Obsidian status bar item indicating active task counts with click-to-inspect trigger.
  - `TaskInspectorModal`: Real-time inspection modal displaying task durations, status badges, and cancellation controls.
  - Cooperative task cancellation via standard `AbortSignal` (`context.abortSignal`) and automated invocation of command `cleanup(context)` hooks.
- **Milestone 7: Command Center Dashboard & Settings UI**:
  - `OCCSettingTab`: Multi-tabbed dashboard interface with tab navigation across `Commands`, `Macro Builder`, `Execution Logs`, and `General Settings`.
  - `CommandTableView`: Command registry dashboard displaying Name, ID, Source File, Type badge (`Script` vs `Macro`), Status badge, and instant toggle switches dynamically binding and unbinding commands in Obsidian.
  - `MacroBuilderView`: No-code visual macro pipeline builder supporting step reordering (`↑`/`↓`), step removal, command assignment, configurable error policies (`halt`, `continue`, `fallback`), and direct compilation to `*.macro.json`.
  - `ExecutionLogger`: 100-entry in-memory ring buffer recording real-time command execution telemetry, duration, status, and error traces.
  - `LogViewerView`: Execution log viewer with real-time live updates, search query filtering by command ID/name, status filter dropdown (`All`, `Success`, `Error`), and one-click "Copy Diagnostics" JSON clipboard export.
- **Milestone 8: Developer Experience (DX), Scaffolding & Type Safety**:
  - `TypeDefinitionGenerator`: Automated TypeScript declaration file generator producing a comprehensive `occ.d.ts` in the commands folder for complete IDE autocomplete and inline documentation.
  - `CommandScaffolder`: Interactive command scaffolding engine generating slugified IDs, filenames, and boilerplate code for both scripts (`*.js`) and declarative macros (`*.macro.json`).
  - `Command Center: Create New Command` command palette wizard prompting for name and type, generating the boilerplate, and automatically opening the file in Obsidian.
  - Production-ready starter template library bundled with three templates: `daily-briefing.js`, `format-and-export.macro.json`, and `sync-notes-worker.js`.
  - Settings buttons to regenerate `occ.d.ts` and install starter templates on demand.
- **Milestone 9: Hardening, Security, Performance & Release CI**:
  - `ExecutionWatchdog`: Execution timeout guard racing command execution against a configurable timeout (default 15,000ms), raising `ExecutionTimeoutError`, alerting users with warning toasts, and exempting background tasks (`REQ-25`).
  - `SecuritySandbox`: Opt-in Safe Execution Mode proxy masking Node.js `child_process`, `cluster`, `worker_threads`, and direct `fs` modules with `SecurityViolationError` while preserving complete vault access via `context.vault` (`REQ-26`).
  - Dashboard configuration controls for Safe Execution Mode and execution timeout in milliseconds.
  - Cross-platform mobile polish: Hooked into mobile app lifecycle events (`pause` and `resume`) to automatically pause and resume serial queues, and added WCAG/mobile minimum 44x44px touch targets in `styles.css`.
  - Performance benchmarks verifying command dispatch overhead is strictly below 5ms (< 0.1ms measured) and 100 consecutive hot-reload cycles complete with zero state corruption or memory leaks.
  - Automated GitHub Actions CI workflow (`.github/workflows/ci.yml`) running `typecheck`, Vitest test suite, and production bundle build on push and pull requests to `main`.
- **Testing & Quality Assurance**:
  - 93 unit and integration tests across 15 test suites with 100% pass rate.
  - Full TypeScript 5.4 typecheck coverage and lean production bundling (~43 KB).

## [0.1.0] - 2026-10-01

### Added
- **Milestone 1: Core Engine & Dynamic Loader (MVP)**:
  - Scaffolding with TypeScript 5.4, esbuild bundler, and Vitest test runner.
  - `CommandScanner`: Recursive folder scanner detecting `.js`, `.mjs`, `.json`, and directory bundles.
  - `ModuleLoader`: Dynamic module evaluator with cache-busting on Desktop and sandboxed evaluation on Mobile.
  - `CommandRegistry`: In-memory command registry binding proxy commands directly to Obsidian's command palette.
  - `ExecutionContextImpl` & `VaultHelperImpl`: Context injection providing `app`, active `file`, active `editor`, and atomic vault operations.
- **Milestone 2: Lifecycle Engine & Zero-Downtime Hot-Reloading**:
  - `FileWatcher`: Directory watcher monitoring commands folder with 200ms debounce buffer.
  - `LifecycleManager`: State machine managing `DISCOVERED`, `INITIALIZING`, `READY`, `CLEANUP`, and `ERRORED` states.
  - Hotkey preservation: Preserves user-assigned hotkeys across zero-downtime hot-reload cycles.
  - `ExecutionEngine`: Pre-execution validation (`canExecute`), execution dispatch, and isolated error boundaries (`onError`).
  - `OCCSettingTab`: Obsidian settings tab for configuring commands directory and manual reload triggers.
- **Milestone 3: Native Command Bridge & Composable Macro Pipeline**:
  - `OCCCommandBridgeImpl`: Programmatic bridge executing native Obsidian commands by ID with descriptive `CommandNotFoundError`.
  - `MacroOrchestrator`: Parser and executor for declarative JSON macro pipelines (`*.macro.json`).
  - Contextual Output Piping: Automatic data forwarding where step $N$ return values feed into step $N+1$ via `context.input` and `context.$prevOutput`.
  - Step Execution Telemetry: Historical step execution records (`context.steps`) accessible to downstream commands.
  - Step-level Error Policy Engine: Full support for `onError: "halt"`, `onError: "continue"`, and `onError: "fallback"` with `fallbackCommandId`.
- **Technical Specification Suite (`./spec/obsidian-command-center/`)**:
  - Complete specifications: `product.md`, `milestones.md`, `requirements.md` (26 EARS requirements), `tech.md`, `design.md`, and `tasks.md` (36 tasks).
