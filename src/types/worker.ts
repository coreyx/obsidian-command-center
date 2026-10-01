export type BackgroundTaskState =
  | "PENDING"
  | "RUNNING"
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED";

export interface BackgroundTaskRecord {
  taskId: string;
  commandId: string;
  commandName: string;
  state: BackgroundTaskState;
  startTime: number;
  endTime?: number;
  progressMessage?: string;
  error?: Error;
  abortController: AbortController;
}
