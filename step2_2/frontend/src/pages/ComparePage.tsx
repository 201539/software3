import { App, Button, Form, Select, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import ReactECharts from "echarts-for-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { compareAnalysis, listMetrics, listTasks } from "../api/api";
import { isRequestAborted } from "../api/client";
import type { AnalysisCompareResult, EvaluationTask, MetricDefinition } from "../api/types";
import { useAbortableRequest } from "../hooks/useAbortableRequest";
import { useLoadRequestId } from "../hooks/useLoadRequestId";

export function ComparePage() {
  const { message } = App.useApp();
  const { next: nextLoadId, isCurrent: isLoadCurrent } = useLoadRequestId();
  const nextSignal = useAbortableRequest();
  const [tasks, setTasks] = useState<EvaluationTask[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [result, setResult] = useState<AnalysisCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const boot = useCallback(async () => {
    const rid = nextLoadId();
    const signal = nextSignal();
    try {
      const [t, m] = await Promise.all([
        listTasks({ page: 1, page_size: 200 }, { signal }),
        listMetrics({ page: 1, page_size: 200 }, { signal }),
      ]);
      if (!isLoadCurrent(rid)) return;
      setTasks(t.items as EvaluationTask[]);
      setMetrics(m.items);
    } catch (e) {
      if (isRequestAborted(e)) return;
      if (!isLoadCurrent(rid)) return;
      message.error((e as Error).message);
    }
  }, [message, nextLoadId, isLoadCurrent, nextSignal]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const onFinish = async (v: { task_ids: number[]; metric_keys: string[] }) => {
    const signal = nextSignal();
    setLoading(true);
    try {
      const res = await compareAnalysis(
        {
          task_ids: v.task_ids,
          metric_keys: v.metric_keys,
        },
        { signal },
      );
      setResult(res);
      message.success("分析完成");
    } catch (e) {
      if (!isRequestAborted(e)) message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const detail = result?.result_detail as
    | {
        task_run_summary?: { task_id: number; run_count: number }[];
        average_score?: number | null;
        run_count?: number;
        sample_count?: number;
      }
    | undefined;

  const chartOption = useMemo(() => {
    if (!detail?.task_run_summary || detail.task_run_summary.length === 0) return null;
    return {
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: detail.task_run_summary.map((x) => `任务 #${x.task_id}`),
      },
      yAxis: { type: "value", name: "运行次数" },
      series: [
        {
          name: "运行次数",
          type: "bar",
          data: detail.task_run_summary.map((x) => x.run_count),
          itemStyle: { color: "#2c5282" },
        },
      ],
    };
  }, [detail?.task_run_summary]);

  const summaryColumns: ColumnsType<{ task_id: number; run_count: number }> = useMemo(
    () => [
      { title: "任务 ID", dataIndex: "task_id" },
      { title: "关联运行数", dataIndex: "run_count" },
    ],
    [],
  );

  return (
    <div>
      <Typography.Title level={4}>多任务对比分析</Typography.Title>
      <Typography.Paragraph type="secondary">
        基于后端已持久化的运行与样本结果做汇总（与任务需求文档「多任务对比」一致）。
      </Typography.Paragraph>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 560, marginBottom: 24 }}
        onFinish={(v) => void onFinish(v)}
        initialValues={{ task_ids: [], metric_keys: [] }}
      >
        <Form.Item
          name="task_ids"
          label="选择评测任务"
          rules={[{ required: true, message: "至少选择一个任务" }]}
        >
          <Select
            mode="multiple"
            placeholder="选择任务"
            optionFilterProp="label"
            options={tasks.map((t) => ({
              label: `${t.name} (#${t.id})`,
              value: t.id,
            }))}
          />
        </Form.Item>
        <Form.Item name="metric_keys" label="关注指标键（用于分析上下文）">
          <Select
            mode="tags"
            placeholder="可选：从已有指标中选择或手动输入 key"
            options={metrics.map((m) => ({
              label: `${m.name} (${m.metric_code})`,
              value: m.metric_code,
            }))}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            生成对比
          </Button>
        </Form.Item>
      </Form>

      {result && (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Typography.Title level={5}>{result.title}</Typography.Title>
          <Typography.Text>
            {result.result_summary} · 分析编码 {result.analysis_code}
          </Typography.Text>
          <Space size="large" wrap>
            <Typography.Text>选中任务: {result.task_ids.join(", ")}</Typography.Text>
            <Typography.Text>指标键: {result.metric_keys.join(", ") || "—"}</Typography.Text>
            <Typography.Text>平均样本分: {detail?.average_score ?? "—"}</Typography.Text>
            <Typography.Text>
              运行总数: {detail?.run_count ?? "—"} / 样本条数: {detail?.sample_count ?? "—"}
            </Typography.Text>
          </Space>
          {chartOption && <ReactECharts style={{ height: 360 }} option={chartOption} />}
          {detail?.task_run_summary && (
            <Table
              title={() => "各任务运行次数"}
              rowKey="task_id"
              columns={summaryColumns}
              dataSource={detail.task_run_summary}
              pagination={false}
              size="small"
            />
          )}
        </Space>
      )}
    </div>
  );
}
