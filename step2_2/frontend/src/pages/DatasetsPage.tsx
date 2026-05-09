import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createDataset, deleteDataset, listDatasets } from "../api/api";
import { isRequestAborted } from "../api/client";
import type { Dataset } from "../api/types";
import { useAbortableRequest } from "../hooks/useAbortableRequest";
import { useLoadRequestId } from "../hooks/useLoadRequestId";

export function DatasetsPage() {
  const { message, modal } = App.useApp();
  const { next: nextLoadId, isCurrent: isLoadCurrent } = useLoadRequestId();
  const nextSignal = useAbortableRequest();
  const [data, setData] = useState<Dataset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    const rid = nextLoadId();
    const signal = nextSignal();
    setLoading(true);
    try {
      const res = await listDatasets({ page, page_size: pageSize }, { signal });
      if (!isLoadCurrent(rid)) return;
      setData(res.items as Dataset[]);
      setTotal(res.total);
    } catch (e) {
      if (isRequestAborted(e)) return;
      if (!isLoadCurrent(rid)) return;
      message.error((e as Error).message);
    } finally {
      if (isLoadCurrent(rid)) setLoading(false);
    }
  }, [message, page, pageSize, nextLoadId, isLoadCurrent, nextSignal]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const v = await form.validateFields();
    try {
      await createDataset({
        dataset_code: v.dataset_code,
        name: v.name,
        description: v.description || null,
        source_type: v.source_type,
        version: v.version,
        status: v.status,
      });
      message.success("已创建数据集");
      setOpen(false);
      form.resetFields();
      void load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns: ColumnsType<Dataset> = useMemo(
    () => [
      { title: "ID", dataIndex: "id", width: 70 },
      { title: "编码", dataIndex: "dataset_code", ellipsis: true },
      { title: "名称", dataIndex: "name", ellipsis: true },
      { title: "版本", dataIndex: "version", width: 90 },
      { title: "状态", dataIndex: "status", width: 100 },
      { title: "样本数", dataIndex: "sample_count", width: 90 },
      {
        title: "创建时间",
        dataIndex: "created_at",
        width: 170,
        render: (t: string) => dayjs(t).format("YYYY-MM-DD HH:mm"),
      },
      {
        title: "操作",
        key: "op",
        width: 180,
        render: (_, row) => (
          <Space>
            <Link to={`/datasets/${row.id}`}>
              <Button type="link" size="small">
                样本管理
              </Button>
            </Link>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                modal.confirm({
                  title: "删除数据集？",
                  content: "将同时影响引用该数据集的任务配置。",
                  onOk: async () => {
                    await deleteDataset(row.id);
                    message.success("已删除");
                    void load();
                  },
                })
              }
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [load, message, modal],
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          数据集
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            form.setFieldsValue({ source_type: "manual", version: "v1", status: "draft" });
            setOpen(true);
          }}
        >
          新建数据集
        </Button>
      </div>
      <Table<Dataset>
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={data}
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
        title="新建数据集"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="dataset_code" label="数据集编码" rules={[{ required: true }]}>
            <Input placeholder="dataset_001" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="source_type" label="来源类型" rules={[{ required: true }]}>
            <Input placeholder="manual" />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Input placeholder="draft / active" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
