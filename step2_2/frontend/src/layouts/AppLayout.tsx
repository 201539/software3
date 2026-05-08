import {
  BarChartOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Layout, Menu, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: "/tasks", icon: <UnorderedListOutlined />, label: "评测任务" },
  { key: "/targets", icon: <DeploymentUnitOutlined />, label: "评测目标" },
  { key: "/datasets", icon: <DatabaseOutlined />, label: "数据集" },
  { key: "/compare", icon: <BarChartOutlined />, label: "结果对比" },
  { key: "/metrics", icon: <ExperimentOutlined />, label: "方法与指标" },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const selected = menuItems.find((i) => location.pathname.startsWith(i.key))?.key ?? "/tasks";

  return (
    <Layout style={{ minHeight: "100%" }}>
      <Sider breakpoint="lg" collapsedWidth={0} theme="dark" width={220}>
        <div style={{ padding: "16px 20px" }}>
          <Typography.Title level={5} style={{ color: "#fff", margin: 0 }}>
            Agent 评估平台
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Typography.Text type="secondary">通用 Agent 评估平台</Typography.Text>
        </Header>
        <Content style={{ margin: 24 }}>
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 8,
              minHeight: 360,
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
