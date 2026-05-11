import { Tag } from "antd";
import type { ReactNode } from "react";
import type { RunStatus, TaskStatus } from "../api/types";

const taskColors: Record<TaskStatus, string> = {
  draft: "default",
  pending: "geekblue",
  running: "processing",
  succeeded: "success",
  failed: "error",
  cancelled: "warning",
  archived: "default",
};

const taskLabels: Record<TaskStatus, string> = {
  draft: "草稿",
  pending: "待运行",
  running: "运行中",
  succeeded: "成功",
  failed: "失败",
  cancelled: "已取消",
  archived: "已归档",
};

const runColors: Record<RunStatus, string> = {
  queued: "geekblue",
  running: "processing",
  paused: "warning",
  completed: "success",
  failed: "error",
  cancelled: "default",
};

const runLabels: Record<RunStatus, string> = {
  queued: "排队",
  running: "运行中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

/** 任务状态下拉等控件用：中文标签 + 英文枚举值 */
export const TASK_STATUS_OPTIONS: { label: string; value: TaskStatus }[] = (
  [
    "draft",
    "pending",
    "running",
    "succeeded",
    "failed",
    "cancelled",
    "archived",
  ] as TaskStatus[]
).map((value) => ({ label: taskLabels[value], value }));

export function TaskStatusTag({ status }: { status: TaskStatus }): ReactNode {
  return (
    <Tag color={taskColors[status] ?? "default"}>{taskLabels[status] ?? status}</Tag>
  );
}

export function RunStatusTag({ status }: { status: string }): ReactNode {
  const s = status as RunStatus;
  return <Tag color={runColors[s] ?? "default"}>{runLabels[s] ?? status}</Tag>;
}
