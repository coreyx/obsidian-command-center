# Obsidian Command Center (OCC) — Technology Stack Specification

> **Document Version:** 1.0.0  
> **Status:** Approved Technical Baseline  
> **Target Audience:** Engineering, DevOps, Community Contributors  
> **Reference Documents:** [product.md](./product.md), [milestones.md](./milestones.md), [requirements.md](./requirements.md)  

---

## 1. Technical Philosophy & Constraints

Obsidian Command Center is designed around four technical tenets:
1. **Zero Runtime Overhead:** Execution dispatch overhead must remain below 5ms. Memory consumption per command must be negligible (< 50KB heap).
2. **Minimal External Dependencies:** Keep runtime dependencies as close to zero as possible to ensure fast plugin startup (< 50ms) and eliminate supply-chain vulnerabilities.
3. **Cross-Platform Parity:** Core automation features must work consistently across Desktop (Electron / Node.js) and Mobile (WebKit / Chromium on iOS and Android).
4. **Standard Web Primitives:** Leverage standard JavaScript/TypeScript APIs (`Promise`, `AbortController`, `EventTarget`, `CustomEvent`) over proprietary abstractions.

---

## 2. Core Technology Stack

```
+--------------------------------------------------------------------------+
|                        Technology Stack Overview                         |
+--------------------------------------------------------------------------+
|  Languages          | TypeScript 5.4+ (Strict Mode), ES2022+             |
|  Host Runtime       | Obsidian API (Desktop Electron + Node.js / Mobile) |
|  Build Toolchain    | esbuild 0.20+ (Sub-second incremental builds)      |
|  UI Layer           | Obsidian DOM Primitives (createEl, Setting) +      |
|                     | Svelte 5 (for Dashboard & Visual Macro Builder)    |
|  Runtime Loader     | Native ES Dynamic import() with Cache-Buster URI   |
|  Transpiler (Opt.)  | Sucrase (Ultra-fast, in-memory TS-to-JS transform)  |
|  Concurrency/Queue  | Native Promise Microtasks + Custom FIFO Scheduler  |
|  Testing & QA       | Vitest, TypeScript Compiler (tsc), ESLint, Prettier|
|  Distribution       | Obsidian Community Plugin Manifest Format          |
+--------------------------------------------------------------------------+
```

---

## 3. Detailed Component Breakdown

