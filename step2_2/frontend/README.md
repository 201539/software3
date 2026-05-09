# step2_2 前端 · 通用 Agent 评估平台

基于 **React 18 + TypeScript + Vite + Ant Design + ECharts**，对接 `step2_2/backend` 已实现的 REST 与 WebSocket。

## 本地运行

1. 启动后端（默认 `http://127.0.0.1:8000`，见 backend README）。
2. 安装依赖并启动前端：

```bash
cd step2_2/frontend
npm install
npm run dev
```

浏览器访问 `http://127.0.0.1:5173`。开发环境下 Vite 已将 `/api` 代理到 `http://127.0.0.1:8000`（含 WebSocket），无需单独配置 CORS。

## 生产构建

```bash
npm run build
```

产物在 `dist/`，需由 Nginx 等将 `/api` 反向代理到后端。

## 环境变量（可选）

勿在源码中写死密钥。复制 `.env.example` 为 `.env.local` 并按需填写（`.env.local` 勿提交）。

| 变量 | 说明 |
|------|------|
| `VITE_API_BASE` | 完整 API 前缀，如 `http://127.0.0.1:8000/api/v1`。不设则使用相对路径 `/api/v1`（依赖同源或代理）。 |
| `VITE_API_BEARER_TOKEN` | 若后端启用 Bearer 鉴权，在此配置 Token；开发机本地使用即可。 |

## 功能页面

- **评测任务**：列表筛选、创建/编辑、详情、发起运行（`POST /evaluation-runs`）
- **运行详情**：暂停/恢复/取消/重试、导出报告、样本/指标/轨迹/工具/报告 Tab、WebSocket 实时日志
- **评测目标**、**数据集与样本**、**多任务对比**、**方法与自定义指标**

目录约定：`src/api` 请求封装，`src/pages` 页面，`src/layouts` 布局。
