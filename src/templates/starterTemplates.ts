export const DAILY_BRIEFING_TEMPLATE = `/// <reference path="./occ.d.ts" />

export const metadata = {
  id: "daily-briefing",
  name: "Daily Briefing & Task Assembler",
  icon: "calendar",
  description: "Inspects note frontmatter and appends current briefing and date stamps.",
};

export async function canExecute(context) {
  if (!context.file) {
    return "Open a note first to append the daily briefing.";
  }
  return true;
}

export async function execute(context) {
  const file = context.file;
  const content = await context.vault.read(file);
  const today = new Date().toISOString().split("T")[0];

  const briefing = \`\\n\\n## Daily Briefing (\${today})\\n- [ ] Review pending priorities\\n- [ ] Update project statuses\\n\`;

  await context.vault.modify(file, content + briefing);
  context.ui.toast("Appended Daily Briefing!", { type: "success" });
  return { date: today, file: file.path };
}

export function onError(err, context) {
  console.error("[Daily Briefing Error]:", err);
}
`;

export const FORMAT_AND_EXPORT_MACRO_TEMPLATE = JSON.stringify(
  {
    id: "format-and-export",
    name: "Format and Export Note",
    description: "Multi-step macro formatting markdown and executing native export.",
    steps: [
      {
        id: "step-1",
        commandId: "editor:toggle-fold",
        onError: "continue",
      },
      {
        id: "step-2",
        commandId: "app:open-vault",
        onError: "fallback",
        fallbackCommandId: "app:show-settings",
      },
    ],
  },
  null,
  2
);

export const SYNC_NOTES_WORKER_TEMPLATE = `/// <reference path="./occ.d.ts" />

export const metadata = {
  id: "sync-notes-worker",
  name: "Sync Notes Background Worker",
  icon: "refresh-cw",
  description: "Background worker syncing vault items with cooperative progress and cancellation.",
  isBackground: true,
};

export async function execute(context) {
  const total = 5;
  const progress = context.ui.createProgress({
    total,
    title: "Syncing Notes...",
  });

  for (let i = 1; i <= total; i++) {
    // Check cooperative cancellation signal
    if (context.abortSignal.aborted) {
      break;
    }

    // Cooperative yielding to prevent UI stutter
    await context.yield();
    await new Promise((r) => setTimeout(r, 200));

    progress.update({
      current: i,
      message: \`Synced \${i} of \${total} items\`,
    });
  }

  progress.finish("Vault synchronization complete!");
  return { syncedCount: total };
}

export async function cleanup(context) {
  console.log("[Sync Notes Worker] Cleanup executed after cancellation.");
}
`;