### 3.1 Language & Compiler Configuration
- **Primary Language:** TypeScript 5.4+
  - Compilation Target: `ES2022` (natively supported by Obsidian's modern Chromium and Safari runtimes).
  - Module Resolution: `Bundler` / `NodeNext`.
  - Compiler Flags:
    - `"strict": true`
    - `"noImplicitAny": true`
    - `"exactOptionalPropertyTypes": true`
    - `"noUncheckedIndexedAccess": true`
    - `"isolatedModules": true`
- **Typings:**
  - `obsidian` npm package for official API declarations.
  - Custom `occ-api.d.ts` generator for exposing OCC context types to user scripts.

### 3.2 Build System & Packaging
- **Bundler:** `esbuild`
  - Ultra-fast incremental bundling (< 100ms rebuild time during development).
  - Single-bundle output: `main.js`.
  - Output format: CommonJS (`cjs`) as required by Obsidian's plugin loader.
  - CSS bundling: Inline or single `styles.css` artifact extracted via esbuild.
  - Source maps: Inline during development (`--sourcemap=inline`), omitted in production release.
- **Package Manager:** `pnpm` (v9+)
  - Fast, deterministic, disk-efficient dependency resolution.

### 3.3 Dynamic Script Evaluation & Loader
- **Desktop (Node.js / Electron):**
  - Evaluates user scripts from disk using dynamic `import()` with cache-busting timestamp queries:
    ```typescript
    const fileUrl = `file://${normalizedAbsolutePath}?t=${Date.now()}`;
    const module = await import(fileUrl);
    ```
  - Enables clean garbage collection and module re-evaluation on file modification.
- **Mobile (iOS / Android Web Sandbox):**
  - Mobile environments disallow arbitrary `file://` dynamic imports from local paths.
  - Dynamic loading on mobile reads script text via `app.vault.adapter.read()` and evaluates via `new Function()` or an injected `<script type="module">` blob URL.
- **On-the-Fly TypeScript Transpilation (Optional Extension):**
  - **Sucrase:** Lightweight (~200KB bundle footprint) for instant in-memory TypeScript and modern syntax stripping without full type-checking overhead (avoiding the massive 8MB+ footprint of `@babel/standalone`).

### 3.4 User Interface Architecture
- **Lightweight Core UI (Interactive Toasts & Modals):**
  - Built directly using Obsidian DOM utilities:
    - `new Notice(fragment, duration)`
    - `new Modal(app)`
    - `new SuggestModal<T>(app)`
    - Obsidian DOM helpers: `createEl()`, `createDiv()`, `createSpan()`.
  - Zero framework overhead for high-frequency notifications and prompts.
- **Complex UI (Settings Dashboard & Visual Macro Builder):**
  - **Svelte 5:**
    - High-performance, compile-to-vanilla reactivity.
    - Zero runtime framework overhead (no virtual DOM).
    - Perfect for complex reactive drag-and-drop step ordering and live execution logs.
    - Mounts cleanly into Obsidian's `PluginSettingTab` container element.

### 3.5 Concurrency, Queuing & Scheduling
- **Asynchronous Execution:** Standard JavaScript `async` / `await` and `Promise` chaining.
- **Sequential FIFO Task Queue:** Custom linked-list queue structure guaranteeing sequential ordering without memory leaks or race conditions.
- **Cancellation Tokens:** Native web `AbortController` and `AbortSignal`.
- **Throttling & Debouncing:** Functional wrappers utilizing standard timers (`setTimeout`, `clearTimeout`).

### 3.6 Testing & Quality Engineering
- **Test Runner:** `Vitest`
  - Ultra-fast test execution leveraging esbuild.
  - Compatible with standard Jest syntax.
- **Obsidian Mock Harness:**
  - In-memory mock suite simulating Obsidian `App`, `Vault`, `Workspace`, `Editor`, and `CommandRegistry` for headless CI testing.
- **Static Analysis & Linting:**
  - `ESLint` with `@typescript-eslint/recommended`.
  - `Prettier` for deterministic code styling.

---

## 4. Dependencies Manifest

### Runtime Dependencies (Kept to absolute minimum)

| Package | Purpose | Bundle Size Impact |
| :--- | :--- | :--- |
| `svelte` | Reactive UI for Settings Dashboard & Visual Macro Builder | ~15 KB (compiled) |
| `sucrase` *(optional)* | In-memory TypeScript transpilation for raw `.ts` scripts | ~200 KB (deferred/tree-shaken) |

### Development & Tooling Dependencies

| Package | Purpose |
| :--- | :--- |
| `typescript` | TypeScript compiler and language server |
| `obsidian` | Official Obsidian API type definitions |
| `esbuild` | Fast incremental bundler |
| `vitest` | Unit and integration test runner |
| `eslint` / `@typescript-eslint/*` | Code quality and linting |
| `prettier` | Code formatting |
| `@types/node` | TypeScript definitions for Node.js APIs (Desktop build) |

---

## 5. Security & Isolation Architecture

1. **Local Script Execution:**
   - Under standard configuration, scripts execute within Obsidian's local JavaScript context, providing full capability to interact with notes and local files.
2. **Safe Mode Sandbox (Opt-in):**
   - Implemented via a scoped proxy context that intercepts references to sensitive global objects:
     - `require("child_process")` -> Blocked with `SecurityViolationError`.
     - Direct `process.exit()` -> Blocked.
     - Out-of-vault filesystem operations -> Sanitized through `app.vault.adapter`.
3. **Watchdog Timer:**
   - A non-blocking execution watchdog intercepts operations running longer than the user-configured execution threshold (default: 15s).
