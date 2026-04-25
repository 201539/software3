# CHANGELOG

## [Unreleased]

### 进行中
- Step 2：ReAct Loop 改造（executor.ts）

---

## 2026-04-25

### Added
- `packages/shared/types.ts`：新增所有核心类型定义
  - `ChatMessage`（SystemMessage / UserMessage / AssistantMessage / ToolResultMessage）
  - `Session`、`TaskSummary`
  - `AgentEvent` 联合类型（ChunkEvent / ToolEvent / ResultEvent / ErrorEvent / PlanEvent / ConfirmRequestEvent / ConfirmResolvedEvent / TaskStatusEvent / SessionEvent）
  - `PendingConfirm`
- `packages/session-store/index.ts`：会话持久化层
  - `createSession()`、`loadSession()`、`saveSession()`
  - `getOrCreateCurrentSession()`
  - `appendMessages()`、`appendTaskSummary()`
  - `readProjectMemory()`
- `mydocs/agent-memory-and-orchestration-plan.md`：记忆管理与流程编排完整改造规划

### Changed
- `packages/shared/index.ts`：新增 `export * from './types.ts'`

---

## 2026-04-22

### Added
- `packages/llm-client/types.ts`：`LlmClient` 接口、`ChatOptions` 类型
- `packages/llm-client/openai.ts`：OpenAI-compatible 实现（含豆包兼容模式）
- `packages/llm-client/mock.ts`：Mock 实现
- `packages/llm-client/index.ts`：`createLlmClient()` 工厂函数
- `mydocs/llm-provider-abstraction.md`：LLM 抽象层设计文档

### Changed
- `apps/runtime/server.ts`：替换原有硬编码 LLM 调用，改用 `createLlmClient()`
- `.env.example`：新增 `LLM_*` 系列环境变量说明

### Notes
- 向后兼容 `DOUBAO_API_KEY` / `DOUBAO_MODEL` / `DOUBAO_BASE_URL` 旧变量
- 豆包专有参数（`thinking`、`reasoning_effort`）通过 `LLM_PROVIDER=doubao` 自动注入
