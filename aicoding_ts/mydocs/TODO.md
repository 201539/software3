# TODO

## 进行中

- [ ] **Step 2**：ReAct Loop 改造（`packages/agent-core/executor.ts`）
  - `runModel()` → `runReActLoop()`
  - 工具结果以 `tool_result` 消息回传给模型
  - 新增 `ask_user` 工具定义
  - `parallel_tool_calls` 改为 `false`

## 待做

- [ ] **Step 3**：改造 `agent-core/index.ts`
  - 新增 `runTask(sessionId, prompt, selectedFile, onEvent, onConfirm)`
  - `createAgentCore()` 注入 `sessionStore` 参数
  - 构建 system prompt（含 project-memory + 近5条 taskSummaries）
  - 保留 `preview()` 作向后兼容别名

- [ ] **Step 4**：改造 `apps/runtime/server.ts` 新增 API
  - `GET /api/session` — 获取当前会话信息
  - `POST /api/session` — 创建新会话
  - `POST /api/agent/chat` — 主要 agent 接口（SSE）
  - `POST /api/agent/confirm` — 响应 agent 确认请求
  - 初始化 `sessionStore`，注入 `agentCore`
  - 实现 `pendingConfirms` Map + `createConfirmHook`

- [ ] **Step 5**：前端改造
  - `apps/web/index.html`：新建会话按钮、会话 ID 显示
  - `apps/web/app.ts`：`streamChat()`、`initSession()`、`renderConfirmCard()`、`submitConfirm()`、`createNewSession()`
  - `apps/web/styles.css`：confirm-card 等新样式

- [ ] **Step 6**：E2E 确认流程验证
  - 触发 `ask_user` → 确认卡片出现 → 用户响应 → loop 继续 → 任务完成
  - 刷新页面后会话 ID 和 taskSummaries 恢复

## 已完成

- [x] **Step 1**：数据类型 + session-store 持久化层（2026-04-25）
  - 新建 `packages/shared/types.ts`（ChatMessage、Session、TaskSummary、AgentEvent、PendingConfirm）
  - 新建 `packages/session-store/index.ts`（createSession、loadSession、appendMessages 等7个方法）
  - `packages/shared/index.ts` 新增 re-export types.ts

- [x] LLM Client 抽象解耦（2026-04-22）
  - 新建 `packages/llm-client/types.ts`、`openai.ts`、`mock.ts`、`index.ts`
  - 支持 OpenAI-compat / 豆包 / Mock，通过 `.env` 配置
  - 向后兼容 `DOUBAO_*` 环境变量
