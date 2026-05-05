import { App, Button, Card, Form, Input, InputNumber, Select, Space } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createTask,
  getTask,
  listDatasets,
  listMethods,
  listMetrics,
  listTargets,
  updateTask,
} from "../api/api";
import type { EvaluationMethod, EvaluationTarget, MetricDefinition, TaskStatus } from "../api/types";

const taskStatuses: TaskStatus[] = [
  "draft",
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "archived",
];

export function TaskFormPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const isEdit = Boolean(taskId);
  const [loading, setLoading] = useState(false);
  const [targetList, setTargetList] = useState<EvaluationTarget[]>([]);
  const [targets, setTargets] = useState<{ label: string; value: number }[]>([]);
  const [datasets, setDatasets] = useState<{ label: string; value: number }[]>([]);
  const [methods, setMethods] = useState<EvaluationMethod[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);

  useEffect(() => {
    const boot = async () => {
      try {
        const [ts, ds, ms, mt] = await Promise.all([
          listTargets({ enabled: true }),
          listDatasets({ page: 1, page_size: 200 }),
          listMethods(),
          listMetrics({ page: 1, page_size: 200 }),
        ]);
        setTargetList(ts);
        setTargets(ts.map((t) => ({ label: `${t.name} (#${t.id})`, value: t.id })));
        setDatasets(ds.items.map((d) => ({ label: `${d.name} (#${d.id})`, value: d.id })));
        setMethods(ms);
        setMetrics(mt.items);
      } catch (e) {
        message.error((e as Error).message);
      }
    };
    void boot();
  }, [message]);

  useEffect(() => {
    if (!taskId) return;
    const id = Number(taskId);
    if (Number.isNaN(id)) return;
    const load = async () => {
      setLoading(true);
      try {
        const task = await getTask(id);
        const explicit = (task.metric_config?.explicit_metrics as string[] | undefined) ?? [];
        const fuzzy = (task.metric_config?.fuzzy_metrics as string[] | undefined) ?? [];
        form.setFieldsValue({
          name: task.name,
          description: task.description ?? "",
          target_id: task.target_id,
          target_type: task.target_type,
          target_version: task.target_version,
          dataset_id: task.dataset_id,
          evaluation_method_config: task.evaluation_method_config,
          explicit_metrics: explicit,
          fuzzy_metrics: fuzzy,
          timeout_ms: (task.run_config?.timeout_ms as number | undefined) ?? 30000,
          concurrency: (task.run_config?.concurrency as number | undefined) ?? 2,
          retry_times: (task.run_config?.retry_times as number | undefined) ?? 1,
          run_mode: (task.run_config?.run_mode as string | undefined) ?? "async",
          status: task.status,
        });
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [taskId, form, message]);

  const onTargetChange = (tid: number) => {
    const full = targetList.find((x) => x.id === tid);
    if (full) {
      form.setFieldsValue({
        target_type: full.target_type,
        target_version: full.version,
      });
    }
  };

  const submit = async () => {
    const v = await form.validateFields();
    setLoading(true);
    try {
      const metric_config = {
        explicit_metrics: v.explicit_metrics ?? [],
        fuzzy_metrics: v.fuzzy_metrics ?? [],
      };
      const run_config = {
        timeout_ms: v.timeout_ms,
        concurrency: v.concurrency,
        retry_times: v.retry_times,
        run_mode: v.run_mode,
      };
      if (isEdit && taskId) {
        await updateTask(Number(taskId), {
          name: v.name,
          description: v.description || null,
          target_id: v.target_id,
          target_type: v.target_type,
          target_version: v.target_version,
          dataset_id: v.dataset_id,
          evaluation_method_config: v.evaluation_method_config,
          metric_config,
          run_config,
          status: v.status,
        });
        message.success("已保存");
      } else {
        const created = await createTask({
          name: v.name,
          description: v.description || null,
          target_id: v.target_id,
          target_type: v.target_type,
          target_version: v.target_version,
          dataset_id: v.dataset_id,
          evaluation_method_config: v.evaluation_method_config ?? [],
          metric_config,
          run_config,
          status: v.status ?? "draft",
        });
        message.success("已创建");
        navigate(`/tasks/${created.id}`);
        return;
      }
      navigate(`/tasks/${taskId}`);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card loading={loading && isEdit} title={isEdit ? "编辑评测任务" : "新建评测任务"}>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 720 }}
        initialValues={{
          status: "draft",
          evaluation_method_config: [],
          explicit_metrics: [],
          fuzzy_metrics: [],
          timeout_ms: 30000,
          concurrency: 2,
          retry_times: 1,
          run_mode: "async",
        }}
      >
        <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="target_id" label="评测目标" rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={targets}
            onChange={onTargetChange}
            placeholder="选择已注册的 Agent 目标"
          />
        </Form.Item>
        <Form.Item name="target_type" label="目标类型" rules={[{ required: true }]}>
          <Input placeholder="如 agent_http_api" />
        </Form.Item>
        <Form.Item name="target_version" label="目标版本" rules={[{ required: true }]}>
          <Input placeholder="如 v1.0.0" />
        </Form.Item>
        <Form.Item name="dataset_id" label="数据集" rules={[{ required: true }]}>
          <Select showSearch optionFilterProp="label" options={datasets} />
        </Form.Item>
        <Form.Item name="evaluation_method_config" label="评估方法（多选）">
          <Select
            mode="multiple"
            options={methods.map((m) => ({
              label: `${m.name} (${m.method_code})`,
              value: m.method_code,
            }))}
          />
        </Form.Item>
        <Form.Item name="explicit_metrics" label="显式指标">
          <Select
            mode="multiple"
            options={(metrics.some((m) => m.metric_type === "explicit")
              ? metrics.filter((m) => m.metric_type === "explicit")
              : metrics
            ).map((m) => ({ label: `${m.name} (${m.metric_code})`, value: m.metric_code }))}
          />
        </Form.Item>
        <Form.Item name="fuzzy_metrics" label="模糊指标">
          <Select
            mode="multiple"
            options={(metrics.some((m) => m.metric_type === "fuzzy")
              ? metrics.filter((m) => m.metric_type === "fuzzy")
              : metrics
            ).map((m) => ({ label: `${m.name} (${m.metric_code})`, value: m.metric_code }))}
          />
        </Form.Item>
        <Form.Item label="运行参数">
          <Space wrap>
            <Form.Item name="timeout_ms" label="超时(ms)" style={{ marginBottom: 0 }}>
              <InputNumber min={1000} step={1000} />
            </Form.Item>
            <Form.Item name="concurrency" label="并发" style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={32} />
            </Form.Item>
            <Form.Item name="retry_times" label="重试" style={{ marginBottom: 0 }}>
              <InputNumber min={0} max={10} />
            </Form.Item>
            <Form.Item name="run_mode" label="模式" style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 120 }}
                options={[
                  { label: "async", value: "async" },
                  { label: "sync", value: "sync" },
                ]}
              />
            </Form.Item>
          </Space>
        </Form.Item>
        {isEdit && (
          <Form.Item name="status" label="任务状态">
            <Select options={taskStatuses.map((s) => ({ label: s, value: s }))} />
          </Form.Item>
        )}
        <Space>
          <Button type="primary" onClick={() => void submit()} loading={loading}>
            保存
          </Button>
          <Button onClick={() => navigate(-1)}>返回</Button>
        </Space>
      </Form>
    </Card>
  );
}
