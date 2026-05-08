import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal, Select, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createDatasetSample,
  deleteDatasetSample,
  getDataset,
  listDatasetSamples,
} from "../api/api";
import type { Dataset, DatasetSample } from "../api/types";

const SAMPLE_TYPES = [
  { value: "generic_qa", label: "通用问答" },
  { value: "tool_use", label: "工具使用" },
  { value: "workflow", label: "流程执行" },
  { value: "multi_turn", label: "多轮交互" },
  { value: "structured_output", label: "结构化输出" },
  { value: "planning", label: "计划生成" },
  { value: "task_decomposition", label: "任务拆解" },
  { value: "code_edit", label: "代码修改（示例）" },
];

export function DatasetDetailPage() {
  const { datasetId } = useParams();
  const id = Number(datasetId);
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [samples, setSamples] = useState<DatasetSample[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (Number.isNaN(id)) return;
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        getDataset(id),
        listDatasetSamples(id, { page, page_size: pageSize }),
      ]);
      setDataset(d);
      setSamples(s.items as DatasetSample[]);
      setTotal(s.total);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, message, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitSample = async () => {
    const v = await form.validateFields();
    let input_payload: Record<string, unknown>;
    let expected_output: Record<string, unknown> | undefined;
    let reference_context: Record<string, unknown> | undefined;
    let ground_truth: Record<string, unknown> | undefined;
    let metadata: Record<string, unknown> | undefined;
    try {
      input_payload = JSON.parse(v.input_json) as Record<string, unknown>;
      if (v.expected_json) expected_output = JSON.parse(v.expected_json) as Record<string, unknown>;
      if (v.reference_json) reference_context = JSON.parse(v.reference_json) as Record<string, unknown>;
      if (v.ground_truth_json) ground_truth = JSON.parse(v.ground_truth_json) as Record<string, unknown>;
      if (v.metadata_json) metadata = JSON.parse(v.metadata_json) as Record<string, unknown>;
    } catch {
      message.error("JSON 字段格式不正确");
      return;
    }
    try {
      await createDatasetSample(id, {
        sample_code: v.sample_code,
        sample_type: v.sample_type,
        input_payload,
        expected_output: expected_output ?? null,
        reference_context: reference_context ?? null,
        ground_truth: ground_truth ?? null,
        metadata: metadata ?? null,
      });
      message.success("样本已添加");
      setOpen(false);
      form.resetFields();
      void load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns: ColumnsType<DatasetSample> = [
    { title: "ID", dataIndex: "id", width: 70 },
    { title: "样本编码", dataIndex: "sample_code", ellipsis: true },
    { title: "类型", dataIndex: "sample_type", width: 140 },
    {
      title: "输入",
      dataIndex: "input_payload",
      ellipsis: true,
      render: (v: Record<string, unknown>) => JSON.stringify(v),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      width: 170,
      render: (t: string) => dayjs(t).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "操作",
      key: "op",
      width: 100,
      render: (_, row) => (
        <Button
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() =>
            modal.confirm({
              title: "删除该样本？",
              onOk: async () => {
                await deleteDatasetSample(id, row.id);
                message.success("已删除");
                void load();
              },
            })
          }
        >
          删除
        </Button>
      ),
    },
  ];

  if (!dataset && !loading) {
    return <Typography.Text type="danger">数据集不存在</Typography.Text>;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/datasets")}>
          返回
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            form.setFieldsValue({
              sample_type: "generic_qa",
              input_json: '{"task":"示例输入"}',
            });
            setOpen(true);
          }}
        >
          添加样本
        </Button>
      </Space>
      {dataset && (
        <Typography.Paragraph>
          <Typography.Text strong>{dataset.name}</Typography.Text>（{dataset.dataset_code}）· 样本{" "}
          {dataset.sample_count}
        </Typography.Paragraph>
      )}
      <Table<DatasetSample>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={samples}
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
      <Modal
        title="添加样本"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submitSample()}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="sample_code" label="样本编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sample_type" label="样本类型" rules={[{ required: true }]}>
            <Select options={SAMPLE_TYPES} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="input_json" label="input_payload (JSON)" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="expected_json" label="expected_output (JSON)">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
          <Form.Item name="reference_json" label="reference_context (JSON)">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
          <Form.Item name="ground_truth_json" label="ground_truth (JSON)">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
          <Form.Item name="metadata_json" label="metadata (JSON)">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
