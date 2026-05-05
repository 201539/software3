import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Select, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteTask, listTasks } from "../api/api";
import type { EvaluationTask, TaskStatus } from "../api/types";
import { TaskStatusTag } from "../utils/status";

const taskStatuses: TaskStatus[] = [
  "draft",
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "archived",
];

export function TaskListPage() {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EvaluationTask[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<{ name?: string; status?: TaskStatus }>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTasks({
        name: filters.name || undefined,
        status: filters.status,
        page,
        page_size: pageSize,
      });
      setData(res.items as EvaluationTask[]);
      setTotal(res.total);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters.name, filters.status, page, pageSize, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = (values: { name?: string; status?: TaskStatus }) => {
    setFilters(values);
    setPage(1);
  };

  const columns: ColumnsType<EvaluationTask> = [
    { title: "ID", dataIndex: "id", width: 70 },
    { title: "任务编码", dataIndex: "task_code", ellipsis: true },
    { title: "名称", dataIndex: "name", ellipsis: true },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (s: TaskStatus) => <TaskStatusTag status={s} />,
    },
    { title: "目标 ID", dataIndex: "target_id", width: 90 },
    { title: "数据集 ID", dataIndex: "dataset_id", width: 100 },
    {
      title: "创建时间",
      dataIndex: "created_at",
      width: 180,
      render: (t: string) => dayjs(t).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_, row) => (
        <Space>
          <Link to={`/tasks/${row.id}`}>
            <Button type="link" size="small" icon={<EyeOutlined />}>
              详情
            </Button>
          </Link>
          <Link to={`/tasks/${row.id}/edit`}>
            <Button type="link" size="small" icon={<EditOutlined />}>
              编辑
            </Button>
          </Link>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              modal.confirm({
                title: "删除评测任务？",
                content: `将删除「${row.name}」，不可恢复。`,
                onOk: async () => {
                  await deleteTask(row.id);
                  message.success("已删除");
                  void load();
                },
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          评测任务
        </Typography.Title>
        <Link to="/tasks/new">
          <Button type="primary" icon={<PlusOutlined />}>
            新建任务
          </Button>
        </Link>
      </div>
      <Form layout="inline" onFinish={onSearch} style={{ marginBottom: 16 }}>
        <Form.Item name="name">
          <Input allowClear placeholder="名称关键词" style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="status">
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 140 }}
            options={taskStatuses.map((s) => ({ label: s, value: s }))}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            查询
          </Button>
        </Form.Item>
      </Form>
      <Table<EvaluationTask>
        rowKey="id"
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
    </div>
  );
}
