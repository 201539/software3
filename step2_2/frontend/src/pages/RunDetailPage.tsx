import {
  ArrowLeftOutlined,
  DownloadOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Descriptions,
  List,
  Progress,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import ReactECharts from "echarts-for-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  cancelRun,
  exportRunReport,
  getRun,
  getRunSummary,
  getTask,
  listReports,
  listRunMetrics,
  listSampleResults,
  listToolCalls,
  listTraces,
  pauseRun,
  resumeRun,
  retryRun,
} from "../api/api";
import type {
  EvaluationRun,
  EvaluationTask,
  MetricResult,
  Report,
  SampleResult,
  ToolCallLog,
  TraceRecord,
  WebSocketEvent,
} from "../api/types";
import { wsUrlForRun } from "../api/client";
import { RunStatusTag } from "../utils/status";

export function RunDetailPage() {
  const { runId } = useParams();
  const id = Number(runId);
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [run, setRun] = useState<EvaluationRun | null>(null);
  const [task, setTask] = useState<EvaluationTask | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleResult[]>([]);
  const [metrics, setMetrics] = useState<MetricResult[]>([]);
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallLog[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsLog, setWsLog] = useState<WebSocketEvent[]>([]);

  const load = useCallback(async () => {
    if (Number.isNaN(id)) return;
    setLoading(true);
    try {
      const r = await getRun(id);
      setRun(r);
      const t = await getTask(r.task_id);
      setTask(t);
      const [sm, samp, met, tr, tc, rep] = await Promise.all([
        getRunSummary(id).catch(() => null),
        listSampleResults(id).catch(() => []),
        listRunMetrics(id).catch(() => []),
        listTraces(id, { page: 1, page_size: 100 }).catch(() => ({ items: [] })),
        listToolCalls(id, { page: 1, page_size: 100 }).catch(() => ({ items: [] })),
        listReports(id).catch(() => []),
      ]);
      setSummary(sm?.summary ?? r.summary);
      setSamples(samp);
      setMetrics(met);
      setTraces(tr.items as TraceRecord[]);
      setToolCalls(tc.items as ToolCallLog[]);
      setReports(rep);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (Number.isNaN(id)) return;
    const url = wsUrlForRun(id);
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as WebSocketEvent;
        setWsLog((prev) => [...prev.slice(-50), data]);
        setRun((prev) => {
          if (!prev || prev.id !== id) return prev;
          const next = { ...prev };
          if (data.progress != null) next.progress = data.progress;
          if (data.status) next.status = data.status as EvaluationRun["status"];
          return next;
        });
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => {
      /* dev 下后端未启动时静默 */
    };
    return () => {
      ws.close();
    };
  }, [id]);

  const runAction = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
      void load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const sampleColumns: ColumnsType<SampleResult> = [
    { title: "样本 ID", dataIndex: "sample_id", width: 90 },
    { title: "状态", dataIndex: "status", width: 100 },
    {
      title: "输入快照",
      dataIndex: "input_snapshot",
      render: (v: Record<string, unknown>) => (
        <Typography.Paragraph copyable ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
          {JSON.stringify(v)}
        </Typography.Paragraph>
      ),
    },
    {
      title: "输出快照",
      dataIndex: "output_snapshot",
      render: (v: Record<string, unknown> | null) =>
        v ? (
          <Typography.Paragraph copyable ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
            {JSON.stringify(v)}
          </Typography.Paragraph>
        ) : (
          "—"
        ),
    },
    {
      title: "评分摘要",
      dataIndex: "score_summary",
      width: 120,
      render: (v: Record<string, unknown> | null) => (v ? JSON.stringify(v) : "—"),
    },
  ];

  const metricColumns: ColumnsType<MetricResult> = [
    { title: "指标", dataIndex: "metric_name", render: (_, r) => r.metric_name || r.metric_code },
    { title: "类型", dataIndex: "metric_type", width: 100 },
    { title: "数值", dataIndex: "metric_value", width: 100 },
    { title: "文本", dataIndex: "metric_text", ellipsis: true },
  ];

  const traceColumns: ColumnsType<TraceRecord> = [
    { title: "步序", dataIndex: "step_index", width: 70 },
    { title: "阶段", dataIndex: "phase", width: 90 },
    { title: "决策", dataIndex: "decision", ellipsis: true },
    { title: "观察", dataIndex: "observation", ellipsis: true },
    {
      title: "时间",
      dataIndex: "created_at",
      width: 170,
      render: (t: string) => dayjs(t).format("YYYY-MM-DD HH:mm:ss"),
    },
  ];

  const toolColumns: ColumnsType<ToolCallLog> = [
    { title: "工具", dataIndex: "tool_name", width: 140 },
    {
      title: "成功",
      dataIndex: "success",
      width: 80,
      render: (v: boolean) => (v ? <Tag color="success">是</Tag> : <Tag color="error">否</Tag>),
    },
    { title: "耗时 ms", dataIndex: "duration_ms", width: 100 },
    {
      title: "输入",
      dataIndex: "input_payload",
      ellipsis: true,
      render: (v: Record<string, unknown>) => JSON.stringify(v),
    },
  ];

  const metricChart =
    metrics.length > 0
      ? {
          tooltip: { trigger: "axis" },
          xAxis: {
            type: "category",
            data: metrics.map((m) => m.metric_name || m.metric_code || `metric-${m.metric_id}`),
            axisLabel: { rotate: 30 },
          },
          yAxis: { type: "value" },
          series: [
            {
              type: "bar",
              data: metrics.map((m) => m.metric_value ?? 0),
              itemStyle: { color: "#1677ff" },
            },
          ],
        }
      : null;

  if (!run && !loading) {
    return <Typography.Text type="danger">运行记录不存在</Typography.Text>;
  }

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(run ? `/tasks/${run.task_id}` : "/tasks")}
        >
          返回任务
        </Button>
        <Button
          icon={<PauseCircleOutlined />}
          onClick={() => void runAction(() => pauseRun(id), "已暂停")}
          disabled={!run || !["queued", "running"].includes(run.status)}
        >
          暂停
        </Button>
        <Button
          icon={<PlayCircleOutlined />}
          onClick={() => void runAction(() => resumeRun(id), "已恢复")}
          disabled={!run || run.status !== "paused"}
        >
          恢复
        </Button>
        <Button
          danger
          icon={<StopOutlined />}
          onClick={() => void runAction(() => cancelRun(id), "已取消")}
          disabled={!run}
        >
          取消
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void runAction(() => retryRun(id), "已重试排队")}
          disabled={!run || !["failed", "cancelled", "completed"].includes(run.status)}
        >
          重试
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={() =>
            void runAction(async () => {
              await exportRunReport(id, "pdf");
            }, "已生成导出记录")
          }
        >
          导出报告
        </Button>
      </Space>

      {run && (
        <Card size="small" loading={loading} style={{ marginBottom: 16 }}>
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="运行 ID">{run.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <RunStatusTag status={run.status} />
            </Descriptions.Item>
            <Descriptions.Item label="编码">{run.run_code}</Descriptions.Item>
            <Descriptions.Item label="关联任务">
              {task ? (
                <Link to={`/tasks/${task.id}`}>
                  {task.name} (#{task.id})
                </Link>
              ) : (
                `#${run.task_id}`
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Trace">{run.trace_id || "—"}</Descriptions.Item>
            <Descriptions.Item label="重试次数">{run.retry_count}</Descriptions.Item>
            <Descriptions.Item label="摘要" span={2}>
              {summary || run.summary || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="错误" span={2}>
              {run.error_message || "—"}
            </Descriptions.Item>
          </Descriptions>
          <div style={{ marginTop: 16 }}>
            <Typography.Text type="secondary">执行进度</Typography.Text>
            <Progress
              percent={Math.min(100, Math.round(run.progress))}
              status={run.status === "failed" ? "exception" : "active"}
            />
          </div>
        </Card>
      )}

      <Card size="small" title="WebSocket 实时事件" style={{ marginBottom: 16 }}>
        <List
          size="small"
          dataSource={wsLog}
          locale={{ emptyText: "等待推送…（需后端与代理支持 WS）" }}
          renderItem={(item) => (
            <List.Item>
              <Space direction="vertical" size={0} style={{ width: "100%" }}>
                <Space>
                  <Tag>{item.event}</Tag>
                  <Typography.Text type="secondary">{item.updated_at}</Typography.Text>
                </Space>
                <Typography.Text>
                  {item.message}（progress: {item.progress ?? "—"}）
                </Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Tabs
        items={[
          {
            key: "samples",
            label: "样本结果",
            children: <Table rowKey="id" columns={sampleColumns} dataSource={samples} pagination={false} />,
          },
          {
            key: "metrics",
            label: "指标",
            children: (
              <Space direction="vertical" style={{ width: "100%" }} size="large">
                {metricChart ? <ReactECharts style={{ height: 320 }} option={metricChart} /> : null}
                <Table rowKey="id" columns={metricColumns} dataSource={metrics} pagination={false} />
              </Space>
            ),
          },
          {
            key: "traces",
            label: "过程轨迹",
            children: (
              <Table rowKey="id" columns={traceColumns} dataSource={traces} pagination={false} />
            ),
          },
          {
            key: "tools",
            label: "工具调用",
            children: (
              <Table rowKey="id" columns={toolColumns} dataSource={toolCalls} pagination={false} />
            ),
          },
          {
            key: "reports",
            label: "报告",
            children: (
              <List
                dataSource={reports}
                locale={{ emptyText: "暂无报告，可先点击「导出报告」" }}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.report_title}
                      description={`格式: ${item.report_format} · ${item.report_path || "无路径"}`}
                    />
                  </List.Item>
                )}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
