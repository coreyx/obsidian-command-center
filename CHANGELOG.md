# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Milestone 3: Native Command Bridge & Composable Macro Pipeline**:
  - `OCCCommandBridgeImpl`: Programmatic bridge executing native Obsidian commands by ID with descriptive `CommandNotFoundError`.
  - `MacroOrchestrator`: Parser and executor for declarative JSON macro pipelines (`*.macro.json`).
  - Contextual Output Piping: Automatic data forwarding where step $N$ return values feed into step $N+1$ via `context.input` and `context.$prevOutput`.
  - Step Execution Telemetry: Historical step execution records (`context.steps`) accessible to downstream commands.
  - Step-level Error Policy Engine: Full support for `onError: "halt"`, `onError: "continue"`, and `onError: "fallback"` with `fallbackCommandId`.
  - 8 new unit tests covering command bridge lookup, sequential step piping, and error recovery policies (32 total passing tests).

## [0.1.0] - 2026-10-01

### Added
- **Complete Technical Specification Suite (`./spec/obsidian-command-center/`)**:
  - `product.md`: Product vision, architecture principles, and user personas.
  - `milestones.md`: 9 progressive milestones from MVP to public release.
  - `requirements.md`: 26 EARS-format requirements with user stories and numbered acceptance criteria.
  - `tech.md`: Technology stack specification (TypeScript, esbuild, Vitest, Svelte 5).
  - `design.md`: Subsystem architecture, state machines, and Mermaid sequence/class diagrams.
  - `tasks.md`: 36 implementation tasks with checklist traceability.
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
- **Testing & Tooling**:
  - Complete mock harness for Obsidian platform testing in Vitest (`tests/mocks/obsidian.ts`).
  - 24 unit and integration tests across 7 test suites.
  - Ultra-lean production bundle (`main.js` at ~27 KB).
  - Project documentation (`README.md`, `LICENSE` under MIT, `manifest.json`, `package.json`).
