import { Skeleton } from "antd";

/** 首次拉取列表数据时的占位，避免空白闪烁 */
export function PageTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Skeleton
      active
      title={{ width: "32%" }}
      paragraph={{ rows }}
      style={{ padding: "8px 0" }}
    />
  );
}
