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
  { key: "/metrics", icon: <ExperimentOutlined />, label: "方法与指标" },
  { key: "/compare", icon: <BarChartOutlined />, label: "结果对比" },
];

const sectionHints: Record<string, string> = {
  tasks: "任务编排与运行记录",
  runs: "单次运行观测与导出",
  targets: "被测端点与鉴权配置",
  datasets: "样本与版本管理",
  compare: "多任务结果对照",
  metrics: "评测方法与指标定义",
};

function headerHint(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  return sectionHints[seg] ?? "评测与质量分析";
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const selected = menuItems.find((i) => location.pathname.startsWith(i.key))?.key ?? "/tasks";

  return (
    <Layout style={{ minHeight: "100%" }}>
      <Sider
        breakpoint="lg"
        collapsedWidth={0}
        theme="dark"
        width={220}
        style={{
          borderRight: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "2px 0 12px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 8,
          }}
        >
          <Typography.Title
            level={5}
            style={{ color: "#fff", margin: 0, fontWeight: 600, letterSpacing: "0.02em" }}
          >
            评测工作台
          </Typography.Title>
          <Typography.Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
            实验与数据控制台
          </Typography.Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: "none" }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#f7f8fa",
            padding: "0 24px",
            borderBottom: "1px solid #e4e6eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography.Text style={{ color: "#5c6370", fontSize: 13 }}>
            {headerHint(location.pathname)}
          </Typography.Text>
        </Header>
        <Content style={{ margin: 20 }}>
          <div
            className="app-page-card"
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 8,
              minHeight: 360,
              border: "1px solid #e8eaed",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
