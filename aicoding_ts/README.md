# AI Coding Agent Web MVP

一个基于 Web 的 AI 编程助手，通过聊天界面让 AI Agent 自主读写工作区文件、执行命令，实时流式输出执行过程。

## 功能

- **聊天驱动**：向 AI 下达自然语言编码指令
- **文件管理**：浏览、编辑、创建、重命名、删除工作区文件
- **Agent 执行**：AI 自动规划 → 调用工具（读/写文件、执行命令）→ 汇报结果
- **实时流式输出**：通过 Server-Sent Events 显示执行进度
- **Mock 模式**：未配置 LLM 凭据时自动降级，不影响文件管理功能

## 环境要求

- Node.js 22+（使用 `--experimental-strip-types` 直接运行 TypeScript，无需编译）

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置 LLM（见下方"LLM 配置"章节）
cp .env.example .env
# 编辑 .env 填入你的 API Key

# 3. 启动
npm run dev
```

访问 http://localhost:3000

默认端口为 3000，可通过 `PORT` 环境变量修改。

## LLM 配置

项目支持所有 OpenAI-compatible 接口，通过 `.env` 文件配置。

### LiteLLM（推荐）

[LiteLLM](https://github.com/BerriAI/litellm) 作为统一代理，可以在后端连接任意模型。

```dotenv
LLM_API_KEY=sk-anything
LLM_MODEL=gpt-4o
LLM_BASE_URL=http://localhost:4000
```

### OpenAI

```dotenv
LLM_API_KEY=sk-xxx
LLM_MODEL=gpt-4o
# LLM_BASE_URL 不填，默认 https://api.openai.com/v1
```

### DeepSeek

```dotenv
LLM_API_KEY=sk-xxx
LLM_MODEL=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com/v1
```

### 豆包（Doubao）

```dotenv
LLM_API_KEY=your_key
LLM_MODEL=your_model_id
LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
LLM_PROVIDER=doubao
```

> `LLM_PROVIDER=doubao` 会自动注入豆包专有参数 `thinking` 和 `reasoning_effort`。

### 环境变量说明

| 变量 | 必填 | 说明 |
|---|---|---|
| `LLM_API_KEY` | 是 | API 密钥 |
| `LLM_MODEL` | 是 | 模型名称 |
| `LLM_BASE_URL` | 否 | API 地址，默认 `https://api.openai.com/v1` |
| `LLM_PROVIDER` | 否 | Provider 标识，目前仅 `doubao` 有特殊行为 |
| `LLM_TEMPERATURE` | 否 | 温度，默认 `0.7` |
| `LLM_MAX_TOKENS` | 否 | 最大 token 数，默认 `4096` |
| `LLM_TOP_P` | 否 | Top-p 采样，不填则不传给 API |
| `LLM_TIMEOUT` | 否 | 请求超时（毫秒） |
| `LLM_MAX_RETRIES` | 否 | 最大重试次数 |
| `PORT` | 否 | HTTP 服务端口，默认 `3000` |

**向后兼容**：`DOUBAO_API_KEY` / `DOUBAO_MODEL` / `DOUBAO_BASE_URL` 变量在未设置 `LLM_*` 时仍然生效。

### Mock 模式

不配置任何 Key 时自动进入 Mock 模式，文件管理功能完全正常，AI 对话返回占位响应。

`GET /api/meta` 可以查看当前 LLM 状态：

```json
{ "llmEnabled": false, "provider": "mock" }
```

## 项目结构

```
├── server.ts                    # 入口：加载 .env，启动服务
├── apps/
│   ├── runtime/server.ts        # HTTP 服务器 + API 路由
│   └── web/                     # 前端（原生 TypeScript）
├── packages/
│   ├── agent-core/              # Agent 流程（规划 → 执行 → 审查 → 总结）
│   ├── llm-client/              # LLM 客户端抽象层
│   │   ├── types.ts             # LlmClient 接口定义
│   │   ├── openai.ts            # OpenAI-compatible 实现
│   │   ├── mock.ts              # Mock 实现
│   │   └── index.ts             # 工厂函数 createLlmClient()
│   ├── tool-gateway/            # 工具调用（读写文件、执行命令）
│   ├── workspace-manager/       # 工作区文件树管理
│   ├── context-builder/         # 构建 LLM 上下文（按相关性选文件）
│   └── shared/                  # 公共类型和工具函数
├── workspaces/
│   └── demo-project/workspace/  # Agent 操作的工作区目录
└── mydocs/                      # 项目内部设计文档
```

## API

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/meta` | GET | 应用信息、LLM 状态 |
| `/api/workspace` | GET | 文件树 |
| `/api/file/:path` | GET | 读取文件 |
| `/api/file` | PUT | 写入文件 |
| `/api/folder` | PUT | 创建目录 |
| `/api/item/rename` | POST | 重命名 |
| `/api/item/delete` | POST | 删除 |
| `/api/tool/run` | POST | 执行命令 |
| `/api/agent/preview` | POST | Agent 执行（SSE 流式） |

## 开发

```bash
# 类型检查
npm run typecheck

# 启动（热重载需手动重启）
npm run dev
```
