# Obsidian Command Center (OCC)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-coreyx%2Fobsidian--command--center-lightgrey.svg)](https://github.com/coreyx/obsidian-command-center)

**Obsidian Command Center (OCC)** is an extensible automation runtime and macro orchestration engine built for [Obsidian](https://obsidian.md). It bridges the gap between simple hotkey macros and heavyweight, standalone community plugins.

In OCC, **every command is a lightweight micro-extension** with its own lifecycle hooks (`init`, `canExecute`, `execute`, `cleanup`, `onError`), input/output piping, concurrency queues, and interactive UI feedback.

---

## Key Features

- **Open for Extension, Closed for Modification:** Add new automations without editing the core plugin or restarting Obsidian.
- **Zero-Downtime Hot-Reloading:** Save a `.js`, `.mjs`, or `.json` file in your commands folder and it is instantly validated, compiled, and registered with Obsidian's Command Palette.
- **Composable Macro Pipelines:** Chain native Obsidian commands and custom scripts, passing outputs from one step to the next (`context.$prevOutput`).
- **Concurrency & Concurrency Queues:** Prevent race conditions on vault notes with named FIFO sequential queues.
- **Interactive UI Kit:** Enhanced notices with action buttons (`[Undo]`, `[Retry]`), modal prompts, and batch progress bars.
- **Background Workers:** Detached asynchronous jobs with live status-bar indicators and cooperative `AbortSignal` cancellation.

---

## Installation

### Via BRAT (Recommended for Beta Testing)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tester) makes it easy to install and test Obsidian Command Center before it is released to the official Obsidian Community Plugins directory:

1. Install and enable the **BRAT** plugin from Obsidian's Community Plugins browser (`Settings` > `Community Plugins` > `Browse`).
2. Navigate to `Settings` > `BRAT`.
3. Under the **Beta Plugin List** section, click **Add Beta plugin**.
4. Enter the GitHub repository path:
   ```text
   coreyx/obsidian-command-center
   ```
5. Click **Add Plugin**. BRAT will download the latest release files (`manifest.json`, `main.js`, and `styles.css`).
6. Navigate to `Settings` > `Community Plugins` and enable **Command Center**.

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](https://github.com/coreyx/obsidian-command-center/releases).
2. Create a folder in your Obsidian vault:
   ```text
   <Vault>/.obsidian/plugins/obsidian-command-center/
   ```
3. Copy the downloaded files into that folder.
4. Reload Obsidian (`Ctrl+R` or `Cmd+R`) and enable **Command Center** in `Settings` > `Community Plugins`.

---

## Developer Guide & Examples

- 📖 **[Plugin Developer Guide (`./docs/DEVELOPER_GUIDE.md`)](./docs/DEVELOPER_GUIDE.md)** — Complete tutorial and API reference for building OCC micro-extensions, lifecycle hooks, interactive UI components, queues, and macros.
- 💡 **[Example Plugins & Macros (`./examples/`)](./examples/)** — Ready-to-use reference implementations, including the **Vault Librarian** directory bundle and the **Daily Review** macro pipeline.

---

## Specification & Documentation

Detailed project specifications, architecture, requirements, and roadmaps are organized in [`./spec/obsidian-command-center/`](./spec/obsidian-command-center/):

- [Product Definition (`product.md`)](./spec/obsidian-command-center/product.md) — Product vision, personas, and problem space.
- [Development Milestones (`milestones.md`)](./spec/obsidian-command-center/milestones.md) — 9 progressive milestones from MVP to release.
- [EARS Requirements (`requirements.md`)](./spec/obsidian-command-center/requirements.md) — Rigorous functional and operational requirements (REQ-01 to REQ-26).
- [Technology Stack (`tech.md`)](./spec/obsidian-command-center/tech.md) — Architecture decisions, runtimes, and dependencies.
- [System Architecture & Design (`design.md`)](./spec/obsidian-command-center/design.md) — Subsystem blueprints, lifecycle state machine, and Mermaid diagrams.
- [Implementation Tasks (`tasks.md`)](./spec/obsidian-command-center/tasks.md) — Checklist of 36 implementation tasks with step-by-step guides.

---

## Quick Start (Development)

```bash
# Clone the repository
git clone https://github.com/coreyx/obsidian-command-center.git
cd obsidian-command-center

# Install dependencies
pnpm install

# Run unit and integration tests
pnpm test

# Build production bundle
pnpm run build
```

---

## Author & License

- **Author:** Corey Struzan ([@coreyx](https://github.com/coreyx))
- **Repository:** [`coreyx/obsidian-command-center`](https://github.com/coreyx/obsidian-command-center)
- **License:** [MIT](./LICENSE)
