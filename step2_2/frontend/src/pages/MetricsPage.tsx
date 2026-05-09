import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal, Select, Table, Tabs, Typography } from "antd";
import { PageTableSkeleton } from "../components/PageTableSkeleton";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createMetric, listMethods, listMetrics } from "../api/api";
import { isRequestAborted } from "../api/client";
import type { EvaluationMethod, MetricDefinition } from "../api/types";
import { useAbortableRequest } from "../hooks/useAbortableRequest";
import { useLoadRequestId } from "../hooks/useLoadRequestId";

export function MetricsPage() {
  const { message } = App.useApp();
  const { next: nextLoadId, isCurrent: isLoadCurrent } = useLoadRequestId();
  const nextSignal = useAbortableRequest();
  const [methods, setMethods] = useState<EvaluationMethod[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    const rid = nextLoadId();
    const signal = nextSignal();
    setLoading(true);
    try {
      const [mth, mt] = await Promise.all([
        listMethods({ signal }),
        listMetrics({ page, page_size: pageSize }, { signal }),
      ]);
      if (!isLoadCurrent(rid)) return;
      setMethods(mth);
      setMetrics(mt.items);
      setTotal(mt.total);
    } catch (e) {
      if (isRequestAborted(e)) return;
      if (!isLoadCurrent(rid)) return;
      message.error((e as Error).message);
    } finally {
      if (isLoadCurrent(rid)) {
        setLoading(false);
        setHasLoadedOnce(true);
      }
    }
  }, [message, page, pageSize, nextLoadId, isLoadCurrent, nextSignal]);

  useEffect(() => {
    void load();
  }, [load]);

  const methodColumns: ColumnsType<EvaluationMethod> = useMemo(
    () => [
      { title: "编码", dataIndex: "method_code", width: 140 },
      { title: "名称", dataIndex: "name" },
      { title: "类别", dataIndex: "category", width: 100 },
      { title: "说明", dataIndex: "description", ellipsis: true },
      {
        title: "启用",
        dataIndex: "enabled",
        width: 80,
        render: (v: boolean) => (v ? "是" : "否"),
      },
    ],
    [],
  );

  const metricColumns: ColumnsType<MetricDefinition> = useMemo(
    () => [
      { title: "编码", dataIndex: "metric_code", width: 160, ellipsis: true },
      { title: "名称", dataIndex: "name", ellipsis: true },
      { title: "类型", dataIndex: "metric_type", width: 100 },
      { title: "维度", dataIndex: "dimension", width: 100 },
      { title: "计算模式", dataIndex: "calc_mode", width: 100 },
      {
        title: "创建时间",
        dataIndex: "created_at",
        width: 170,
        render: (t: string) => dayjs(t).format("YYYY-MM-DD HH:mm"),
      },
    ],
    [],
  );

  const submitMetric = async () => {
    const v = await form.validateFields();
    try {
      await createMetric({
        metric_code: v.metric_code,
        name: v.name,
        metric_type: v.metric_type,
        dimension: v.dimension,
        description: v.description || null,
        calc_mode: v.calc_mode,
        enabled: v.enabled ?? true,
      });
      message.success("指标已创建");
      setOpen(false);
      form.resetFields();
      void load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <div>
      <Typography.Title level={4}>评估方法与指标</Typography.Title>
      <Typography.Paragraph type="secondary">
        列表数据来自后端接口；若为空请在数据库或后端种子中初始化 evaluation_methods / metrics。
      </Typography.Paragraph>
      <Tabs
        items={[
          {
            key: "methods",
            label: "评估方法",
            children: !hasLoadedOnce && loading ? (
              <PageTableSkeleton rows={5} />
            ) : (
              <Table<EvaluationMethod>
                rowKey="id"
                size="small"
                loading={loading}
                columns={methodColumns}
                dataSource={methods}
                pagination={false}
              />
            ),
          },
          {
            key: "metrics",
            label: "指标定义",
            children: (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      form.resetFields();
                      form.setFieldsValue({
                        metric_type: "explicit",
                        dimension: "effect",
                        calc_mode: "rule",
                        enabled: true,
                      });
                      setOpen(true);
                    }}
                  >
                    自定义指标
                  </Button>
                </div>
                {!hasLoadedOnce && loading ? (
                  <PageTableSkeleton rows={6} />
                ) : (
                  <Table<MetricDefinition>
                    rowKey="id"
                    size="small"
                    loading={loading}
                    columns={metricColumns}
                    dataSource={metrics}
                    pagination={{
                      current: page,
                      pageSize,
                      total,
                      showSizeChanger: true,
                      onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                      },
                    }}
                  />
                )}
              </>
            ),
          },
        ]}
      />
      <Modal
        title="创建自定义指标"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submitMetric()}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="metric_code" label="指标编码" rules={[{ required: true }]}>
            <Input placeholder="唯一编码" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="metric_type" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "显式 explicit", value: "explicit" },
                { label: "模糊 fuzzy", value: "fuzzy" },
              ]}
            />
          </Form.Item>
          <Form.Item name="dimension" label="维度" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "效果 effect", value: "effect" },
                { label: "安全 safety", value: "safety" },
                { label: "性能 performance", value: "performance" },
              ]}
            />
          </Form.Item>
          <Form.Item name="calc_mode" label="计算模式" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "规则 rule", value: "rule" },
                { label: "LLM judge", value: "llm_judge" },
                { label: "Ragas", value: "ragas" },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
