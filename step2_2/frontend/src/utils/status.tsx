import { Tag } from "antd";
import type { ReactNode } from "react";
import type { RunStatus, TaskStatus } from "../api/types";

const taskColors: Record<TaskStatus, string> = {
  draft: "default",
  pending: "blue",
  running: "processing",
  succeeded: "success",
  failed: "error",
  cancelled: "warning",
  archived: "default",
};

const runColors: Record<RunStatus, string> = {
  queued: "blue",
  running: "processing",
  paused: "warning",
  completed: "success",
  failed: "error",
  cancelled: "default",
};

export function TaskStatusTag({ status }: { status: TaskStatus }): ReactNode {
  return <Tag color={taskColors[status] ?? "default"}>{status}</Tag>;
}

export function RunStatusTag({ status }: { status: string }): ReactNode {
  return <Tag color={runColors[status as RunStatus] ?? "default"}>{status}</Tag>;
}
